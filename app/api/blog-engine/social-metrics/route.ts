import { env } from "cloudflare:workers";
import { BLOG_ENGINE_TENANT_ID, calculateContentGrowthScore } from "@/app/lib/blog-engine";

function num(value: unknown) {
  return Number(value || 0);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = String(body.tenant_id ?? body.tenantId ?? BLOG_ENGINE_TENANT_ID);
  if (tenantId !== BLOG_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const socialContentId = String(body.social_content_id ?? body.socialContentId ?? "");
  const articleId = String(body.source_article_id ?? body.article_id ?? body.articleId ?? "");
  const platform = String(body.platform ?? "");
  if (!socialContentId || !articleId || !platform) return Response.json({ error: "social_content_id, source_article_id, and platform are required" }, { status: 400 });

  const sampleSize = num(body.sample_size || body.impressions || body.reach || body.views);
  const attributionType = ["direct", "assisted", "unknown"].includes(String(body.attribution_type)) ? String(body.attribution_type) : "unknown";

  await env.DB.prepare(
    `INSERT INTO blog_engine_social_metrics
      (id, tenant_id, social_content_id, source_article_id, platform, impressions, reach, views, likes, comments, shares, saves,
       profile_actions, link_clicks, ctr, video_watch_seconds, follower_delta, referral_sessions, conversion_events,
       attribution_type, data_quality, sample_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      tenantId,
      socialContentId,
      articleId,
      platform,
      num(body.impressions),
      num(body.reach),
      num(body.views),
      num(body.likes),
      num(body.comments),
      num(body.shares),
      num(body.saves),
      num(body.profile_actions),
      num(body.link_clicks),
      num(body.ctr),
      num(body.video_watch_seconds),
      num(body.follower_delta),
      num(body.referral_sessions),
      num(body.conversion_events),
      attributionType,
      sampleSize < 30 ? "provisional" : "sufficient",
      sampleSize,
    )
    .run();

  const socialScore = Math.min((num(body.reach) + num(body.impressions) + num(body.views)) / 50, 100);
  const engagementScore = Math.min((num(body.likes) + num(body.comments) * 3 + num(body.saves) * 4 + num(body.shares) * 3) * 2, 100);
  const conversionScore = Math.min((num(body.link_clicks) + num(body.conversion_events) * 5) * 3, 100);
  const totalScore = calculateContentGrowthScore({
    socialScore,
    engagementScore,
    conversionScore,
    freshnessScore: 80,
    growthVelocity: sampleSize >= 30 ? 50 : 10,
  });

  await env.DB.prepare(
    `INSERT INTO blog_engine_content_growth_scores
      (id, tenant_id, source_article_id, social_score, engagement_score, conversion_score, freshness_score, growth_velocity, total_score, score_breakdown_json, data_quality)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      tenantId,
      articleId,
      socialScore,
      engagementScore,
      conversionScore,
      80,
      sampleSize >= 30 ? 50 : 10,
      totalScore,
      JSON.stringify({ source: "social_metrics", attribution_type: attributionType, provisional: sampleSize < 30 }),
      sampleSize < 30 ? "provisional" : "sufficient",
    )
    .run();

  await env.DB.prepare("INSERT INTO blog_engine_events (event_id, event_type, tenant_id, article_id, payload_json, status) VALUES (?, ?, ?, ?, ?, 'processed')")
    .bind(
      crypto.randomUUID(),
      "social.performance.updated",
      tenantId,
      articleId,
      JSON.stringify({ social_content_id: socialContentId, platform, attribution_type: attributionType, sample_size: sampleSize, content_growth_score: totalScore }),
    )
    .run();

  return Response.json({ ok: true, contentGrowthScore: totalScore, dataQuality: sampleSize < 30 ? "provisional" : "sufficient" });
}
