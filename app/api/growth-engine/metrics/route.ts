import { env } from "cloudflare:workers";
import { GROWTH_ENGINE_TENANT_ID, buildGrowthEvent } from "@/app/lib/growth-engine";

function clean(value: unknown, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const source = clean(body.source, 80);
  const entityType = clean(body.entity_type ?? body.entityType, 80);
  const entityId = clean(body.entity_id ?? body.entityId, 160);
  const metricName = clean(body.metric_name ?? body.metricName, 120);
  if (!source || !entityType || !entityId || !metricName) return Response.json({ error: "source, entity_type, entity_id, and metric_name are required" }, { status: 400 });
  const idempotencyKey = clean(body.idempotency_key ?? `${source}:${entityType}:${entityId}:${metricName}:${body.measured_at || ""}`, 240);

  await env.DB.prepare(
    `INSERT OR IGNORE INTO growth_metric_points
      (id, tenant_id, source, entity_type, entity_id, metric_name, metric_value, measured_at, window_start, window_end, data_quality, provider_metadata_json, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      tenantId,
      source,
      entityType,
      entityId,
      metricName,
      Number(body.metric_value ?? body.metricValue ?? 0),
      clean(body.measured_at ?? new Date().toISOString(), 40),
      clean(body.window_start, 40) || null,
      clean(body.window_end, 40) || null,
      clean(body.data_quality, 40) || "partial",
      JSON.stringify(body.provider_metadata || {}),
      idempotencyKey,
    )
    .run();

  const event = buildGrowthEvent({ eventType: "analytics.synced", sourceEngine: "growth_engine", entityRefs: { entity_type: entityType, entity_id: entityId }, idempotencyKey: `event:${idempotencyKey}` });
  await env.DB.prepare("INSERT OR IGNORE INTO growth_events (event_id, tenant_id, event_type, source_engine, entity_refs_json, payload_json, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(event.eventId, tenantId, event.eventType, event.sourceEngine, JSON.stringify(event.entityRefs), JSON.stringify(event.payload), event.idempotencyKey)
    .run();

  return Response.json({ ok: true });
}
