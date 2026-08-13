/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_ACCOUNT_ID?: string;
  SNS_PROVIDER_MODE?: string;
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

function toIsoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
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

async function readJson(request: Request) {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}

async function ensureSnsTenant(body: Record<string, unknown> | null) {
  const tenantId = sanitizeText(body?.tenant_id ?? body?.tenantId, 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) throw new Error("Invalid tenant_id");
  return tenantId;
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

  await env.DB.prepare(
    `INSERT INTO analytics_events
      (id, created_at, tenant_id, event_name, page_path, page_title, referrer, referrer_host,
       source, medium, campaign, link_url, link_text, visitor_hash, user_agent)
      VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  return error?.code === 190 || error?.type === "OAuthException";
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

async function createDueDailySnsPost(env: Env, scheduleJson: unknown) {
  const { date, time } = jstParts();
  const schedule = parseSnsSchedule(scheduleJson);
  const window = schedule.windows.find((item) => time >= item.start && time <= item.end);
  if (!window) return 0;

  const idempotencyKey = `daily-sns:${TENANT_ID}:${date}:${window.start}`;
  const existing = await env.DB.prepare("SELECT id FROM sns_posts WHERE tenant_id = ? AND duplicate_warning = ? LIMIT 1")
    .bind(TENANT_ID, idempotencyKey)
    .first<{ id: string }>();
  if (existing) return 0;

  const id = crypto.randomUUID();
  const title = `今日のレイヴン・ブラックウッド鑑定メモ ${date}`;
  const theme = time < "07:00" ? "夜明け前に整える、今日の判断" : "午後に見直す、迷いのほどき方";
  const cta = "詳しく整理したい時は、レイヴン・ブラックウッドのAIテキスト鑑定へ。";
  const caption = `${theme}\n\n急いで答えを決める前に、気持ち・状況・本当に知りたいことを分けて見直します。\n\n${cta}\n\n#レイヴンブラックウッド #占い #文章鑑定 #相談整理`;

  await env.DB.prepare(
    `INSERT INTO sns_posts
      (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, media_type, media_url, thumbnail_url, status, scheduled_at, ai_generated, duplicate_warning)
      VALUES (?, ?, 'instagram', 'image', ?, ?, '自動投稿', 'レイヴン・ブラックウッド', 'AIテキスト鑑定への案内', ?, ?, ?, ?, 'image', ?, ?, 'scheduled', ?, 1, ?)`,
  )
    .bind(
      id,
      TENANT_ID,
      title,
      theme,
      cta,
      caption,
      "#レイヴンブラックウッド #占い #文章鑑定 #相談整理",
      `0-5秒: ${theme}\n5-15秒: 迷いを気持ち、状況、問いに分ける\n15-25秒: 今日決めることと保留することを分ける\n25-30秒: ${cta}`,
      "https://raven.fortunestudios.jp/raven-blackwood-cover.png",
      "https://raven.fortunestudios.jp/raven-blackwood-cover.png",
      new Date().toISOString(),
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
  if (!isInSnsPublishWindow(settings.schedule_json)) return 0;
  await createDueDailySnsPost(env, settings.schedule_json);
  const result = await env.DB.prepare(
    "SELECT * FROM sns_posts WHERE tenant_id = ? AND status = 'scheduled' AND scheduled_at IS NOT NULL AND datetime(scheduled_at) <= datetime('now') AND retry_count < 3 LIMIT 10",
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

function buildDailyHomepageArticle(date: string) {
  const title = "占い師がホームページを持つメリット";
  const body = [
    "## SNSだけでは残りにくい情報",
    "占い師の発信はSNSでも届きます。けれどSNSは流れが速く、料金、鑑定方針、得意な相談内容、予約方法のような大事な情報が、過去投稿の中に埋もれやすい場所でもあります。",
    "ホームページは、その流れてしまう情報を落ち着いて置いておける拠点です。初めて来た人が、占い師の雰囲気や相談できる内容を一度で確認できます。",
    "## 相談前の不安を減らす役割",
    "相談者は、申し込む前に多くの小さな不安を抱えています。どんな人が鑑定するのか。料金はいくらか。相談してよい内容なのか。強く売り込まれないか。",
    "ホームページに基本情報が整理されていると、その不安を一つずつ減らせます。これは派手な宣伝ではなく、相談者が安心して判断するための土台です。",
    "## 予約までの道筋を整える",
    "SNSで興味を持っても、次に何をすればよいか分からなければ、相談者はそこで止まります。プロフィール、鑑定メニュー、注意事項、予約ボタンが同じ場所にあるだけで、行動の迷いはかなり減ります。",
    "占い師側にとっても、毎回同じ説明を繰り返す負担が減ります。事前に読んでほしいことをページに置けるからです。",
    "## レイヴン・ブラックウッドでの考え方",
    "レイヴン・ブラックウッドでは、ホームページを単なる看板ではなく、相談者が自分のペースで確かめるための静かな受付として考えます。SNSで出会い、ブログで理解し、必要な人だけが鑑定へ進む。",
    "その流れが整うほど、占い師の言葉は一度きりの投稿ではなく、長く働く案内になります。",
  ].join("\n\n");
  return {
    title,
    slug: `fortune-teller-website-benefits-${date}`,
    description: "占い師がホームページを持つことで、信頼情報、予約導線、ブログ資産をどう整えられるかを解説します。",
    body,
    category: "占い師がホームページを持つメリット",
    tags: ["占い師", "ホームページ", "集客", "レイヴン・ブラックウッド", "Fortune Studio"],
    keyMessage: "ホームページは占い師の情報を一か所に整え、相談者が安心して判断するための拠点になる。",
  };
}

async function createDueDailyBlogDraft(env: Env, autoPublish: boolean) {
  const { date, time } = jstParts();
  if (time < "13:00") return 0;
  const idempotencyKey = `daily:${TENANT_ID}:homepage-benefits:${date}`;
  const existing = await env.DB.prepare("SELECT id FROM blog_engine_articles WHERE tenant_id = ? AND idempotency_key = ? LIMIT 1")
    .bind(TENANT_ID, idempotencyKey)
    .first<{ id: string }>();
  if (existing) return 0;
  const article = buildDailyHomepageArticle(date);
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
      "占い師 ホームページ メリット",
      JSON.stringify(["占い師 集客", "占い師 ブログ", "予約導線"]),
      "占い師としてホームページを持つ実務的な利点を知りたい",
      "SNS発信だけに限界を感じている占い師・個人鑑定者",
      JSON.stringify(["SNSだけでは残りにくい情報", "相談前の不安を減らす役割", "予約までの道筋を整える", "レイヴン・ブラックウッドでの考え方"]),
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
      autoPublish ? jstLocalToUtcIso(date, "17:00") : null,
      idempotencyKey,
    )
    .run();
  await env.DB.prepare("INSERT INTO blog_engine_events (event_id, event_type, tenant_id, article_id, payload_json) VALUES (?, 'article.created', ?, ?, ?)")
    .bind(crypto.randomUUID(), TENANT_ID, articleId, JSON.stringify({ article_id: articleId, series_id: "homepage-benefits", draft_time: "13:00", publish_time: "17:00" }))
    .run();
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
    "SELECT id FROM blog_engine_articles WHERE tenant_id = ? AND status IN ('draft', 'scheduled') AND scheduled_at IS NOT NULL AND datetime(scheduled_at) <= datetime('now') ORDER BY datetime(scheduled_at) ASC LIMIT 20",
  )
    .bind(TENANT_ID)
    .all<{ id: string }>();
  let count = 0;
  for (const article of result.results || []) {
    await env.DB.prepare("UPDATE blog_engine_articles SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .bind(TENANT_ID, article.id)
      .run();
    await env.DB.prepare("INSERT INTO blog_engine_events (event_id, event_type, tenant_id, article_id, payload_json) VALUES (?, 'article.published', ?, ?, ?)")
      .bind(crypto.randomUUID(), TENANT_ID, article.id, JSON.stringify({ article_id: article.id, published_by: "worker_cron" }))
      .run();
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
      return json({ ok: true, worker: "raven-oracle", tenantId: TENANT_ID, version: "sns-engine-raven-2026-08-09" });
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
    ctx.waitUntil(Promise.all([publishDueSnsPosts(env), publishDueBlogArticles(env)]));
  },
};

export default worker;





