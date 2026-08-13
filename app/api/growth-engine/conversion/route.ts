import { env } from "cloudflare:workers";
import { GROWTH_ENGINE_TENANT_ID, buildGrowthEvent, normalizeAttribution, normalizeConversionEvent } from "@/app/lib/growth-engine";

function clean(value: unknown, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const eventName = normalizeConversionEvent(body.event_name ?? body.eventName);
  const attributionType = normalizeAttribution(body.attribution_type ?? body.attributionType);
  const idempotencyKey = clean(body.idempotency_key ?? `${eventName}:${body.tracking_id || ""}:${body.occurred_at || Date.now()}`, 240);

  await env.DB.prepare(
    `INSERT OR IGNORE INTO growth_conversion_events
      (id, tenant_id, event_name, tracking_id, session_key, source_article_id, social_content_id, campaign_id, goal_name, goal_value, attribution_type, occurred_at, metadata_json, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      tenantId,
      eventName,
      clean(body.tracking_id ?? body.trackingId, 180) || null,
      clean(body.session_key ?? body.sessionKey, 180) || null,
      clean(body.source_article_id ?? body.articleId, 120) || null,
      clean(body.social_content_id ?? body.socialContentId, 120) || null,
      clean(body.campaign_id ?? body.campaignId, 120) || null,
      clean(body.goal_name ?? body.goalName, 120) || null,
      Number(body.goal_value ?? body.goalValue ?? 0),
      attributionType,
      clean(body.occurred_at ?? new Date().toISOString(), 40),
      JSON.stringify(body.metadata || {}),
      idempotencyKey,
    )
    .run();

  const event = buildGrowthEvent({ eventType: "conversion.recorded", sourceEngine: "conversion_engine", entityRefs: { tracking_id: body.tracking_id, source_article_id: body.source_article_id }, payload: { event_name: eventName, attribution_type: attributionType }, idempotencyKey: `event:${idempotencyKey}` });
  await env.DB.prepare("INSERT OR IGNORE INTO growth_events (event_id, tenant_id, event_type, source_engine, entity_refs_json, payload_json, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(event.eventId, tenantId, event.eventType, event.sourceEngine, JSON.stringify(event.entityRefs), JSON.stringify(event.payload), event.idempotencyKey)
    .run();

  return Response.json({ ok: true, attributionType });
}
