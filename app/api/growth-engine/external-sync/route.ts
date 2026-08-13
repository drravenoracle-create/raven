import { env } from "cloudflare:workers";
import { fetchExternalAnalyticsMetrics, type ConnectorSyncResult, type ExternalMetric } from "@/app/lib/external-analytics";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";

const SOURCES = new Set(["ga4", "search_console", "cloudflare"]);

function clean(value: unknown, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function daysFrom(value: unknown) {
  const days = Number(value || 30);
  return [7, 30, 90].includes(days) ? days : 30;
}

async function updateConnector(result: ConnectorSyncResult) {
  const status = result.ok ? "available" : result.configured ? "error" : "not_configured";
  const provider = result.source === "cloudflare" ? "cloudflare_graphql" : result.source === "ga4" ? "google_analytics_data_api" : "google_search_console_api";
  const connectorId = result.source === "search_console" ? "raven-gsc" : `raven-${result.source}`;
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const days = daysFrom(body.days);
  const only = clean(body.source, 80);
  const runId = crypto.randomUUID();

  const results = await fetchExternalAnalyticsMetrics(env, days);
  const selected = only && SOURCES.has(only) ? results.filter((result) => result.source === only) : results;
  for (const result of selected) {
    await updateConnector(result);
    for (const item of result.metrics) await insertMetric(item, runId);
  }

  const totalMetrics = selected.reduce((sum, result) => sum + result.metrics.length, 0);
  await env.DB.prepare("INSERT OR IGNORE INTO growth_events (event_id, tenant_id, event_type, source_engine, entity_refs_json, payload_json, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(runId, GROWTH_ENGINE_TENANT_ID, "external_analytics.synced", "growth_engine", JSON.stringify({ sources: selected.map((item) => item.source) }), JSON.stringify({ days, total_metrics: totalMetrics, results: selected }), `external-sync:${runId}`)
    .run();

  return Response.json({ ok: true, runId, days, metrics: totalMetrics, results: selected }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const connectors = await env.DB.prepare("SELECT source, provider, enabled, sync_status, last_success_at, last_attempt_at, retry_count, last_error FROM growth_data_connectors WHERE tenant_id = ? AND source IN ('ga4','search_console','cloudflare') ORDER BY source")
    .bind(GROWTH_ENGINE_TENANT_ID)
    .all();
  return Response.json({ connectors: connectors.results || [] }, { headers: { "Cache-Control": "no-store" } });
}





