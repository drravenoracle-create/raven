import { env } from "cloudflare:workers";
import { fetchExternalAnalyticsMetrics, type ConnectorSyncResult, type ExternalMetric } from "@/app/lib/external-analytics";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";

const SOURCES = new Set(["ga4", "search_console", "cloudflare", "sns_engine"]);

function clean(value: unknown, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function daysFrom(value: unknown) {
  const days = Number(value || 30);
  return [7, 30, 90].includes(days) ? days : 30;
}

async function updateConnector(result: ConnectorSyncResult) {
  const status = result.ok ? "available" : result.configured ? "error" : "not_configured";
  const provider = result.source === "cloudflare" ? "cloudflare_graphql" : result.source === "ga4" ? "google_analytics_data_api" : result.source === "sns_engine" ? "sns_engine" : "google_search_console_api";
  const connectorId = result.source === "search_console" ? "raven-gsc" : result.source === "sns_engine" ? "raven-sns-engine" : `raven-${result.source}`;
  await env.DB.prepare(
    `INSERT INTO growth_data_connectors
      (id, tenant_id, source, provider, enabled, sync_status, last_success_at, last_attempt_at, retry_count, last_error, provider_metadata_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source,
        provider = excluded.provider,
        enabled = excluded.enabled,
        sync_status = excluded.sync_status,
        last_success_at = excluded.last_success_at,
        last_attempt_at = excluded.last_attempt_at,
        retry_count = CASE WHEN excluded.sync_status = 'error' THEN growth_data_connectors.retry_count + 1 ELSE 0 END,
        last_error = excluded.last_error,
        provider_metadata_json = excluded.provider_metadata_json,
        updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(
      connectorId,
      GROWTH_ENGINE_TENANT_ID,
      result.source,
      provider,
      result.ok ? 1 : 0,
      status,
      result.ok ? new Date().toISOString() : null,
      new Date().toISOString(),
      result.ok ? 0 : 1,
      result.error || null,
      JSON.stringify({ source: result.source, configured: result.configured, metric_count: result.metrics.length }),
    )
    .run();
}

async function insertMetric(item: ExternalMetric, runId: string) {
  const idempotencyKey = `${item.source}:${item.entityType}:${item.entityId}:${item.metricName}:${item.windowStart}:${item.windowEnd}`;
  await env.DB.prepare(
    `INSERT OR REPLACE INTO growth_metric_points
      (id, tenant_id, source, entity_type, entity_id, metric_name, metric_value, measured_at, window_start, window_end, data_quality, provider_metadata_json, idempotency_key)
      VALUES (COALESCE((SELECT id FROM growth_metric_points WHERE tenant_id = ? AND idempotency_key = ?), ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      GROWTH_ENGINE_TENANT_ID,
      idempotencyKey,
      crypto.randomUUID(),
      GROWTH_ENGINE_TENANT_ID,
      item.source,
      item.entityType,
      item.entityId,
      item.metricName,
      item.metricValue,
      item.measuredAt,
      item.windowStart,
      item.windowEnd,
      item.dataQuality,
      JSON.stringify({ ...(item.metadata || {}), run_id: runId }),
      idempotencyKey,
    )
    .run();
}

type SnsMetricRow = {
  source: string;
  entityType: string;
  entityId: string;
  metricName: string;
  metricValue: number;
  measuredAt: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  dataQuality: string;
  metadata?: Record<string, unknown>;
};

async function insertSnsMetric(item: SnsMetricRow, runId: string) {
  await insertMetric({
    source: item.source,
    entityType: item.entityType,
    entityId: item.entityId,
    metricName: item.metricName,
    metricValue: item.metricValue,
    measuredAt: item.measuredAt,
    windowStart: item.windowStart || null,
    windowEnd: item.windowEnd || null,
    dataQuality: item.dataQuality,
    metadata: item.metadata || {},
  }, runId);
}

async function syncSnsEngineMetrics(runId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const metrics: SnsMetricRow[] = [];

  const statusRows = await env.DB.prepare(
    "SELECT platform, status, COUNT(*) AS count FROM sns_posts WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) GROUP BY platform, status",
  ).bind(GROWTH_ENGINE_TENANT_ID, since).all<{ platform: string; status: string; count: number }>();
  for (const row of statusRows.results || []) {
    metrics.push({
      source: "sns_engine",
      entityType: "tenant",
      entityId: GROWTH_ENGINE_TENANT_ID,
      metricName: `sns_posts_${row.platform}_${row.status}`,
      metricValue: Number(row.count || 0),
      measuredAt: now,
      windowStart: since,
      windowEnd: now,
      dataQuality: "measured",
      metadata: { platform: row.platform, status: row.status },
    });
  }

  const typeRows = await env.DB.prepare(
    "SELECT platform, post_type, COUNT(*) AS count FROM sns_posts WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) GROUP BY platform, post_type",
  ).bind(GROWTH_ENGINE_TENANT_ID, since).all<{ platform: string; post_type: string; count: number }>();
  for (const row of typeRows.results || []) {
    metrics.push({
      source: "sns_engine",
      entityType: "tenant",
      entityId: GROWTH_ENGINE_TENANT_ID,
      metricName: `sns_posts_${row.platform}_${row.post_type}`,
      metricValue: Number(row.count || 0),
      measuredAt: now,
      windowStart: since,
      windowEnd: now,
      dataQuality: "measured",
      metadata: { platform: row.platform, post_type: row.post_type },
    });
  }

  const logRows = await env.DB.prepare(
    "SELECT platform, action, status, COUNT(*) AS count FROM sns_publish_logs WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) GROUP BY platform, action, status",
  ).bind(GROWTH_ENGINE_TENANT_ID, since).all<{ platform: string; action: string; status: string; count: number }>();
  for (const row of logRows.results || []) {
    metrics.push({
      source: "sns_engine",
      entityType: "tenant",
      entityId: GROWTH_ENGINE_TENANT_ID,
      metricName: `sns_${row.action}_${row.platform}_${row.status}`,
      metricValue: Number(row.count || 0),
      measuredAt: now,
      windowStart: since,
      windowEnd: now,
      dataQuality: "measured",
      metadata: { platform: row.platform, action: row.action, status: row.status },
    });
  }

  const postRows = await env.DB.prepare(
    `SELECT id, platform, post_type, status, title, category, character, ai_generated, retry_count, scheduled_at, published_at, external_post_id, created_at
       FROM sns_posts
      WHERE tenant_id = ? AND datetime(created_at) >= datetime(?)
      ORDER BY datetime(created_at) DESC
      LIMIT 200`,
  ).bind(GROWTH_ENGINE_TENANT_ID, since).all<Record<string, unknown>>();
  for (const post of postRows.results || []) {
    const postId = String(post.id || "");
    if (!postId) continue;
    const metadata = {
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
    };
    metrics.push({
      source: "sns_engine",
      entityType: String(post.post_type || "") === "reel" ? "sns_reel" : "sns_post",
      entityId: postId,
      metricName: `status_${String(post.status || "unknown")}`,
      metricValue: 1,
      measuredAt: String(post.published_at || post.created_at || now),
      windowStart: since,
      windowEnd: now,
      dataQuality: "measured",
      metadata,
    });
  }

  const socialMetricRows = await env.DB.prepare(
    `SELECT post_id, impressions, reach, likes, comments, saves, shares, plays, watch_time, profile_visits, link_clicks, follower_delta, fetched_at
       FROM sns_metrics
      WHERE tenant_id = ? AND datetime(fetched_at) >= datetime(?)
      ORDER BY datetime(fetched_at) DESC
      LIMIT 500`,
  ).bind(GROWTH_ENGINE_TENANT_ID, since).all<Record<string, unknown>>();
  const metricNames = ["impressions", "reach", "likes", "comments", "saves", "shares", "plays", "watch_time", "profile_visits", "link_clicks", "follower_delta"];
  for (const row of socialMetricRows.results || []) {
    for (const name of metricNames) {
      if (row[name] === null || row[name] === undefined) continue;
      metrics.push({
        source: "instagram",
        entityType: "sns_post",
        entityId: String(row.post_id || ""),
        metricName: name,
        metricValue: Number(row[name] || 0),
        measuredAt: String(row.fetched_at || now),
        windowStart: since,
        windowEnd: now,
        dataQuality: "api_or_manual",
        metadata: { synced_by: "sns_engine" },
      });
    }
  }

  for (const metric of metrics) await insertSnsMetric(metric, runId);

  await updateConnector({
    source: "sns_engine",
    configured: true,
    ok: true,
    metrics: metrics.map((metric) => ({
      source: metric.source,
      entityType: metric.entityType,
      entityId: metric.entityId,
      metricName: metric.metricName,
      metricValue: metric.metricValue,
      measuredAt: metric.measuredAt,
      windowStart: metric.windowStart || null,
      windowEnd: metric.windowEnd || null,
      dataQuality: metric.dataQuality,
      metadata: metric.metadata,
    })),
  });
  return metrics.length;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const days = daysFrom(body.days);
  const only = clean(body.source, 80);
  const runId = crypto.randomUUID();

  const includeExternal = !only || only !== "sns_engine";
  const results = includeExternal ? await fetchExternalAnalyticsMetrics(env, days) : [];
  const selected = only && SOURCES.has(only) ? results.filter((result) => result.source === only) : results;
  for (const result of selected) {
    await updateConnector(result);
    for (const item of result.metrics) await insertMetric(item, runId);
  }
  const snsMetrics = (!only || only === "sns_engine") ? await syncSnsEngineMetrics(runId, days) : 0;

  const totalMetrics = selected.reduce((sum, result) => sum + result.metrics.length, 0) + snsMetrics;
  await env.DB.prepare("INSERT OR IGNORE INTO growth_events (event_id, tenant_id, event_type, source_engine, entity_refs_json, payload_json, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(runId, GROWTH_ENGINE_TENANT_ID, "external_analytics.synced", "growth_engine", JSON.stringify({ sources: selected.map((item) => item.source) }), JSON.stringify({ days, total_metrics: totalMetrics, results: selected }), `external-sync:${runId}`)
    .run();

  return Response.json({ ok: true, runId, days, metrics: totalMetrics, snsMetrics, results: selected }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const connectors = await env.DB.prepare("SELECT source, provider, enabled, sync_status, last_success_at, last_attempt_at, retry_count, last_error FROM growth_data_connectors WHERE tenant_id = ? AND source IN ('ga4','search_console','cloudflare','sns_engine','sns') ORDER BY source")
    .bind(GROWTH_ENGINE_TENANT_ID)
    .all();
  return Response.json({ connectors: connectors.results || [] }, { headers: { "Cache-Control": "no-store" } });
}





