import { env } from "cloudflare:workers";

const TENANT_ID = "raven-oracle";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

async function logFailure(input: { tenantId: string; id: string; platform: string; code: number; message: string; body?: unknown }) {
  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, ?, 'publish', 'failed', ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), input.tenantId, input.id, input.platform, input.code, input.body ? JSON.stringify(input.body) : null, input.message)
    .run();
  await env.DB.prepare("UPDATE sns_posts SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(input.tenantId, input.id)
    .run();
}

async function waitForInstagramContainer(containerId: string) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const response = await fetch(`https://graph.facebook.com/v26.0/${containerId}?fields=status_code&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
    const body = (await response.json().catch(() => ({}))) as { status_code?: string; error?: unknown };
    if (body.status_code === "FINISHED") return { ok: true, body };
    if (body.status_code === "ERROR" || body.error) return { ok: false, body };
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return { ok: false, body: { status_code: "TIMEOUT" } };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });

  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });

  const id = clean(body.id, 80);
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const fullPost = await env.DB.prepare("SELECT id, tenant_id, platform, post_type, title, caption, media_type, media_url, thumbnail_url FROM sns_posts WHERE tenant_id = ? AND id = ? LIMIT 1")
    .bind(tenantId, id)
    .first<{ id: string; tenant_id: string; platform: string; post_type: string; title: string; caption: string; media_type: string; media_url: string; thumbnail_url: string }>();
  if (!fullPost) return Response.json({ error: "Post not found" }, { status: 404 });

  const platform = fullPost.platform || "instagram";
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID) {
    await logFailure({ tenantId, id, platform, code: 400, message: "Instagram API is not configured." });
    return Response.json({ ok: false, error: "Instagram API is not configured." }, { status: 400 });
  }

  const mediaUrl = String(fullPost.media_url || fullPost.thumbnail_url || "");
  const caption = String(fullPost.caption || fullPost.title || "").slice(0, 2200);
  if (!mediaUrl) {
    await logFailure({ tenantId, id, platform, code: 400, message: "A public media_url or thumbnail_url is required for Instagram publishing." });
    return Response.json({ ok: false, error: "A public media_url or thumbnail_url is required for Instagram publishing." }, { status: 400 });
  }

  const isReel = fullPost.post_type === "reel" || fullPost.media_type === "video";
  const params = new URLSearchParams({
    caption,
    access_token: env.INSTAGRAM_ACCESS_TOKEN,
  });
  if (isReel) {
    params.set("media_type", "REELS");
    params.set("video_url", mediaUrl);
    params.set("share_to_feed", "true");
  } else {
    params.set("image_url", mediaUrl);
  }

  const createResponse = await fetch(`https://graph.facebook.com/v26.0/${env.INSTAGRAM_ACCOUNT_ID}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const createBody = (await createResponse.json().catch(() => ({}))) as { id?: string; error?: unknown };
  if (!createResponse.ok || !createBody.id) {
    await logFailure({ tenantId, id, platform, code: createResponse.status, message: "Instagram media container creation failed", body: createBody });
    return Response.json({ ok: false, error: "Instagram media container creation failed", details: createBody }, { status: 502 });
  }

  if (isReel) {
    const ready = await waitForInstagramContainer(createBody.id);
    if (!ready.ok) {
      await logFailure({ tenantId, id, platform, code: 502, message: "Instagram Reel container was not ready.", body: ready.body });
      return Response.json({ ok: false, error: "Instagram Reel container was not ready.", details: ready.body }, { status: 502 });
    }
  }

  const publishResponse = await fetch(`https://graph.facebook.com/v26.0/${env.INSTAGRAM_ACCOUNT_ID}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: createBody.id,
      access_token: env.INSTAGRAM_ACCESS_TOKEN,
    }),
  });
  const publishBody = (await publishResponse.json().catch(() => ({}))) as { id?: string; error?: unknown };
  if (!publishResponse.ok || !publishBody.id) {
    await logFailure({ tenantId, id, platform, code: publishResponse.status, message: "Instagram media publish failed", body: publishBody });
    return Response.json({ ok: false, error: "Instagram media publish failed", details: publishBody }, { status: 502 });
  }

  const externalId = publishBody.id;
  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body) VALUES (?, ?, ?, ?, 'publish', 'success', ?, ?)",
  )
    .bind(crypto.randomUUID(), tenantId, id, platform, 200, JSON.stringify({ externalId, isReel }))
    .run();
  await env.DB.prepare("UPDATE sns_posts SET status = 'published', published_at = CURRENT_TIMESTAMP, external_post_id = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(externalId, tenantId, id)
    .run();

  return Response.json({ ok: true, externalId, isReel }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });

  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });

  const id = clean(body.id, 80);
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const post = await env.DB.prepare("SELECT id, platform, external_post_id FROM sns_posts WHERE tenant_id = ? AND id = ? LIMIT 1")
    .bind(tenantId, id)
    .first<{ id: string; platform: string; external_post_id: string }>();
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
  if (!post.external_post_id) return Response.json({ error: "external_post_id is missing." }, { status: 400 });
  if (!env.INSTAGRAM_ACCESS_TOKEN) return Response.json({ error: "Instagram API is not configured." }, { status: 400 });

  const deleteResponse = await fetch(`https://graph.facebook.com/v26.0/${post.external_post_id}?access_token=${env.INSTAGRAM_ACCESS_TOKEN}`, { method: "DELETE" });
  const deleteBody = (await deleteResponse.json().catch(() => ({}))) as { success?: boolean; error?: unknown };
  if (!deleteResponse.ok || deleteBody.success !== true) {
    await env.DB.prepare(
      "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, ?, 'delete', 'failed', ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), tenantId, id, post.platform || "instagram", deleteResponse.status, JSON.stringify(deleteBody), "Instagram media delete failed")
      .run();
    return Response.json({ ok: false, error: "Instagram media delete failed", details: deleteBody }, { status: 502 });
  }

  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body) VALUES (?, ?, ?, ?, 'delete', 'success', ?, ?)",
  )
    .bind(crypto.randomUUID(), tenantId, id, post.platform || "instagram", 200, JSON.stringify(deleteBody))
    .run();
  await env.DB.prepare("UPDATE sns_posts SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(tenantId, id)
    .run();

  return Response.json({ ok: true, id, externalId: post.external_post_id }, { headers: { "Cache-Control": "no-store" } });
}
