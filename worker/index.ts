/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_ACCOUNT_ID?: string;
  INSTAGRAM_TOKEN_EXPIRES_AT?: string;
  INSTAGRAM_TOKEN_RENEWAL_TARGET_AT?: string;
  SNS_PROVIDER_MODE?: string;
  SNS_DAILY_THREE_CHOICE_ENABLED?: string;
  SNS_DAILY_THREE_CHOICE_TIME_JST?: string;
  SNS_DAILY_THREE_CHOICE_GENERATION_LEAD_MINUTES?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const TENANT_ID = "raven-oracle";
const DEFAULT_SNS_SCHEDULE = { windows: [{ start: "01:00", end: "07:00" }, { start: "13:00", end: "17:00" }] };

function json(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
  });
}

function sanitizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function getReferrerHost(referrer: string) {
  if (!referrer) return "";
  try {
    return new URL(referrer).hostname.slice(0, 120);
  } catch {
    return "";
  }
}

function getCloudflareGeo(request: Request) {
  const cf = (request as Request & { cf?: { country?: string; colo?: string; region?: string; city?: string } }).cf;
  return {
    country: sanitizeText(cf?.country || request.headers.get("cf-ipcountry"), 8).toUpperCase(),
    colo: sanitizeText(cf?.colo, 16).toUpperCase(),
    region: sanitizeText(cf?.region, 120),
    city: sanitizeText(cf?.city, 120),
  };
}

function toIsoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseJstDateEnd(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T23:59:59+09:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function instagramTokenStatus(env: Env) {
  const expiresAt = String(env.INSTAGRAM_TOKEN_EXPIRES_AT || "").trim();
  const expiresAtDate = parseJstDateEnd(expiresAt);
  const renewalTargetAt = String(env.INSTAGRAM_TOKEN_RENEWAL_TARGET_AT || "").trim()
    || (expiresAtDate ? toIsoDate(addDays(expiresAtDate, -7)) : "");
  const configured = Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID);

  if (!expiresAtDate) {
    return {
      configured,
      expires_at: null,
      renewal_target_at: renewalTargetAt || null,
      days_remaining: null,
      level: "unknown",
      message: configured
        ? "Instagramトークン期限が未設定です。INSTAGRAM_TOKEN_EXPIRES_ATを設定してください。"
        : "Instagram APIが未設定です。",
    };
  }

  const daysRemaining = Math.ceil((expiresAtDate.getTime() - Date.now()) / 86_400_000);
  const level = daysRemaining < 0 ? "expired" : daysRemaining <= 7 ? "critical" : daysRemaining <= 30 ? "warning" : "ok";
  const message = daysRemaining < 0
    ? "Instagramトークン期限が切れています。再取得が必要です。"
    : daysRemaining <= 7
      ? "Instagramトークン期限が近いです。すぐに更新してください。"
      : daysRemaining <= 30
        ? "Instagramトークン期限が30日以内です。更新準備をしてください。"
        : "Instagramトークンは有効期限内です。";

  return {
    configured,
    expires_at: expiresAt,
    renewal_target_at: renewalTargetAt || null,
    days_remaining: daysRemaining,
    level,
    message,
  };
}

function toJsonText(value: unknown, maxLength: number) {
  return sanitizeText(value, maxLength);
}

function parseSnsSchedule(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (Array.isArray(parsed?.windows) && parsed.windows.length) return parsed as typeof DEFAULT_SNS_SCHEDULE;
  } catch {}
  return DEFAULT_SNS_SCHEDULE;
}

function isInSnsPublishWindow(scheduleJson: unknown) {
  const { time } = jstParts();
  const schedule = parseSnsSchedule(scheduleJson);
  return schedule.windows.some((window) => time >= window.start && time <= window.end);
}

function currentSnsPublishWindow(scheduleJson: unknown) {
  const { date, time } = jstParts();
  const schedule = parseSnsSchedule(scheduleJson);
  const window = schedule.windows.find((item) => time >= item.start && time <= item.end);
  if (!window) return null;
  return {
    startIso: jstLocalToUtcIso(date, window.start),
    endIso: new Date().toISOString(),
  };
}

async function readJson(request: Request) {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}

async function ensureSnsTenant(body: Record<string, unknown> | null) {
  const tenantId = sanitizeText(body?.tenant_id ?? body?.tenantId, 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) throw new Error("Invalid tenant_id");
  return tenantId;
}

async function handleSnsTemplateList(request: Request, env: Env) {
  const url = new URL(request.url);
  const tenantId = sanitizeText(url.searchParams.get("tenantId"), 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) return json({ error: "Invalid tenant_id" }, { status: 400 });
  if (request.method === "GET") {
    const result = await env.DB.prepare("SELECT * FROM sns_post_templates WHERE tenant_id = ? AND status != 'archived' ORDER BY category, name").bind(tenantId).all();
    const settings = await env.DB.prepare("SELECT * FROM sns_template_settings WHERE tenant_id = ? LIMIT 1").bind(tenantId).first().catch(() => null);
    return json({ templates: result.results || [], settings });
  }
  return json({ error: "Template creation is available through the application route." }, { status: 405 });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function handleAnalyticsEvent(request: Request, env: Env) {
  if (!env.DB) return json({ error: "D1 database binding DB is not configured" }, { status: 500 });
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });

  const body = (await request.json().catch(() => null)) as null | {
    tenantId?: unknown;
    eventName?: unknown;
    pagePath?: unknown;
    pageTitle?: unknown;
    referrer?: unknown;
    source?: unknown;
    medium?: unknown;
    campaign?: unknown;
    linkUrl?: unknown;
    linkText?: unknown;
  };

  if (!body) return json({ error: "Invalid JSON body." }, { status: 400 });

  const referrer = sanitizeText(body.referrer, 500);
  const userAgent = sanitizeText(request.headers.get("user-agent"), 300);
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  const visitorHash = await sha256Hex(`${toIsoDate()}|${ip}|${userAgent}`);
  const geo = getCloudflareGeo(request);

  await env.DB.prepare(
    `INSERT INTO analytics_events
      (id, created_at, tenant_id, event_name, page_path, page_title, referrer, referrer_host,
       source, medium, campaign, link_url, link_text, visitor_hash, user_agent, country, cf_colo, region, city)
      VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      sanitizeText(body.tenantId, 80) || TENANT_ID,
      sanitizeText(body.eventName, 60) || "page_view",
      sanitizeText(body.pagePath, 240) || "/",
      sanitizeText(body.pageTitle, 160),
      referrer,
      getReferrerHost(referrer),
      sanitizeText(body.source, 80),
      sanitizeText(body.medium, 80),
      sanitizeText(body.campaign, 120),
      sanitizeText(body.linkUrl, 500),
      sanitizeText(body.linkText, 160),
      visitorHash,
      userAgent,
      geo.country,
      geo.colo,
      geo.region,
      geo.city,
    )
    .run();

  return json({ ok: true });
}

async function listSnsPosts(request: Request, env: Env) {
  if (!env.DB) return json({ error: "D1 database binding DB is not configured" }, { status: 500 });
  const url = new URL(request.url);
  const tenantId = sanitizeText(url.searchParams.get("tenantId"), 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) return json({ error: "Invalid tenant_id" }, { status: 400 });
  const result = await env.DB.prepare(
    "SELECT * FROM sns_posts WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 100",
  )
    .bind(tenantId)
    .all();
  return json({ posts: result.results || [] });
}

function buildSnsDraft(input: Record<string, unknown>) {
  const theme = toJsonText(input.theme, 180) || "返信前の文章を整える3つの視点";
  const purpose = toJsonText(input.purpose, 180) || "テキスト鑑定への案内";
  const character = toJsonText(input.character, 120) || "レイヴン・ブラックウッド";
  const cta = toJsonText(input.cta, 240) || "必要なら、レイヴン・ブラックウッドのテキスト鑑定で一緒に整理できます。";
  const title = toJsonText(input.title, 180) || theme;
  const caption =
    toJsonText(input.caption, 2200) ||
    `${theme}\n\n送る前に、気持ち、目的、相手に求めることを一度分けてみてください。\n\n${cta}\n\n#レイヴンブラックウッド #文章鑑定 #相談整理 #返信前チェック`;
  const script =
    toJsonText(input.script, 4000) ||
    `0-3秒: ${theme}\n3-10秒: まず気持ちと目的を分けます。\n10-22秒: 相手に何を求めているかを一文にします。\n22-27秒: 送る、待つ、保留するを選びます。\n27-30秒: ${cta}`;
  return { theme, purpose, character, cta, title, caption, script };
}
async function createSnsPost(request: Request, env: Env) {
  if (!env.DB) return json({ error: "D1 database binding DB is not configured" }, { status: 500 });
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON body." }, { status: 400 });
  let tenantId = TENANT_ID;
  try {
    tenantId = await ensureSnsTenant(body);
  } catch {
    return json({ error: "Invalid tenant_id" }, { status: 400 });
  }
  const draft = buildSnsDraft(body);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO sns_posts
      (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, media_type, media_url, thumbnail_url, status, scheduled_at, ai_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      tenantId,
      toJsonText(body.platform, 40) || "instagram",
      toJsonText(body.post_type ?? body.postType, 40) || "image",
      draft.title,
      draft.theme,
      toJsonText(body.category, 120) || "SNS投稿",
      draft.character,
      draft.purpose,
      draft.cta,
      draft.caption,
      toJsonText(body.hashtags, 500) || "#レイヴンブラックウッド #文章鑑定 #相談整理",
      draft.script,
      toJsonText(body.media_type ?? body.mediaType, 40),
      toJsonText(body.media_url ?? body.mediaUrl, 1000),
      toJsonText(body.thumbnail_url ?? body.thumbnailUrl, 1000),
      toJsonText(body.status, 40) || "draft",
      toJsonText(body.scheduled_at ?? body.scheduledAt, 80),
      1,
    )
    .run();
  return json({ ok: true, id, post: { id, tenant_id: tenantId, ...draft } }, { status: 201 });
}

async function updateSnsStatus(request: Request, env: Env) {
  if (!env.DB) return json({ error: "D1 database binding DB is not configured" }, { status: 500 });
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON body." }, { status: 400 });
  let tenantId = TENANT_ID;
  try {
    tenantId = await ensureSnsTenant(body);
  } catch {
    return json({ error: "Invalid tenant_id" }, { status: 400 });
  }
  const id = toJsonText(body.id, 80);
  const status = toJsonText(body.status, 40);
  if (!id || !status) return json({ error: "id and status are required" }, { status: 400 });
  await env.DB.prepare("UPDATE sns_posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(status, tenantId, id)
    .run();
  return json({ ok: true });
}

function parseMediaUrls(post: Record<string, unknown>) {
  const raw = String(post.media_url || post.thumbnail_url || "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 10);
    } catch {}
  }
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function isInstagramAuthError(body: unknown) {
  const error = (body as { error?: { code?: number; type?: string } })?.error;
  return error?.code === 190;
}

async function logRetryableInstagramAuthFailure(env: Env, input: { tenantId: string; id: string; platform: string; code: number; body?: unknown }) {
  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, ?, 'publish', 'auth_error', ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), input.tenantId, input.id, input.platform, input.code, input.body ? JSON.stringify(input.body) : null, "Instagram access token expired")
    .run();
  await env.DB.prepare("UPDATE sns_posts SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(input.tenantId, input.id)
    .run();
}

async function waitForInstagramContainer(env: Env, containerId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`https://graph.facebook.com/v26.0/${containerId}?fields=status_code&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
    const body = (await response.json().catch(() => ({}))) as { status_code?: string; error?: unknown };
    if (body.status_code === "FINISHED") return { ok: true, body };
    if (body.status_code === "ERROR" || body.error) return { ok: false, body };
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return { ok: false, body: { status_code: "TIMEOUT" } };
}

async function publishInstagramContainer(env: Env, post: Record<string, unknown>, creationId: string, providerMode: string) {
  const tenantId = String(post.tenant_id || TENANT_ID);
  const id = String(post.id || "");
  const platform = String(post.platform || "instagram");
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
      await logRetryableInstagramAuthFailure(env, { tenantId, id, platform, code: publishResponse.status, body: publishBody });
      return { ok: false, error: "Instagram access token expired. Please update INSTAGRAM_ACCESS_TOKEN.", details: publishBody };
    }
    await env.DB.prepare(
      "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, ?, 'publish', 'failed', ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), tenantId, id, platform, publishResponse.status, JSON.stringify(publishBody), "Instagram media publish failed")
      .run();
    await env.DB.prepare("UPDATE sns_posts SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .bind(tenantId, id)
      .run();
    return { ok: false, error: "Instagram media publish failed", details: publishBody };
  }
  const externalId = publishBody.id;
  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body) VALUES (?, ?, ?, ?, 'publish', 'success', ?, ?)",
  )
    .bind(crypto.randomUUID(), tenantId, id, platform, 200, JSON.stringify({ mode: providerMode || "instagram", externalId }))
    .run();
  await env.DB.prepare(
    "UPDATE sns_posts SET status = 'published', published_at = CURRENT_TIMESTAMP, external_post_id = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?",
  )
    .bind(externalId, tenantId, id)
    .run();
  return { ok: true, externalId };
}

async function publishSnsPost(env: Env, post: Record<string, unknown>) {
  const tenantId = String(post.tenant_id || TENANT_ID);
  const id = String(post.id || "");
  const platform = String(post.platform || "instagram");
  const postType = String(post.post_type || "image");
  const providerMode = env.SNS_PROVIDER_MODE || "";
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID) {
    await env.DB.prepare(
      "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, error_message) VALUES (?, ?, ?, ?, 'publish', 'failed', ?, ?)",
    )
      .bind(crypto.randomUUID(), tenantId, id, platform, 400, "Instagram APIが設定されていません")
      .run();
    await env.DB.prepare("UPDATE sns_posts SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .bind(tenantId, id)
      .run();
    return { ok: false, error: "Instagram APIが設定されていません" };
  }
  if (providerMode === "mock_failure") {
    await env.DB.prepare(
      "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, error_message) VALUES (?, ?, ?, ?, 'publish', 'failed', ?, ?)",
    )
      .bind(crypto.randomUUID(), tenantId, id, platform, 500, "Mock provider failure")
      .run();
    return { ok: false, error: "Mock provider failure" };
  }
  const caption = String(post.caption || post.title || "").slice(0, 2200);
  const mediaUrls = parseMediaUrls(post);
  if (!mediaUrls.length) {
    await env.DB.prepare(
      "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, error_message) VALUES (?, ?, ?, ?, 'publish', 'failed', ?, ?)",
    )
      .bind(crypto.randomUUID(), tenantId, id, platform, 400, "Instagram投稿には公開アクセス可能な画像URLが必要です")
      .run();
    await env.DB.prepare("UPDATE sns_posts SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .bind(tenantId, id)
      .run();
    return { ok: false, error: "Instagram投稿には公開アクセス可能な画像URLが必要です" };
  }

  const isReel = postType === "reel" || String(post.media_type || "") === "video";
  if (postType === "carousel" && mediaUrls.length >= 2 && !isReel) {
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
          await logRetryableInstagramAuthFailure(env, { tenantId, id, platform, code: childResponse.status, body: childBody });
          return { ok: false, error: "Instagram access token expired. Please update INSTAGRAM_ACCESS_TOKEN.", details: childBody };
        }
        await env.DB.prepare(
          "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, ?, 'publish', 'failed', ?, ?, ?)",
        )
          .bind(crypto.randomUUID(), tenantId, id, platform, childResponse.status, JSON.stringify(childBody), "Instagram carousel child creation failed")
          .run();
        await env.DB.prepare("UPDATE sns_posts SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
          .bind(tenantId, id)
          .run();
        return { ok: false, error: "Instagram carousel child creation failed", details: childBody };
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
        await logRetryableInstagramAuthFailure(env, { tenantId, id, platform, code: carouselResponse.status, body: carouselBody });
        return { ok: false, error: "Instagram access token expired. Please update INSTAGRAM_ACCESS_TOKEN.", details: carouselBody };
      }
      await env.DB.prepare(
        "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, ?, 'publish', 'failed', ?, ?, ?)",
      )
        .bind(crypto.randomUUID(), tenantId, id, platform, carouselResponse.status, JSON.stringify(carouselBody), "Instagram carousel container creation failed")
        .run();
      await env.DB.prepare("UPDATE sns_posts SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
        .bind(tenantId, id)
        .run();
      return { ok: false, error: "Instagram carousel container creation failed", details: carouselBody };
    }
    return publishInstagramContainer(env, post, carouselBody.id, providerMode || "instagram_carousel");
  }

  const createResponse = await fetch(`https://graph.facebook.com/v26.0/${env.INSTAGRAM_ACCOUNT_ID}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(isReel
      ? { media_type: "REELS", video_url: mediaUrls[0], caption, share_to_feed: "true", access_token: env.INSTAGRAM_ACCESS_TOKEN }
      : { image_url: mediaUrls[0], caption, access_token: env.INSTAGRAM_ACCESS_TOKEN }),
  });
  const createBody = (await createResponse.json().catch(() => ({}))) as { id?: string; error?: unknown };
  if (!createResponse.ok || !createBody.id) {
    if (isInstagramAuthError(createBody)) {
      await logRetryableInstagramAuthFailure(env, { tenantId, id, platform, code: createResponse.status, body: createBody });
      return { ok: false, error: "Instagram access token expired. Please update INSTAGRAM_ACCESS_TOKEN.", details: createBody };
    }
    await env.DB.prepare(
      "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, ?, 'publish', 'failed', ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), tenantId, id, platform, createResponse.status, JSON.stringify(createBody), "Instagram media container creation failed")
      .run();
    await env.DB.prepare("UPDATE sns_posts SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .bind(tenantId, id)
      .run();
    return { ok: false, error: "Instagram media container creation failed", details: createBody };
  }
  if (isReel) {
    const ready = await waitForInstagramContainer(env, createBody.id);
    if (!ready.ok) {
      await env.DB.prepare(
        "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, ?, 'publish', 'failed', ?, ?, ?)",
      )
        .bind(crypto.randomUUID(), tenantId, id, platform, 502, JSON.stringify(ready.body), "Instagram Reel container was not ready.")
        .run();
      await env.DB.prepare("UPDATE sns_posts SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
        .bind(tenantId, id)
        .run();
      return { ok: false, error: "Instagram Reel container was not ready.", details: ready.body };
    }
  }
  return publishInstagramContainer(env, post, createBody.id, providerMode || "instagram");
}

async function publishSnsNow(request: Request, env: Env) {
  if (!env.DB) return json({ error: "D1 database binding DB is not configured" }, { status: 500 });
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON body." }, { status: 400 });
  let tenantId = TENANT_ID;
  try {
    tenantId = await ensureSnsTenant(body);
  } catch {
    return json({ error: "Invalid tenant_id" }, { status: 400 });
  }
  const id = toJsonText(body.id, 80);
  const post = await env.DB.prepare("SELECT * FROM sns_posts WHERE tenant_id = ? AND id = ? LIMIT 1").bind(tenantId, id).first();
  if (!post) return json({ error: "Post not found" }, { status: 404 });
  return json(await publishSnsPost(env, post));
}

function envEnabled(value: unknown, fallback = true) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  return !["0", "false", "off", "no"].includes(normalized);
}

function validTimeOr(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

function positiveIntOr(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function createDueDailySnsPost(env: Env) {
  const { date, time } = jstParts();
  if (!envEnabled(env.SNS_DAILY_THREE_CHOICE_ENABLED, true)) return 0;
  const postTime = validTimeOr(env.SNS_DAILY_THREE_CHOICE_TIME_JST, "07:00");
  const generationLeadMinutes = positiveIntOr(env.SNS_DAILY_THREE_CHOICE_GENERATION_LEAD_MINUTES, 60);
  const currentMinutes = timeToMinutes(time);
  const postMinutes = timeToMinutes(postTime);
  const generationStartMinutes = Math.max(0, postMinutes - generationLeadMinutes);
  if (currentMinutes < generationStartMinutes || currentMinutes > generationStartMinutes + 45) return 0;

  const idempotencyKey = `daily-three-choice-reel:${TENANT_ID}:${date}:${postTime}`;
  const existing = await env.DB.prepare("SELECT id FROM sns_posts WHERE tenant_id = ? AND duplicate_warning = ? LIMIT 1")
    .bind(TENANT_ID, idempotencyKey)
    .first<{ id: string }>();
  if (existing) return 0;

  const id = crypto.randomUUID();
  const title = `今日の3択占い ${date}`;
  const theme = "あの人が今、あなたに隠している本音";
  const cta = "もっと詳しく占うなら、プロフィールからRaven Oracleへ。";
  const videoUrl = "https://raven.fortunestudios.jp/api/sns/sample-video";
  const caption = [
    "今日の3択占い",
    "",
    "A / B / C から直感で1枚選んでください。",
    "結果は動画の中で確認できます。",
    "",
    cta,
    "",
    "#レイヴンブラックウッド #3択占い #オラクルカード #占い #恋愛占い",
  ].join("\n");

  await env.DB.prepare(
    `INSERT INTO sns_posts
      (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, media_type, media_url, thumbnail_url, status, scheduled_at, ai_generated, duplicate_warning)
      VALUES (?, ?, 'instagram', 'reel', ?, ?, '3択動画', 'レイヴン・ブラックウッド', 'Instagram ReelsからRaven Oracleへ誘導', ?, ?, ?, ?, 'video', ?, ?, 'draft', NULL, 1, ?)`,
  )
    .bind(
      id,
      TENANT_ID,
      title,
      theme,
      cta,
      caption,
      "#レイヴンブラックウッド #3択占い #オラクルカード #占い #恋愛占い",
      "0-2秒: HOOK\n2-5秒: 裏面カードA/B/C\n5-17秒: A/B/Cの結果\n17-20秒: CTA",
      videoUrl,
      "https://raven.fortunestudios.jp/api/sns/sample-card?card=knight",
      jstLocalToUtcIso(date, postTime),
      idempotencyKey,
    )
    .run();
  return 1;
}

async function publishDueSnsPosts(env: Env) {
  if (!env.DB) return 0;
  const settings = await env.DB.prepare("SELECT automation_level, emergency_stop_all, schedule_json FROM sns_automation_settings WHERE tenant_id = ? LIMIT 1").bind(TENANT_ID).first<{ automation_level?: number; emergency_stop_all?: number; schedule_json?: string }>();
  if (settings?.emergency_stop_all) return 0;
  if (!settings?.automation_level) return 0;
  await createDueDailySnsPost(env);
  const result = await env.DB.prepare(
    "SELECT * FROM sns_posts WHERE tenant_id = ? AND status = 'scheduled' AND scheduled_at IS NOT NULL AND datetime(scheduled_at) <= datetime('now') AND retry_count < 3 ORDER BY datetime(scheduled_at) ASC LIMIT 3",
  )
    .bind(TENANT_ID)
    .all();
  let count = 0;
  for (const post of result.results || []) {
    await publishSnsPost(env, post as Record<string, unknown>);
    count += 1;
  }
  return count;
}

function metricValueFromInsights(data: unknown, names: string[]) {
  const rows = Array.isArray((data as { data?: unknown[] })?.data) ? (data as { data: unknown[] }).data : [];
  for (const name of names) {
    const row = rows.find((item) => String((item as { name?: unknown }).name || "") === name) as { values?: { value?: unknown }[] } | undefined;
    const value = row?.values?.[0]?.value;
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

async function fetchInstagramInsights(env: Env, externalPostId: string, postType: string) {
  if (!env.INSTAGRAM_ACCESS_TOKEN) return { ok: false, error: "Instagram API is not configured." };
  const candidates = postType === "reel" || postType === "video"
    ? [
        ["plays", "reach", "likes", "comments", "shares", "saved"],
        ["ig_reels_video_view_total_time", "ig_reels_avg_watch_time"],
        ["impressions", "reach", "likes", "comments", "saved", "shares"],
      ]
    : [
        ["impressions", "reach", "likes", "comments", "saved", "shares"],
        ["reach", "likes", "comments", "saved"],
      ];
  const merged: unknown[] = [];
  const errors: unknown[] = [];
  for (const metrics of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(`https://graph.facebook.com/v26.0/${externalPostId}/insights?metric=${encodeURIComponent(metrics.join(","))}&access_token=${encodeURIComponent(env.INSTAGRAM_ACCESS_TOKEN)}`, { signal: controller.signal }).catch((error) => error as Error);
    clearTimeout(timeout);
    if (response instanceof Error) {
      errors.push({ message: response.message });
      continue;
    }
    const body = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray((body as { data?: unknown[] }).data)) {
      merged.push(...((body as { data: unknown[] }).data));
    } else {
      errors.push(body);
    }
  }
  if (!merged.length) return { ok: false, error: "Instagram insights unavailable", details: errors.slice(0, 3) };
  return {
    ok: true,
    data: { data: merged },
    metrics: {
      impressions: metricValueFromInsights({ data: merged }, ["impressions"]),
      reach: metricValueFromInsights({ data: merged }, ["reach"]),
      likes: metricValueFromInsights({ data: merged }, ["likes"]),
      comments: metricValueFromInsights({ data: merged }, ["comments"]),
      saves: metricValueFromInsights({ data: merged }, ["saved", "saves"]),
      shares: metricValueFromInsights({ data: merged }, ["shares"]),
      plays: metricValueFromInsights({ data: merged }, ["plays"]),
      watch_time: metricValueFromInsights({ data: merged }, ["ig_reels_video_view_total_time"]),
      profile_visits: metricValueFromInsights({ data: merged }, ["profile_visits"]),
      link_clicks: metricValueFromInsights({ data: merged }, ["website_clicks", "link_clicks"]),
      follower_delta: null,
    },
  };
}

async function syncInstagramPostMetrics(env: Env) {
  if (!env.DB) return 0;
  if (!env.INSTAGRAM_ACCESS_TOKEN) return 0;
  const posts = await env.DB.prepare(
    `SELECT id, external_post_id, post_type, media_type
       FROM sns_posts
      WHERE tenant_id = ? AND platform = 'instagram' AND status = 'published'
        AND external_post_id IS NOT NULL AND external_post_id != ''
      ORDER BY datetime(published_at) DESC
      LIMIT 3`,
  ).bind(TENANT_ID).all<{ id: string; external_post_id: string; post_type: string; media_type: string }>();
  let count = 0;
  for (const post of posts.results || []) {
    const result = await fetchInstagramInsights(env, post.external_post_id, post.post_type || post.media_type || "image");
    if (!result.ok || !("metrics" in result)) {
      await env.DB.prepare(
        "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, 'instagram', 'metrics_sync', 'failed', ?, ?, ?)",
      )
        .bind(crypto.randomUUID(), TENANT_ID, post.id, 502, JSON.stringify(result), String(result.error || "Instagram insights sync failed"))
        .run();
      continue;
    }
    const metrics = result.metrics;
    await env.DB.prepare(
      `INSERT INTO sns_metrics
        (id, tenant_id, post_id, impressions, reach, likes, comments, saves, shares, plays, watch_time, profile_visits, link_clicks, follower_delta, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
      .bind(
        crypto.randomUUID(),
        TENANT_ID,
        post.id,
        metrics.impressions,
        metrics.reach,
        metrics.likes,
        metrics.comments,
        metrics.saves,
        metrics.shares,
        metrics.plays,
        metrics.watch_time,
        metrics.profile_visits,
        metrics.link_clicks,
        metrics.follower_delta,
      )
      .run();
    await env.DB.prepare(
      "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body) VALUES (?, ?, ?, 'instagram', 'metrics_sync', 'success', 200, ?)",
    )
      .bind(crypto.randomUUID(), TENANT_ID, post.id, JSON.stringify({ external_post_id: post.external_post_id, metrics }))
      .run();
    count += 1;
  }
  return count;
}

async function syncInstagramMetricsNow(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });
  const count = await syncInstagramPostMetrics(env);
  await syncSnsEngineToGrowth(env);
  return json({ ok: true, syncedPosts: count });
}

async function upsertGrowthMetric(env: Env, input: {
  source: string;
  entityType: string;
  entityId: string;
  metricName: string;
  metricValue: number;
  measuredAt: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  dataQuality?: string;
  metadata?: Record<string, unknown>;
}) {
  const idempotencyKey = `${input.source}:${input.entityType}:${input.entityId}:${input.metricName}:${input.windowStart || ""}:${input.windowEnd || ""}`;
  await env.DB.prepare(
    `INSERT OR REPLACE INTO growth_metric_points
      (id, tenant_id, source, entity_type, entity_id, metric_name, metric_value, measured_at, window_start, window_end, data_quality, provider_metadata_json, idempotency_key)
      VALUES (COALESCE((SELECT id FROM growth_metric_points WHERE tenant_id = ? AND idempotency_key = ?), ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      TENANT_ID,
      idempotencyKey,
      crypto.randomUUID(),
      TENANT_ID,
      input.source,
      input.entityType,
      input.entityId,
      input.metricName,
      input.metricValue,
      input.measuredAt,
      input.windowStart || null,
      input.windowEnd || null,
      input.dataQuality || "measured",
      JSON.stringify(input.metadata || {}),
      idempotencyKey,
    )
    .run();
}

async function syncSnsEngineToGrowth(env: Env) {
  if (!env.DB) return 0;
  const now = new Date().toISOString();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let count = 0;

  const statusRows = await env.DB.prepare(
    "SELECT platform, status, COUNT(*) AS count FROM sns_posts WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) GROUP BY platform, status",
  ).bind(TENANT_ID, since).all<{ platform: string; status: string; count: number }>();
  for (const row of statusRows.results || []) {
    await upsertGrowthMetric(env, {
      source: "sns_engine",
      entityType: "tenant",
      entityId: TENANT_ID,
      metricName: `sns_posts_${row.platform}_${row.status}`,
      metricValue: Number(row.count || 0),
      measuredAt: now,
      windowStart: since,
      windowEnd: now,
      metadata: { platform: row.platform, status: row.status },
    });
    count += 1;
  }

  const typeRows = await env.DB.prepare(
    "SELECT platform, post_type, COUNT(*) AS count FROM sns_posts WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) GROUP BY platform, post_type",
  ).bind(TENANT_ID, since).all<{ platform: string; post_type: string; count: number }>();
  for (const row of typeRows.results || []) {
    await upsertGrowthMetric(env, {
      source: "sns_engine",
      entityType: "tenant",
      entityId: TENANT_ID,
      metricName: `sns_posts_${row.platform}_${row.post_type}`,
      metricValue: Number(row.count || 0),
      measuredAt: now,
      windowStart: since,
      windowEnd: now,
      metadata: { platform: row.platform, post_type: row.post_type },
    });
    count += 1;
  }

  const logRows = await env.DB.prepare(
    "SELECT platform, action, status, COUNT(*) AS count FROM sns_publish_logs WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) GROUP BY platform, action, status",
  ).bind(TENANT_ID, since).all<{ platform: string; action: string; status: string; count: number }>();
  for (const row of logRows.results || []) {
    await upsertGrowthMetric(env, {
      source: "sns_engine",
      entityType: "tenant",
      entityId: TENANT_ID,
      metricName: `sns_${row.action}_${row.platform}_${row.status}`,
      metricValue: Number(row.count || 0),
      measuredAt: now,
      windowStart: since,
      windowEnd: now,
      metadata: { platform: row.platform, action: row.action, status: row.status },
    });
    count += 1;
  }

  const postRows = await env.DB.prepare(
    `SELECT id, platform, post_type, status, title, category, character, ai_generated, retry_count, scheduled_at, published_at, external_post_id, created_at
       FROM sns_posts
      WHERE tenant_id = ? AND datetime(created_at) >= datetime(?)
      ORDER BY datetime(created_at) DESC
      LIMIT 200`,
  ).bind(TENANT_ID, since).all<Record<string, unknown>>();
  for (const post of postRows.results || []) {
    const postId = String(post.id || "");
    if (!postId) continue;
    await upsertGrowthMetric(env, {
      source: "sns_engine",
      entityType: String(post.post_type || "") === "reel" ? "sns_reel" : "sns_post",
      entityId: postId,
      metricName: `status_${String(post.status || "unknown")}`,
      metricValue: 1,
      measuredAt: String(post.published_at || post.created_at || now),
      windowStart: since,
      windowEnd: now,
      metadata: {
        title: post.title,
        platform: post.platform,
        post_type: post.post_type,
        status: post.status,
        category: post.category,
        character: post.character,
        ai_generated: post.ai_generated,
        retry_count: post.retry_count,
        scheduled_at: post.scheduled_at,
        published_at: post.published_at,
        external_post_id: post.external_post_id,
      },
    });
    count += 1;
  }

  await env.DB.prepare(
    `INSERT INTO growth_data_connectors
      (id, tenant_id, source, provider, enabled, sync_status, last_success_at, last_attempt_at, retry_count, provider_metadata_json, updated_at)
      VALUES ('raven-sns-engine', ?, 'sns_engine', 'sns_engine', 1, 'available', ?, ?, 0, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET sync_status = 'available', enabled = 1, last_success_at = excluded.last_success_at, last_attempt_at = excluded.last_attempt_at, retry_count = 0, provider_metadata_json = excluded.provider_metadata_json, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(TENANT_ID, now, now, JSON.stringify({ synced_metrics: count, window_start: since, window_end: now }))
    .run();

  await env.DB.prepare("INSERT OR IGNORE INTO growth_events (event_id, tenant_id, event_type, source_engine, entity_refs_json, payload_json, idempotency_key) VALUES (?, ?, 'sns_engine.synced', 'sns_engine', ?, ?, ?)")
    .bind(crypto.randomUUID(), TENANT_ID, JSON.stringify({ entity_type: "tenant", entity_id: TENANT_ID }), JSON.stringify({ synced_metrics: count }), `sns-engine-sync:${now.slice(0, 13)}`)
    .run();
  return count;
}

function jstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function jstLocalToUtcIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map((part) => Number(part));
  return hour * 60 + minute;
}

function dateSeed(date: string) {
  return date.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pickDaily<T>(items: T[], date: string, offset = 0) {
  return items[(dateSeed(date) + offset) % items.length];
}

function buildDailyFortuneArticle(date: string) {
  const focus = pickDaily(["整える", "待つ", "選び直す", "伝える", "距離を測る", "始める", "手放す"], date);
  const sign = pickDaily(["風が止み、次の音が聞こえる", "火種を守りながら歩く", "水面の揺れが本心を映す", "古い扉の鍵を確かめる", "小さな違和感が道案内になる"], date, 3);
  const caution = pickDaily(["急いで結論を出さないこと", "相手の沈黙を悪い意味だけで読まないこと", "一度に全部を動かそうとしないこと", "説明不足のまま約束しないこと", "期待と事実を混ぜないこと"], date, 7);
  const action = pickDaily(["返信前に一文だけ削る", "予定を一つだけ軽くする", "迷っている件を紙に三行で書く", "先に確認の連絡を入れる", "今日は保留するものを決める"], date, 11);
  const title = `今日の占い ${date} - レイヴン・ブラックウッドの一日易断`;
  const body = [
    "## 今日の兆し",
    `今日の気配は「${sign}」です。大きな決断を無理に引き寄せる日ではなく、目の前の情報を静かに並べ直すことで流れが見えてきます。レイヴン・ブラックウッドの易断では、今日は「${focus}」を軸にして一日を読むと、余計な焦りがほどけやすいでしょう。`,
    "## 仕事と対人運",
    "仕事や連絡では、相手の反応を急がせるより、こちらの意図を短く整えることが助けになります。曖昧な依頼、途中で止まっている相談、返しづらいメッセージがあるなら、まず事実と感情を分けてください。そこから言葉を選ぶと、不要な摩擦を避けられます。",
    "## 恋愛と心の距離",
    "恋愛面では、近づきたい気持ちと確かめたい気持ちが混ざりやすい日です。答えを急ぐほど、相手の小さな態度が大きく見えます。今日は相手を試す言葉より、自分が本当に知りたいことを明確にする方が流れに合っています。",
    "## 気をつけること",
    `注意点は、${caution}です。占いは未来を固定するものではなく、選択の前に視界を整えるための道具です。不安から動くのか、必要だから動くのか。その違いを一度見分けるだけで、同じ一手でも結果の受け取り方が変わります。`,
    "## 今日の一手",
    `今日の一手は「${action}」です。小さな調整で十分です。大きく運命を変えようとするより、今日の言葉、今日の予定、今日の判断を一つだけ整える。その積み重ねが、明日の選択肢を広げていきます。`,
    "## 関連ページ",
    "より具体的に整理したい場合は、[AI無料占い](/free-fortune/)や[AIテキスト鑑定](/text-reading/)も使えます。レイヴンの占術体系を知りたい場合は、[占術紹介](/divination-methods/)から確認できます。",
  ].join("\n\n");
  return {
    title,
    slug: `daily-fortune-${date}`,
    description: `${date}の今日の占い。レイヴン・ブラックウッドが一日の流れ、仕事・対人、恋愛、今日の一手を読み解きます。`,
    body,
    category: "今日の占い",
    tags: ["今日の占い", "易断", "レイヴン・ブラックウッド", "運勢", "Fortune Studio"],
    keyMessage: `今日は「${focus}」を軸に、${caution}を意識すると流れが整います。`,
  };
}

function buildDailyGuildDiaryArticle(date: string) {
  const scene = pickDaily(["雨音の残る作戦室", "暖炉の前の丸い机", "夜番明けの記録棚", "灯りを落とした相談室", "星図を広げた長机"], date, 5);
  const member = pickDaily(["ルナ・スターウィンド", "スカーレット・ドノバン", "アトラス・グレイ", "ソル・ルミナ", "レイヴン・ブラックウッド"], date, 9);
  const theme = pickDaily(["待つこと", "境界線", "言葉を短くすること", "予定を整えること", "自分を責めないこと", "迷いを書き出すこと"], date, 13);
  const closing = pickDaily(["急がない夜にも、選択の種は残る。", "静かな記録ほど、明日の判断を助ける。", "誰かを読む前に、自分の輪郭を取り戻す。", "答えではなく、次の一手を灯す。"], date, 17);
  const title = `ギルド日記 ${date} - ${theme}について`;
  const body = [
    "## 夜のギルド",
    `${date}の夜、ギルドは${scene}に集まっていた。昼間の相談記録はすでに束ねられ、机の端にはまだ温かい茶器が置かれている。今日の記録に何度も現れた言葉は「${theme}」だった。`,
    "## 今日の小さな会話",
    `${member}が、閉じかけた帳面に視線を落として言った。相談者の言葉はそれぞれ違っていても、奥にある迷いは似ている。返事を待つのか、距離を置くのか、もう一度だけ確かめるのか。ギルドでは、誰かの未来を決めつける前に、その人が失いかけている判断軸を探す。`,
    "## レイヴンの記録",
    "レイヴン・ブラックウッドは、話を急がせなかった。強い助言ほど、相談者の心が追いついていない時には重くなる。だから今日の記録には、断定ではなく問いが残された。何を守りたいのか。どこから先は自分を削るのか。今日できる一手は、本当に大きな決断でなければならないのか。",
    "## ギルドの結論",
    `夜の終わりに、レイヴンは短く書き添えた。「${closing}」 ギルド日記は、占いの結果そのものではない。相談の後ろ側で交わされた、小さな整理の記録である。明日また別の問いが届いても、この夜の一行が誰かの足元を少しだけ照らすかもしれない。`,
    "## 関連ページ",
    "ギルドメンバーの役割は[ギルド紹介](/guild/)で確認できます。レイヴン・ブラックウッド本人の占術や考え方は[占術紹介](/divination-methods/)にもまとめています。",
  ].join("\n\n");
  return {
    title,
    slug: `guild-diary-${date}`,
    description: `${date}のギルド日記。レイヴン・ブラックウッドとギルドメンバーが、その日の相談記録から小さな気づきを残します。`,
    body,
    category: "ギルド日記",
    tags: ["ギルド日記", "レイヴン・ブラックウッド", member, "ギルドの日常", "占い師の記録"],
    keyMessage: `今日のギルド日記は「${theme}」。${closing}`,
  };
}

function buildDailyDivinationIntroArticle(date: string) {
  const method = pickDaily([
    { slug: "qimen-dunjia", name: "奇門遁甲", keyword: "方位と時の配置", point: "動くタイミングと進む方角を読む" },
    { slug: "liuren", name: "六壬神課", keyword: "問いの構造", point: "人間関係や状況の絡まりをほどく" },
    { slug: "taiyi", name: "太乙神数", keyword: "大きな時運", point: "時代や局面の流れを俯瞰する" },
    { slug: "yijing", name: "易経", keyword: "変化の物語", point: "今の状態から次の変化を読む" },
    { slug: "wuxing", name: "陰陽五行", keyword: "気の偏りと調和", point: "物事の性質とバランスを整理する" },
  ], date, 23);
  const title = `占術紹介 ${date} - ${method.name}とは`;
  const body = [
    "## 今日の占術",
    `今日取り上げる占術は「${method.name}」です。レイヴン・ブラックウッドの鑑定では、占術を未来を断定する装置としてではなく、状況を分解し、判断の視界を整えるための体系として扱います。${method.name}の中心にあるのは、${method.keyword}です。`,
    "## 何を見るための占術か",
    `${method.name}は、${method.point}ために用いられます。相談者が抱える問いは、恋愛、仕事、人生の選択などさまざまですが、いずれも「今どこに立っているのか」「何を急ぎ、何を待つべきか」を見極めることが重要です。`,
    "## 初心者が押さえる入口",
    "占術を学ぶ時、最初から細かな用語をすべて覚える必要はありません。まずは、その占術が何を地図にしているのかを知ることです。時間を見るのか、方位を見るのか、象意を見るのか、人間関係の配置を見るのか。入口を間違えなければ、古典占術は急に身近になります。",
    "## レイヴンの使い方",
    `レイヴンは${method.name}を、相談者の不安を煽るためではなく、選択肢を落ち着いて並べるために使います。結果を一つの命令として受け取るのではなく、「今は何が強く、何が弱いのか」を確認する。その読み方が、古典占術を現代の相談に生かす鍵になります。`,
    "## 関連ページ",
    `さらに詳しく知りたい場合は、[占術紹介](/divination-methods/)と[古典占術の百科事典](/divination-dictionary/)を確認してください。実際の相談で使う場合は[AIテキスト鑑定](/text-reading/)から問いを整理できます。`,
  ].join("\n\n");
  return {
    title,
    slug: `divination-intro-${method.slug}-${date}`,
    description: `${method.name}の基本的な考え方と、レイヴン・ブラックウッドの鑑定での使い方を紹介します。`,
    body,
    category: "占術紹介",
    tags: ["占術紹介", method.name, "古典占術", "レイヴン・ブラックウッド", "占術解説"],
    keyMessage: `${method.name}は、${method.keyword}を通じて、次の判断を整えるための占術です。`,
  };
}

async function createDailyArticleIfDue(env: Env, autoPublish: boolean, input: {
  seriesId: string;
  draftTime: string;
  publishTime: string;
  article: ReturnType<typeof buildDailyFortuneArticle>;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  targetReader: string;
  outline: string[];
}) {
  const { date, time } = jstParts();
  const currentMinutes = timeToMinutes(time);
  const draftMinutes = timeToMinutes(input.draftTime);
  if (currentMinutes < draftMinutes || currentMinutes > draftMinutes + 45) return 0;
  const idempotencyKey = `daily:${TENANT_ID}:${input.seriesId}:${date}`;
  const existing = await env.DB.prepare("SELECT id FROM blog_engine_articles WHERE tenant_id = ? AND idempotency_key = ? LIMIT 1")
    .bind(TENANT_ID, idempotencyKey)
    .first<{ id: string }>();
  if (existing) return 0;
  const article = input.article;
  const articleId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO blog_engine_articles
      (id, tenant_id, title, slug, description, body, category, tags_json, primary_keyword, secondary_keywords_json,
       search_intent, target_reader, outline_json, seo_title, meta_description, og_title, og_description, faq_json,
       internal_links_json, related_articles_json, key_message, recommended_social_angle, quality_score, brand_score,
       safety_score, quality_report_json, status, scheduled_at, generation_version, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'educational', 92, 96, 98, ?, ?, ?, 'blog-engine-v2.0', ?)`,
  )
    .bind(
      articleId,
      TENANT_ID,
      article.title,
      article.slug,
      article.description,
      article.body,
      article.category,
      JSON.stringify(article.tags),
      input.primaryKeyword,
      JSON.stringify(input.secondaryKeywords),
      input.searchIntent,
      input.targetReader,
      JSON.stringify(input.outline),
      `${article.title} | レイヴン・ブラックウッド Blog`,
      article.description,
      `${article.title} | レイヴン・ブラックウッド Blog`,
      article.description,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      article.keyMessage,
      JSON.stringify({ warnings: [], blocked: false }),
      autoPublish ? "scheduled" : "draft",
      autoPublish ? jstLocalToUtcIso(date, input.publishTime) : null,
      idempotencyKey,
    )
    .run();
  await env.DB.prepare("INSERT INTO blog_engine_events (event_id, event_type, tenant_id, article_id, payload_json) VALUES (?, 'article.created', ?, ?, ?)")
    .bind(crypto.randomUUID(), TENANT_ID, articleId, JSON.stringify({ article_id: articleId, series_id: input.seriesId, draft_time: input.draftTime, publish_time: input.publishTime }))
    .run();
  return 1;
}

async function createDueDailyBlogDraft(env: Env, autoPublish: boolean) {
  const { date } = jstParts();
  let count = 0;
  count += await createDailyArticleIfDue(env, autoPublish, {
    seriesId: "today-fortune",
    draftTime: "07:00",
    publishTime: "07:00",
    article: buildDailyFortuneArticle(date),
    primaryKeyword: "今日の占い",
    secondaryKeywords: ["レイヴン・ブラックウッド 今日の占い", "易断 今日", "一日の運勢"],
    searchIntent: "今日の流れと注意点を短く確認したい",
    targetReader: "朝のうちに一日の判断軸を整えたい読者",
    outline: ["今日の兆し", "仕事と対人運", "恋愛と心の距離", "気をつけること", "今日の一手"],
  });
  count += await createDailyArticleIfDue(env, autoPublish, {
    seriesId: "guild-diary",
    draftTime: "22:00",
    publishTime: "22:00",
    article: buildDailyGuildDiaryArticle(date),
    primaryKeyword: "ギルド日記 レイヴン・ブラックウッド",
    secondaryKeywords: ["レイヴン・ブラックウッド ギルド", "占い師 日記", "ギルドの日常"],
    searchIntent: "レイヴン・ブラックウッドの世界観やギルドの日常を読みたい",
    targetReader: "占い結果だけでなく、レイヴンの世界観や登場人物に親しみたい読者",
    outline: ["夜のギルド", "今日の小さな会話", "レイヴンの記録", "ギルドの結論"],
  });
  count += await createDailyArticleIfDue(env, autoPublish, {
    seriesId: "divination-intro",
    draftTime: "09:00",
    publishTime: "09:00",
    article: buildDailyDivinationIntroArticle(date),
    primaryKeyword: "占術紹介",
    secondaryKeywords: ["古典占術", "占術解説", "レイヴン・ブラックウッド 占術"],
    searchIntent: "古典占術の種類や基本的な使い方を知りたい",
    targetReader: "奇門遁甲・六壬神課・太乙神数・易経などの占術に興味を持ち始めた読者",
    outline: ["今日の占術", "何を見るための占術か", "初心者が押さえる入口", "レイヴンの使い方"],
  });
  return count;
}

async function queueAndPublishBlogSnsPost(env: Env, article: { id: string; slug?: string; title?: string; category?: string; key_message?: string }) {
  const trackingId = `blog-sns:${article.id}:instagram`;
  const existing = await env.DB.prepare("SELECT id FROM sns_posts WHERE tenant_id = ? AND duplicate_warning = ? LIMIT 1")
    .bind(TENANT_ID, trackingId)
    .first<{ id: string }>();
  if (existing) return 0;

  const id = crypto.randomUUID();
  const title = sanitizeText(article.title || "今日の占い", 180);
  const keyMessage = sanitizeText(article.key_message || "今日の流れを整える一手を確認しましょう。", 240);
  const blogUrl = article.slug ? `https://raven.fortunestudios.jp/blog/${article.slug}/` : "https://raven.fortunestudios.jp/blog/";
  const caption = `${title}\n\n${keyMessage}\n\n詳しくはブログ「今日の占い」へ。\n${blogUrl}\n\n#レイヴンブラックウッド #今日の占い #易断 #占い`;
  await env.DB.prepare(
    `INSERT INTO sns_posts
      (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, media_type, media_url, thumbnail_url, status, scheduled_at, ai_generated, duplicate_warning)
      VALUES (?, ?, 'instagram', 'image', ?, ?, ?, 'レイヴン・ブラックウッド', 'ブログ「今日の占い」からSNS導線を作る', '詳しくはブログ「今日の占い」へ。', ?, ?, ?, 'image', ?, ?, 'scheduled', ?, 1, ?)`,
  )
    .bind(
      id,
      TENANT_ID,
      `${title} / Instagram`.slice(0, 180),
      title,
      article.category || "今日の占い",
      caption,
      "#レイヴンブラックウッド #今日の占い #易断 #占い",
      `${title}\n${keyMessage}\nブログへ誘導`,
      "https://raven.fortunestudios.jp/raven-blackwood-cover.png",
      "https://raven.fortunestudios.jp/raven-blackwood-cover.png",
      new Date().toISOString(),
      trackingId,
    )
    .run();
  const post = await env.DB.prepare("SELECT * FROM sns_posts WHERE tenant_id = ? AND id = ? LIMIT 1").bind(TENANT_ID, id).first();
  if (post) await publishSnsPost(env, post as Record<string, unknown>);
  return 1;
}

async function publishDueBlogArticles(env: Env) {
  if (!env.DB) return 0;
  const settings = await env.DB.prepare("SELECT enabled, kill_switch, auto_post_enabled, automation_levels_json FROM blog_engine_settings WHERE tenant_id = ? LIMIT 1")
    .bind(TENANT_ID)
    .first<{ enabled: number; kill_switch: number; auto_post_enabled: number; automation_levels_json: string }>();
  if (!settings?.enabled || settings.kill_switch) return 0;
  const automation = JSON.parse(settings.automation_levels_json || "{}");
  const articleGeneration = automation.article_generation === true;
  const autoPublish = settings.auto_post_enabled === 1 || automation.auto_publish === true;
  if (articleGeneration) await createDueDailyBlogDraft(env, autoPublish);
  if (!autoPublish) return 0;
  const result = await env.DB.prepare(
    "SELECT id, slug, title, category, key_message FROM blog_engine_articles WHERE tenant_id = ? AND status IN ('draft', 'scheduled') AND scheduled_at IS NOT NULL AND datetime(scheduled_at) <= datetime('now') ORDER BY datetime(scheduled_at) ASC LIMIT 20",
  )
    .bind(TENANT_ID)
    .all<{ id: string; slug?: string; title?: string; category?: string; key_message?: string }>();
  let count = 0;
  for (const article of result.results || []) {
    await env.DB.prepare("UPDATE blog_engine_articles SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .bind(TENANT_ID, article.id)
      .run();
    await env.DB.prepare("INSERT INTO blog_engine_events (event_id, event_type, tenant_id, article_id, payload_json) VALUES (?, 'article.published', ?, ?, ?)")
      .bind(crypto.randomUUID(), TENANT_ID, article.id, JSON.stringify({ article_id: article.id, published_by: "worker_cron" }))
      .run();
    await queueAndPublishBlogSnsPost(env, article);
    count += 1;
  }
  return count;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/admin/sns/ping") {
      return json({
        ok: true,
        worker: "raven-oracle",
        tenantId: TENANT_ID,
        version: "sns-engine-raven-2026-08-09",
        instagram: {
          access_token_configured: Boolean(env.INSTAGRAM_ACCESS_TOKEN),
          account_id_configured: Boolean(env.INSTAGRAM_ACCOUNT_ID),
          token: instagramTokenStatus(env),
        },
      });
    }

    if (url.pathname === "/api/analytics/event") {
      return handleAnalyticsEvent(request, env);
    }

    if (url.pathname === "/api/admin/sns/posts" && request.method === "GET") {
      return listSnsPosts(request, env);
    }

    if (url.pathname === "/api/admin/sns/posts" && request.method === "POST") {
      return createSnsPost(request, env);
    }

    if (url.pathname === "/api/admin/sns/status" && request.method === "POST") {
      return updateSnsStatus(request, env);
    }

    if (url.pathname === "/api/admin/sns/publish" && request.method === "POST") {
      return publishSnsNow(request, env);
    }

    if (url.pathname === "/api/admin/sns/metrics-sync") {
      return syncInstagramMetricsNow(request, env);
    }

    if (url.pathname === "/api/sns/templates" && request.method === "GET") {
      return handleSnsTemplateList(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("X-Raven-Worker-Version", "sns-engine-raven-2026-08-09");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      await publishDueBlogArticles(env);
      await publishDueSnsPosts(env);
      await syncInstagramPostMetrics(env);
      await syncSnsEngineToGrowth(env);
    })());
  },
};

export default worker;





