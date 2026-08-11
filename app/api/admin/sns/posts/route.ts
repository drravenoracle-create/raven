import { env } from "cloudflare:workers";
import { findSnsDuplicate, fingerprintSnsContent, type SnsDuplicateCandidate } from "@/app/lib/sns-dedupe";

const TENANT_ID = "raven-oracle";
const DUPLICATE_LOOKBACK_DAYS = 45;
const DEFAULT_SCHEDULE = { windows: [{ start: "01:00", end: "07:00" }, { start: "13:00", end: "17:00" }] };

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function assertTenant(value: unknown) {
  const tenantId = clean(value, 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) throw new Error("Invalid tenant_id");
  return tenantId;
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

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00+09:00`);
  next.setUTCDate(next.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(next);
}

function parseSchedule(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "");
    if (Array.isArray(parsed?.windows) && parsed.windows.length) return parsed as typeof DEFAULT_SCHEDULE;
  } catch {}
  return DEFAULT_SCHEDULE;
}

async function nextSnsScheduledAt(tenantId: string) {
  const settings = await env.DB.prepare("SELECT schedule_json FROM sns_automation_settings WHERE tenant_id = ? LIMIT 1")
    .bind(tenantId)
    .first<{ schedule_json?: string }>()
    .catch(() => null);
  const schedule = parseSchedule(settings?.schedule_json);
  const { date, time } = jstParts();
  const windows = [...schedule.windows].sort((a, b) => a.start.localeCompare(b.start));
  const current = windows.find((window) => time >= window.start && time <= window.end);
  if (current) return jstLocalToUtcIso(date, time);
  const later = windows.find((window) => time < window.start);
  if (later) return jstLocalToUtcIso(date, later.start);
  return jstLocalToUtcIso(addDays(date, 1), windows[0]?.start || "01:00");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  let tenantId = TENANT_ID;
  try {
    tenantId = assertTenant(url.searchParams.get("tenantId"));
  } catch {
    return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  }
  const result = await env.DB.prepare("SELECT * FROM sns_posts WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 100")
    .bind(tenantId)
    .all();
  const settings = await env.DB.prepare("SELECT automation_level, emergency_stop_all, min_post_interval_minutes, schedule_json FROM sns_automation_settings WHERE tenant_id = ? LIMIT 1")
    .bind(tenantId)
    .first()
    .catch(() => null);
  return Response.json({ posts: result.results || [], settings: settings || null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });

  let tenantId = TENANT_ID;
  try {
    tenantId = assertTenant(body.tenant_id ?? body.tenantId);
  } catch {
    return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const theme = clean(body.theme, 180) || "\u8fd4\u4fe1\u524d\u306e\u6587\u7ae0\u3092\u6574\u3048\u308b3\u3064\u306e\u8996\u70b9";
  const cta = clean(body.cta, 240) || "\u5fc5\u8981\u306a\u3089\u3001Raven Blackwood\u306e\u30c6\u30ad\u30b9\u30c8\u9451\u5b9a\u3067\u4e00\u7dd2\u306b\u6574\u7406\u3057\u307e\u3059\u3002";
  const caption = clean(body.caption, 2200) || `${theme}\n\n\u9001\u308b\u524d\u306b\u3001\u6c17\u6301\u3061\u30fb\u76ee\u7684\u30fb\u76f8\u624b\u306b\u4f1d\u3048\u305f\u3044\u3053\u3068\u3092\u5206\u3051\u3066\u898b\u76f4\u3057\u307e\u3059\u3002\n\n${cta}\n\n#RavenBlackwood #\u30ec\u30a4\u30f4\u30f3\u30d6\u30e9\u30c3\u30af\u30a6\u30c3\u30c9 #\u6587\u7ae0\u9451\u5b9a #\u76f8\u8ac7\u6574\u7406`;
  const title = clean(body.title, 180) || theme;
  const script = clean(body.script, 4000);
  const status = clean(body.status, 40) || "draft";
  const requestedScheduledAt = clean(body.scheduled_at ?? body.scheduledAt, 80);
  const scheduledAt = status === "scheduled" && !requestedScheduledAt ? await nextSnsScheduledAt(tenantId) : requestedScheduledAt;
  const allowDuplicate = body.allow_duplicate === true || body.allowDuplicate === true;
  const fingerprint = await fingerprintSnsContent({ title, theme, caption, script });
  const recent = await env.DB.prepare(
    `SELECT id, title, theme, caption, script, duplicate_warning, created_at
      FROM sns_posts
      WHERE tenant_id = ?
        AND status IN ('draft','scheduled','published')
        AND datetime(created_at) >= datetime('now', ?)
      ORDER BY datetime(created_at) DESC
      LIMIT 80`,
  )
    .bind(tenantId, `-${DUPLICATE_LOOKBACK_DAYS} days`)
    .all<SnsDuplicateCandidate>();
  const duplicate = findSnsDuplicate({ title, theme, caption, script, fingerprint }, recent.results || []);

  if (duplicate && !allowDuplicate) {
    return Response.json({
      error: `\u76f4\u8fd1${DUPLICATE_LOOKBACK_DAYS}\u65e5\u4ee5\u5185\u306eSNS\u6295\u7a3f\u3068\u5185\u5bb9\u304c\u8fd1\u3044\u305f\u3081\u4fdd\u5b58\u3092\u6b62\u3081\u307e\u3057\u305f\u3002`,
      duplicate: true,
      duplicatePost: {
        id: duplicate.candidate.id,
        title: duplicate.candidate.title,
        created_at: duplicate.candidate.created_at,
        score: Math.round(duplicate.score * 100),
        reason: duplicate.reason,
      },
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  await env.DB.prepare(
    `INSERT INTO sns_posts
      (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, media_type, media_url, thumbnail_url, status, scheduled_at, ai_generated, duplicate_warning)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      tenantId,
      clean(body.platform, 40) || "instagram",
      clean(body.post_type ?? body.postType, 40) || "carousel",
      title,
      theme,
      clean(body.category, 120) || "SNS\u6295\u7a3f",
      clean(body.character, 120) || "Raven Blackwood",
      clean(body.purpose, 180) || "\u30c6\u30ad\u30b9\u30c8\u9451\u5b9a\u3078\u306e\u6848\u5185",
      cta,
      caption,
      clean(body.hashtags, 500) || "#RavenBlackwood #\u30ec\u30a4\u30f4\u30f3\u30d6\u30e9\u30c3\u30af\u30a6\u30c3\u30c9 #\u6587\u7ae0\u9451\u5b9a #\u76f8\u8ac7\u6574\u7406",
      script,
      clean(body.media_type ?? body.mediaType, 40),
      clean(body.media_url ?? body.mediaUrl, 1000),
      clean(body.thumbnail_url ?? body.thumbnailUrl, 1000),
      status,
      scheduledAt,
      1,
      duplicate ? `allowed_duplicate:${duplicate.candidate.id}:${Math.round(duplicate.score * 100)}` : `fingerprint:${fingerprint}`,
    )
    .run();
  return Response.json({ ok: true, id, duplicateWarning: duplicate ? { id: duplicate.candidate.id, score: Math.round(duplicate.score * 100) } : null }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
