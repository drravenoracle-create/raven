import { env } from "cloudflare:workers";

const TENANT_ID = "raven-oracle";

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

async function fetchInstagramInsights(externalPostId: string, postType: string) {
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

async function upsertGrowthMetric(input: {
  source: string;
  entityType: string;
  entityId: string;
  metricName: string;
  metricValue: number;
  measuredAt: string;
  windowStart: string;
  windowEnd: string;
  metadata?: Record<string, unknown>;
}) {
  const idempotencyKey = `${input.source}:${input.entityType}:${input.entityId}:${input.metricName}:${input.windowStart}:${input.windowEnd}`;
  await env.DB.prepare(
    `INSERT OR REPLACE INTO growth_metric_points
      (id, tenant_id, source, entity_type, entity_id, metric_name, metric_value, measured_at, window_start, window_end, data_quality, provider_metadata_json, idempotency_key)
      VALUES (COALESCE((SELECT id FROM growth_metric_points WHERE tenant_id = ? AND idempotency_key = ?), ?), ?, ?, ?, ?, ?, ?, ?, ?, 'measured', ?, ?)`,
  )
    .bind(TENANT_ID, idempotencyKey, crypto.randomUUID(), TENANT_ID, input.source, input.entityType, input.entityId, input.metricName, input.metricValue, input.measuredAt, input.windowStart, input.windowEnd, JSON.stringify(input.metadata || {}), idempotencyKey)
    .run();
}

async function syncSnsMetricsToGrowth() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(
    `SELECT m.post_id, p.post_type, p.title, p.category, p.character, p.external_post_id,
            m.impressions, m.reach, m.likes, m.comments, m.saves, m.shares, m.plays, m.watch_time,
            m.profile_visits, m.link_clicks, m.follower_delta, m.fetched_at
       FROM sns_metrics m
       LEFT JOIN sns_posts p ON p.tenant_id = m.tenant_id AND p.id = m.post_id
      WHERE m.tenant_id = ? AND datetime(m.fetched_at) >= datetime(?)
      ORDER BY datetime(m.fetched_at) DESC
      LIMIT 500`,
  ).bind(TENANT_ID, since).all<Record<string, unknown>>();
  const metricNames = ["impressions", "reach", "likes", "comments", "saves", "shares", "plays", "watch_time", "profile_visits", "link_clicks", "follower_delta"];
  let count = 0;
  for (const row of rows.results || []) {
    for (const name of metricNames) {
      if (row[name] === null || row[name] === undefined) continue;
      await upsertGrowthMetric({
        source: "instagram",
        entityType: String(row.post_type || "") === "reel" ? "sns_reel" : "sns_post",
        entityId: String(row.post_id || ""),
        metricName: name,
        metricValue: Number(row[name] || 0),
        measuredAt: String(row.fetched_at || now),
        windowStart: since,
        windowEnd: now,
        metadata: {
          title: row.title,
          category: row.category,
          character: row.character,
          external_post_id: row.external_post_id,
        },
      });
      count += 1;
    }
  }
  return count;
}

export async function POST() {
  try {
    if (!env.INSTAGRAM_ACCESS_TOKEN) {
      return Response.json({ ok: false, error: "Instagram API is not configured." }, { status: 400 });
    }
    const posts = await env.DB.prepare(
      `SELECT id, external_post_id, post_type, media_type
         FROM sns_posts
        WHERE tenant_id = ? AND platform = 'instagram' AND status = 'published'
          AND external_post_id IS NOT NULL AND external_post_id != ''
        ORDER BY datetime(published_at) DESC
        LIMIT 3`,
    ).bind(TENANT_ID).all<{ id: string; external_post_id: string; post_type: string; media_type: string }>();

    let syncedPosts = 0;
    let failedPosts = 0;
    for (const post of posts.results || []) {
      const result = await fetchInstagramInsights(post.external_post_id, post.post_type || post.media_type || "image");
      if (!result.ok || !("metrics" in result)) {
        failedPosts += 1;
        await env.DB.prepare(
          "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message) VALUES (?, ?, ?, 'instagram', 'metrics_sync', 'failed', 502, ?, ?)",
        )
          .bind(crypto.randomUUID(), TENANT_ID, post.id, JSON.stringify(result), String(result.error || "Instagram insights sync failed"))
          .run();
        continue;
      }
      const metrics = result.metrics;
      await env.DB.prepare(
        `INSERT INTO sns_metrics
          (id, tenant_id, post_id, impressions, reach, likes, comments, saves, shares, plays, watch_time, profile_visits, link_clicks, follower_delta, fetched_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      )
        .bind(crypto.randomUUID(), TENANT_ID, post.id, metrics.impressions, metrics.reach, metrics.likes, metrics.comments, metrics.saves, metrics.shares, metrics.plays, metrics.watch_time, metrics.profile_visits, metrics.link_clicks, metrics.follower_delta)
        .run();
      await env.DB.prepare(
        "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body) VALUES (?, ?, ?, 'instagram', 'metrics_sync', 'success', 200, ?)",
      )
        .bind(crypto.randomUUID(), TENANT_ID, post.id, JSON.stringify({ external_post_id: post.external_post_id, metrics }))
        .run();
      syncedPosts += 1;
    }

    const growthMetrics = await syncSnsMetricsToGrowth();
    return Response.json({ ok: true, checkedPosts: posts.results?.length || 0, syncedPosts, failedPosts, growthMetrics }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
