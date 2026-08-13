import { env } from "cloudflare:workers";
import { BLOG_ENGINE_TENANT_ID, calculatePerformanceScore } from "@/app/lib/blog-engine";

function num(value: unknown) {
  return Number(value || 0);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = String(body.tenant_id ?? body.tenantId ?? BLOG_ENGINE_TENANT_ID);
  if (tenantId !== BLOG_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const articleId = String(body.article_id ?? body.articleId ?? "");
  if (!articleId) return Response.json({ error: "article_id is required" }, { status: 400 });
  const performanceScore = calculatePerformanceScore({
    pageViews: num(body.page_views),
    users: num(body.users),
    organicTraffic: num(body.organic_traffic),
    socialReferral: num(body.social_referral),
    ctr: num(body.ctr),
    ctaClicks: num(body.cta_clicks),
    conversions: num(body.conversion_events),
    articleAgeDays: num(body.article_age_days),
  });
  await env.DB.prepare(
    `INSERT INTO blog_engine_article_metrics
      (id, tenant_id, article_id, period_start, period_end, page_views, users, sessions, organic_traffic, social_referral,
       search_impressions, search_clicks, ctr, average_engagement_time, cta_clicks, conversion_events, performance_score,
       score_breakdown_json, data_quality, sample_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      tenantId,
      articleId,
      String(body.period_start || new Date().toISOString().slice(0, 10)),
      String(body.period_end || new Date().toISOString().slice(0, 10)),
      num(body.page_views),
      num(body.users),
      num(body.sessions),
      num(body.organic_traffic),
      num(body.social_referral),
      num(body.search_impressions),
      num(body.search_clicks),
      num(body.ctr),
      num(body.average_engagement_time),
      num(body.cta_clicks),
      num(body.conversion_events),
      performanceScore,
      JSON.stringify({ method: "weighted_v2", provisional: num(body.sample_size) < 30 }),
      num(body.sample_size) < 30 ? "provisional" : "sufficient",
      num(body.sample_size),
    )
    .run();
  return Response.json({ ok: true, performanceScore });
}
