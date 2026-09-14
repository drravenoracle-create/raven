import { env } from "cloudflare:workers";
import { buildCalendarSocial, buildDailyAlmanac } from "@/app/lib/calendar/daily-almanac";
import { getAdminSession, isAdminEmail } from "@/app/lib/google-admin-auth";

const TENANT_ID = "raven-oracle";
function todayJst() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || !isAdminEmail(session.email)) return Response.json({ error: "Admin authentication required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const localDate = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJst();
  const almanac = buildDailyAlmanac(localDate, TENANT_ID);
  const social = buildCalendarSocial(almanac, "carousel");
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO sns_posts (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, media_type, media_url, thumbnail_url, status, duplicate_warning, ai_generated) VALUES (?, ?, 'instagram', 'carousel', ?, ?, '今日の暦', 'レイヴン・ブラックウッド', '正規の今日の暦生成フロー', '詳しい鑑定はプロフィールへ', ?, ?, ?, 'image', ?, ?, 'draft', ?, 0)`).bind(id, TENANT_ID, `今日の暦｜${localDate}`, almanac.theme, social.caption, "#レイヴンブラックウッド #今日の暦 #六曜 #干支 #五行 #占い", social.script, "https://raven.fortunestudios.jp/raven-blackwood-cover.png", "https://raven.fortunestudios.jp/raven-blackwood-cover.png", `daily-calendar:${localDate}`).run();
  return Response.json({ ok: true, id, localDate, almanac, social }, { status: 201 });
}
