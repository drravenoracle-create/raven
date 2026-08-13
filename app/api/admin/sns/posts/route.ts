import { env } from "cloudflare:workers";
import { findSnsDuplicate, fingerprintSnsContent, type SnsDuplicateCandidate } from "@/app/lib/sns-dedupe";
import { recordCardUsage, selectCards } from "@/app/lib/card-library";

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
  let selectedCardPayload = "";
  let selectedCardsForUsage: { id: string; deck_id: string }[] = [];
  const cardDeckId = clean(body.card_deck_id ?? body.cardDeckId, 120);
  const cardCount = Number(body.card_count ?? body.cardCount ?? 0) || 0;
  if (cardDeckId && cardCount > 0) {
    const selection = await selectCards(env.DB, {
      deck_id: cardDeckId,
      count: Math.min(cardCount, 12),
      selection_mode: clean(body.card_selection_mode ?? body.cardSelectionMode, 40) || "random",
      tag: clean(body.card_tag ?? body.cardTag, 80),
      exclude_recent_days: Number(body.card_exclude_recent_days ?? body.cardExcludeRecentDays ?? 0) || 0,
    }, tenantId);
    selectedCardsForUsage = selection.cards.map((card) => ({ id: card.id, deck_id: card.deck_id }));
    selectedCardPayload = selection.cards.map((card, index) => {
      const name = card.name_ja || card.name;
      const meaning = card.sns_summary || card.upright_meaning || card.love_meaning || card.work_meaning || card.money_meaning;
      return `${index + 1}. ${name}: ${meaning}`;
    }).join("\n");
  }

  const theme = clean(body.theme, 180) || "返信前の文章を整える3つの視点";
  const cta = clean(body.cta, 240) || "必要なら、レイヴン・ブラックウッドのテキスト鑑定で一緒に整理します。";
  const captionBase = clean(body.caption, 2200) || `${theme}\n\n送る前に、気持ち・目的・相手に伝えたいことを分けて見直します。\n\n${cta}\n\n#レイヴンブラックウッド #文章鑑定 #相談整理`;
  const caption = selectedCardPayload ? clean(`${captionBase}\n\n今日のカード\n${selectedCardPayload}`, 2200) : captionBase;
  const title = clean(body.title, 180) || theme;
  const scriptBase = clean(body.script, 4000);
  const script = selectedCardPayload ? clean(`${scriptBase}\n\n[Card Library]\n${selectedCardPayload}`, 4000) : scriptBase;
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
      error: `直近${DUPLICATE_LOOKBACK_DAYS}日以内のSNS投稿と内容が近いため保存を止めました。`,
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
      clean(body.category, 120) || "SNS投稿",
      clean(body.character, 120) || "レイヴン・ブラックウッド",
      clean(body.purpose, 180) || "テキスト鑑定への案内",
      cta,
      caption,
      clean(body.hashtags, 500) || "#レイヴンブラックウッド #文章鑑定 #相談整理",
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
  if (selectedCardsForUsage.length) {
    await recordCardUsage(env.DB, {
      cards: selectedCardsForUsage,
      contentType: "sns_draft",
      snsPlatform: clean(body.platform, 40) || "instagram",
      postId: id,
      selectionMode: clean(body.card_selection_mode ?? body.cardSelectionMode, 40) || "random",
    }, tenantId);
  }
  return Response.json({ ok: true, id, duplicateWarning: duplicate ? { id: duplicate.candidate.id, score: Math.round(duplicate.score * 100) } : null }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
