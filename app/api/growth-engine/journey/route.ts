import { env } from "cloudflare:workers";
import { GROWTH_ENGINE_TENANT_ID, deriveJourneyStage, normalizeConversionEvent } from "@/app/lib/growth-engine";

function clean(value: unknown, maxLength = 180) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const customerKey = clean(body.customer_key ?? body.customerKey ?? body.session_key ?? body.sessionKey);
  if (!customerKey) return Response.json({ error: "customer_key or session_key is required" }, { status: 400 });
  const eventName = normalizeConversionEvent(body.event_name ?? body.eventName);
  const stage = clean(body.journey_stage ?? body.journeyStage) || deriveJourneyStage(eventName);
  const optOut = Boolean(body.opt_out ?? body.optOut);

  await env.DB.prepare(
    `INSERT INTO growth_customer_profiles
      (customer_key, tenant_id, journey_stage, first_touch_json, last_touch_json, source_article_id, social_content_id, campaign_id,
       interests_json, last_action, last_conversion, total_orders, total_revenue, lifetime_value, consent_status, opt_out, data_quality, sample_size, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(customer_key) DO UPDATE SET
        journey_stage = excluded.journey_stage,
        last_touch_json = excluded.last_touch_json,
        last_action = excluded.last_action,
        last_conversion = excluded.last_conversion,
        consent_status = excluded.consent_status,
        opt_out = excluded.opt_out,
        updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(
      customerKey,
      tenantId,
      stage,
      JSON.stringify(body.first_touch || {}),
      JSON.stringify(body.last_touch || { event_name: eventName }),
      clean(body.source_article_id ?? body.sourceArticleId) || null,
      clean(body.social_content_id ?? body.socialContentId) || null,
      clean(body.campaign_id ?? body.campaignId) || null,
      JSON.stringify(body.interests || []),
      eventName,
      eventName,
      Number(body.total_orders ?? 0),
      Number(body.total_revenue ?? 0),
      Number(body.lifetime_value ?? 0),
      clean(body.consent_status ?? body.consentStatus, 40) || "unknown",
      optOut ? 1 : 0,
      clean(body.data_quality ?? body.dataQuality, 40) || "partial",
      Number(body.sample_size ?? 0),
      Number(body.confidence ?? 0),
    )
    .run();

  await env.DB.prepare("INSERT INTO growth_events (event_id, tenant_id, event_type, source_engine, entity_refs_json, payload_json, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), tenantId, "journey.stage.changed", "customer_journey", JSON.stringify({ customer_key: customerKey }), JSON.stringify({ event_name: eventName, journey_stage: stage }), `journey:${customerKey}:${eventName}:${stage}`)
    .run();

  return Response.json({ ok: true, customerKey, journeyStage: stage });
}
