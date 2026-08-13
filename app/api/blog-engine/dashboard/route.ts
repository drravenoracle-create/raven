import { env } from "cloudflare:workers";

const TENANT_ID = "raven-oracle";

export async function GET() {
  const [settings, guard, counts, latest, recommendations, events, socialContents, growthScores] = await Promise.all([
    env.DB.prepare("SELECT * FROM blog_engine_settings WHERE tenant_id = ? LIMIT 1").bind(TENANT_ID).first(),
    env.DB.prepare("SELECT * FROM blog_engine_optimization_guard WHERE tenant_id = ? LIMIT 1").bind(TENANT_ID).first(),
    env.DB.prepare("SELECT status, COUNT(*) AS count FROM blog_engine_articles WHERE tenant_id = ? GROUP BY status").bind(TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM blog_engine_articles WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM blog_engine_improvement_recommendations WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 200").bind(TENANT_ID).all(),
    env.DB.prepare("SELECT event_type, status, retry_count, last_error, created_at FROM blog_engine_events WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(TENANT_ID).all(),
    env.DB.prepare("SELECT source_article_id, platform, format, angle, status, tracking_id, scheduled_at FROM blog_engine_social_contents WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(TENANT_ID).all(),
    env.DB.prepare("SELECT source_article_id, total_score, data_quality, created_at FROM blog_engine_content_growth_scores WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 10").bind(TENANT_ID).all(),
  ]);
  return Response.json(
    {
      settings,
      guard,
      counts: counts.results || [],
      articles: latest.results || [],
      recommendations: recommendations.results || [],
      events: events.results || [],
      socialContents: socialContents.results || [],
      growthScores: growthScores.results || [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

