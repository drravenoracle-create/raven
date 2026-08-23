import { env } from "cloudflare:workers";
import { observeInstagramContainer, readInstagramMetaError, sanitizeInstagramResponse } from "@/app/lib/instagram-reel-state";

const TENANT_ID = "raven-oracle";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanCaption(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\/n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

async function logFailure(input: { tenantId: string; id: string; platform: string; code: number; message: string; body?: unknown }) {
  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, ?, 'publish', 'failed', ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), input.tenantId, input.id, input.platform, input.code, input.body ? sanitizeInstagramResponse(input.body) : null, input.message)
    .run();
  await env.DB.prepare("UPDATE sns_posts SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(input.tenantId, input.id)
    .run();
}

async function logRetryableAuthFailure(input: { tenantId: string; id: string; platform: string; code: number; message: string; body?: unknown }) {
  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, ?, 'publish', 'auth_error', ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), input.tenantId, input.id, input.platform, input.code, input.body ? JSON.stringify(input.body) : null, input.message)
    .run();
  await env.DB.prepare("UPDATE sns_posts SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(input.tenantId, input.id)
    .run();
}

function isInstagramAuthError(body: unknown) {
  const error = (body as { error?: { code?: number; type?: string; error_subcode?: number } })?.error;
  return error?.code === 190;
}

function parseMediaUrls(post: { media_url?: string; thumbnail_url?: string }) {
  const raw = String(post.media_url || post.thumbnail_url || "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 10);
    } catch {}
  }
  return raw.split(/[\n,]/).map((item) => item.trim()).filter(Boolean).slice(0, 10);
}

async function saveReelState(input: { tenantId: string; id: string; containerId: string; state: string; metaStatus?: string | null; httpStatus?: number; body?: unknown }) {
  const error = readInstagramMetaError(input.body);
  await env.DB.prepare(
    "UPDATE sns_posts SET container_id = ?, container_status = ?, container_created_at = COALESCE(container_created_at, CURRENT_TIMESTAMP), container_last_checked_at = CASE WHEN ? IS NULL THEN container_last_checked_at ELSE CURRENT_TIMESTAMP END, container_ready_at = CASE WHEN ? = 'ready' THEN CURRENT_TIMESTAMP ELSE container_ready_at END, meta_status = COALESCE(?, meta_status), meta_http_status = COALESCE(?, meta_http_status), meta_response_body = COALESCE(?, meta_response_body), meta_error_code = ?, meta_error_subcode = ?, meta_error_message = ?, meta_error_type = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?",
  ).bind(input.containerId, input.state, input.httpStatus ?? null, input.state, input.metaStatus ?? null, input.httpStatus ?? null, input.body ? sanitizeInstagramResponse(input.body) : null, error.code, error.subcode, error.message, error.type, input.tenantId, input.id).run();
}

async function logReelEvent(input: { tenantId: string; id: string; containerId: string; action: string; state: string; httpStatus: number; body?: unknown; retryCount?: number }) {
  const error = readInstagramMetaError(input.body);
  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, container_id, container_status, retry_count, meta_error_code, meta_error_subcode) VALUES (?, ?, ?, 'instagram', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), input.tenantId, input.id, input.action, input.state, input.httpStatus, sanitizeInstagramResponse(input.body), input.containerId, input.state, input.retryCount ?? 0, error.code, error.subcode).run();
}

async function checkInstagramContainer(containerId: string) {
  const response = await fetch(`https://graph.facebook.com/v26.0/${containerId}?fields=status_code&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
  const body = await response.json().catch(() => ({}));
  return { response, body, observation: observeInstagramContainer(response.status, body) };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });

  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });

  const id = clean(body.id, 80);
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const fullPost = await env.DB.prepare("SELECT id, tenant_id, platform, post_type, title, caption, media_type, media_url, thumbnail_url, status, external_post_id, container_id, container_status, retry_count FROM sns_posts WHERE tenant_id = ? AND id = ? LIMIT 1")
    .bind(tenantId, id)
    .first<{ id: string; tenant_id: string; platform: string; post_type: string; title: string; caption: string; media_type: string; media_url: string; thumbnail_url: string; status?: string; external_post_id?: string; container_id?: string; container_status?: string; retry_count?: number }>();
  if (!fullPost) return Response.json({ error: "Post not found" }, { status: 404 });

  const platform = fullPost.platform || "instagram";
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID) {
    await logFailure({ tenantId, id, platform, code: 400, message: "Instagram API is not configured." });
    return Response.json({ ok: false, error: "Instagram API is not configured." }, { status: 400 });
  }

  const mediaUrls = parseMediaUrls(fullPost);
  const caption = cleanCaption(fullPost.caption || fullPost.title || "", 2200);
  if (!mediaUrls.length) {
    await logFailure({ tenantId, id, platform, code: 400, message: "A public media_url or thumbnail_url is required for Instagram publishing." });
    return Response.json({ ok: false, error: "A public media_url or thumbnail_url is required for Instagram publishing." }, { status: 400 });
  }

  const isReel = fullPost.post_type === "reel" || fullPost.media_type === "video";
  if (isReel && (fullPost.status === "published" || fullPost.external_post_id)) {
    return Response.json({ ok: true, alreadyPublished: true, externalId: fullPost.external_post_id }, { headers: { "Cache-Control": "no-store" } });
  }
  if (isReel && fullPost.container_id && fullPost.container_status === "publishing") {
    return Response.json({ ok: false, inProgress: true, state: "publishing", requiresReconciliation: true, containerId: fullPost.container_id }, { status: 202 });
  }
  if (isReel && fullPost.container_id) {
    const checked = await checkInstagramContainer(fullPost.container_id);
    await saveReelState({ tenantId, id, containerId: fullPost.container_id, state: checked.observation.state, metaStatus: checked.observation.metaStatus, httpStatus: checked.response.status, body: checked.body });
    await logReelEvent({ tenantId, id, containerId: fullPost.container_id, action: "check", state: checked.observation.state, httpStatus: checked.response.status, body: checked.body, retryCount: fullPost.retry_count });
    if (checked.observation.state === "processing") return Response.json({ ok: false, inProgress: true, state: "processing", containerId: fullPost.container_id }, { status: 202 });
    if (checked.observation.state === "failed") {
      await logFailure({ tenantId, id, platform, code: checked.response.status, message: "Instagram Reel container returned an explicit error.", body: checked.body });
      return Response.json({ ok: false, error: "Instagram Reel container returned an explicit error.", details: checked.body }, { status: 502 });
    }
  }
  if (fullPost.post_type === "carousel" && mediaUrls.length >= 2 && !isReel) {
    const childIds: string[] = [];
    for (const mediaUrl of mediaUrls) {
      const childResponse = await fetch(`https://graph.facebook.com/v26.0/${env.INSTAGRAM_ACCOUNT_ID}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ image_url: mediaUrl, is_carousel_item: "true", access_token: env.INSTAGRAM_ACCESS_TOKEN }),
      });
      const childBody = (await childResponse.json().catch(() => ({}))) as { id?: string; error?: unknown };
      if (!childResponse.ok || !childBody.id) {
        if (isInstagramAuthError(childBody)) {
          await logRetryableAuthFailure({ tenantId, id, platform, code: childResponse.status, message: "Instagram access token expired.", body: childBody });
          return Response.json({ ok: false, error: "Instagram access token expired. Please update INSTAGRAM_ACCESS_TOKEN.", details: childBody }, { status: 401 });
        }
        await logFailure({ tenantId, id, platform, code: childResponse.status, message: "Instagram carousel child creation failed", body: childBody });
        return Response.json({ ok: false, error: "Instagram carousel child creation failed", details: childBody }, { status: 502 });
      }
      childIds.push(childBody.id);
    }
    const carouselResponse = await fetch(`https://graph.facebook.com/v26.0/${env.INSTAGRAM_ACCOUNT_ID}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ media_type: "CAROUSEL", children: childIds.join(","), caption, access_token: env.INSTAGRAM_ACCESS_TOKEN }),
    });
    const carouselBody = (await carouselResponse.json().catch(() => ({}))) as { id?: string; error?: unknown };
    if (!carouselResponse.ok || !carouselBody.id) {
      if (isInstagramAuthError(carouselBody)) {
        await logRetryableAuthFailure({ tenantId, id, platform, code: carouselResponse.status, message: "Instagram access token expired.", body: carouselBody });
        return Response.json({ ok: false, error: "Instagram access token expired. Please update INSTAGRAM_ACCESS_TOKEN.", details: carouselBody }, { status: 401 });
      }
      await logFailure({ tenantId, id, platform, code: carouselResponse.status, message: "Instagram carousel container creation failed", body: carouselBody });
      return Response.json({ ok: false, error: "Instagram carousel container creation failed", details: carouselBody }, { status: 502 });
    }
    return publishInstagramContainer({ tenantId, id, platform, creationId: carouselBody.id, isReel: false, mode: "instagram_carousel" });
  }

  const params = new URLSearchParams({
    caption,
    access_token: env.INSTAGRAM_ACCESS_TOKEN,
  });
  if (isReel) {
    params.set("media_type", "REELS");
    params.set("video_url", mediaUrls[0]);
    params.set("share_to_feed", "true");
  } else {
    params.set("image_url", mediaUrls[0]);
  }

  let creationId = String(fullPost.container_id || "").trim();
  if (!creationId) {
    const createResponse = await fetch(`https://graph.facebook.com/v26.0/${env.INSTAGRAM_ACCOUNT_ID}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const createBody = (await createResponse.json().catch(() => ({}))) as { id?: string; error?: unknown };
    if (!createResponse.ok || !createBody.id) {
      if (isInstagramAuthError(createBody)) {
        await logRetryableAuthFailure({ tenantId, id, platform, code: createResponse.status, message: "Instagram access token expired.", body: createBody });
        return Response.json({ ok: false, error: "Instagram access token expired. Please update INSTAGRAM_ACCESS_TOKEN.", details: createBody }, { status: 401 });
      }
      await logFailure({ tenantId, id, platform, code: createResponse.status, message: "Instagram media container creation failed", body: createBody });
      return Response.json({ ok: false, error: "Instagram media container creation failed", details: createBody }, { status: 502 });
    }
    creationId = createBody.id;
    if (isReel) {
      await saveReelState({ tenantId, id, containerId: creationId, state: "created", httpStatus: createResponse.status, body: createBody });
      await logReelEvent({ tenantId, id, containerId: creationId, action: "create", state: "created", httpStatus: createResponse.status, body: createBody, retryCount: fullPost.retry_count });
      return Response.json({ ok: false, inProgress: true, state: "created", containerId: creationId }, { status: 202 });
    }
  }
  if (isReel) {
    await saveReelState({ tenantId, id, containerId: creationId, state: "publishing" });
  }

  const publishResponse = await fetch(`https://graph.facebook.com/v26.0/${env.INSTAGRAM_ACCOUNT_ID}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: env.INSTAGRAM_ACCESS_TOKEN,
    }),
  });
  const publishBody = (await publishResponse.json().catch(() => ({}))) as { id?: string; error?: unknown };
  if (!publishResponse.ok || !publishBody.id) {
    if (isInstagramAuthError(publishBody)) {
      await logRetryableAuthFailure({ tenantId, id, platform, code: publishResponse.status, message: "Instagram access token expired.", body: publishBody });
      return Response.json({ ok: false, error: "Instagram access token expired. Please update INSTAGRAM_ACCESS_TOKEN.", details: publishBody }, { status: 401 });
    }
    if (isReel) {
      await saveReelState({ tenantId, id, containerId: creationId, state: "failed", httpStatus: publishResponse.status, body: publishBody });
      await logReelEvent({ tenantId, id, containerId: creationId, action: "publish", state: "failed", httpStatus: publishResponse.status, body: publishBody, retryCount: (fullPost.retry_count || 0) + 1 });
    }
    await logFailure({ tenantId, id, platform, code: publishResponse.status, message: "Instagram media publish failed", body: publishBody });
    return Response.json({ ok: false, error: "Instagram media publish failed", details: publishBody }, { status: 502 });
  }

  const externalId = publishBody.id;
  if (isReel) {
    await saveReelState({ tenantId, id, containerId: creationId, state: "published", httpStatus: publishResponse.status, body: publishBody });
    await logReelEvent({ tenantId, id, containerId: creationId, action: "publish", state: "published", httpStatus: publishResponse.status, body: publishBody, retryCount: fullPost.retry_count });
  }
  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body) VALUES (?, ?, ?, ?, 'publish', 'success', ?, ?)",
  )
    .bind(crypto.randomUUID(), tenantId, id, platform, 200, JSON.stringify({ externalId, isReel }))
    .run();
  await env.DB.prepare("UPDATE sns_posts SET status = 'published', published_at = CURRENT_TIMESTAMP, external_post_id = ?, container_published_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE container_published_at END, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(externalId, isReel ? 1 : 0, tenantId, id)
    .run();

  return Response.json({ ok: true, externalId, isReel }, { headers: { "Cache-Control": "no-store" } });
}

async function publishInstagramContainer(input: { tenantId: string; id: string; platform: string; creationId: string; isReel: boolean; mode: string }) {
  const publishResponse = await fetch(`https://graph.facebook.com/v26.0/${env.INSTAGRAM_ACCOUNT_ID}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: input.creationId,
      access_token: env.INSTAGRAM_ACCESS_TOKEN,
    }),
  });
  const publishBody = (await publishResponse.json().catch(() => ({}))) as { id?: string; error?: unknown };
  if (!publishResponse.ok || !publishBody.id) {
    if (isInstagramAuthError(publishBody)) {
      await logRetryableAuthFailure({ tenantId: input.tenantId, id: input.id, platform: input.platform, code: publishResponse.status, message: "Instagram access token expired.", body: publishBody });
      return Response.json({ ok: false, error: "Instagram access token expired. Please update INSTAGRAM_ACCESS_TOKEN.", details: publishBody }, { status: 401 });
    }
    await logFailure({ tenantId: input.tenantId, id: input.id, platform: input.platform, code: publishResponse.status, message: "Instagram media publish failed", body: publishBody });
    return Response.json({ ok: false, error: "Instagram media publish failed", details: publishBody }, { status: 502 });
  }

  const externalId = publishBody.id;
  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body) VALUES (?, ?, ?, ?, 'publish', 'success', ?, ?)",
  )
    .bind(crypto.randomUUID(), input.tenantId, input.id, input.platform, 200, JSON.stringify({ externalId, isReel: input.isReel, mode: input.mode }))
    .run();
  await env.DB.prepare("UPDATE sns_posts SET status = 'published', published_at = CURRENT_TIMESTAMP, external_post_id = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(externalId, input.tenantId, input.id)
    .run();

  return Response.json({ ok: true, externalId, isReel: input.isReel, mode: input.mode }, { headers: { "Cache-Control": "no-store" } });
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
