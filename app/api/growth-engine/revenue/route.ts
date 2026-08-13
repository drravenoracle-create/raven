import { env } from "cloudflare:workers";
import { GROWTH_ENGINE_TENANT_ID, normalizeAttribution } from "@/app/lib/growth-engine";

function clean(value: unknown, maxLength = 180) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const revenueKind = clean(body.revenue_kind ?? body.revenueKind, 40) || "measured";
  const idempotencyKey = clean(body.idempotency_key ?? `${body.customer_key || "unknown"}:${body.occurred_at || Date.now()}:${body.revenue || 0}`, 240);

  await env.DB.prepare(
    `INSERT OR IGNORE INTO growth_revenue_records
      (id, tenant_id, customer_key, source_article_id, social_content_id, campaign_id, service_key, revenue, gross_margin,
       order_count, average_order_value, repeat_revenue, lifetime_value, attribution_type, revenue_kind, occurred_at, data_quality, metadata_json, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      tenantId,
      clean(body.customer_key ?? body.customerKey) || null,
      clean(body.source_article_id ?? body.sourceArticleId) || null,
      clean(body.social_content_id ?? body.socialContentId) || null,
      clean(body.campaign_id ?? body.campaignId) || null,
      clean(body.service_key ?? body.serviceKey) || null,
      Number(body.revenue ?? 0),
      body.gross_margin == null ? null : Number(body.gross_margin),
      Number(body.order_count ?? 1),
      body.average_order_value == null ? null : Number(body.average_order_value),
      Number(body.repeat_revenue ?? 0),
      body.lifetime_value == null ? null : Number(body.lifetime_value),
      normalizeAttribution(body.attribution_type ?? body.attributionType),
      revenueKind === "estimated" ? "estimated" : "measured",
      clean(body.occurred_at ?? new Date().toISOString(), 40),
      clean(body.data_quality ?? body.dataQuality, 40) || "partial",
      JSON.stringify(body.metadata || {}),
      idempotencyKey,
    )
    .run();

  await env.DB.prepare("INSERT OR IGNORE INTO growth_events (event_id, tenant_id, event_type, source_engine, entity_refs_json, payload_json, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), tenantId, "revenue.performance.updated", "revenue_intelligence", JSON.stringify({ customer_key: body.customer_key, source_article_id: body.source_article_id }), JSON.stringify({ revenue_kind: revenueKind, revenue: Number(body.revenue ?? 0) }), `event:${idempotencyKey}`)
    .run();

  return Response.json({ ok: true, revenueKind: revenueKind === "estimated" ? "estimated" : "measured" });
}
