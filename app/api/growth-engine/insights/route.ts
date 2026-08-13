import { env } from "cloudflare:workers";
import { GROWTH_ENGINE_TENANT_ID, buildGrowthEvent, evaluateInsightGuard } from "@/app/lib/growth-engine";

function clean(value: unknown, maxLength = 240) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const insightType = clean(body.insight_type ?? body.insightType, 80) || "content_opportunity";
  const sampleSize = Number(body.sample_size ?? body.sampleSize ?? 0);
  const confidence = Number(body.confidence ?? 0);
  const riskLevel = clean(body.risk_level ?? body.riskLevel, 40) || "low";
  const guard = evaluateInsightGuard({ sampleSize, confidence, riskLevel, sensitiveAttributeUsed: Boolean(body.sensitive_attribute_used) });
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO growth_content_insights
      (id, tenant_id, insight_type, topic, category, keyword, search_intent, audience, content_format, social_angle, cta_id, publish_time,
       summary, recommended_action, evidence_json, sample_size, confidence, observation_window, risk_level, guard_status, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      tenantId,
      insightType,
      clean(body.topic) || null,
      clean(body.category) || null,
      clean(body.keyword) || null,
      clean(body.search_intent ?? body.searchIntent) || null,
      clean(body.audience) || null,
      clean(body.content_format ?? body.contentFormat) || null,
      clean(body.social_angle ?? body.socialAngle) || null,
      clean(body.cta_id ?? body.ctaId) || null,
      clean(body.publish_time ?? body.publishTime) || null,
      clean(body.summary, 1000),
      clean(body.recommended_action ?? body.recommendedAction, 1000),
      JSON.stringify(body.evidence || {}),
      sampleSize,
      confidence,
      clean(body.observation_window ?? body.observationWindow, 120) || null,
      riskLevel,
      guard.allowed ? "allowed" : guard.reason,
      guard.allowed ? "proposed" : "blocked",
    )
    .run();

  const event = buildGrowthEvent({ eventType: "content.insight.generated", sourceEngine: "content_intelligence", entityRefs: { insight_id: id }, payload: { guard_status: guard.reason } });
  await env.DB.prepare("INSERT INTO growth_events (event_id, tenant_id, event_type, source_engine, entity_refs_json, payload_json, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(event.eventId, tenantId, event.eventType, event.sourceEngine, JSON.stringify(event.entityRefs), JSON.stringify(event.payload), event.idempotencyKey)
    .run();

  return Response.json({ ok: true, id, guard });
}
