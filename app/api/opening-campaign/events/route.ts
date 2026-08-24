import { env } from "cloudflare:workers";
import { isOpeningCampaignEvent } from "../../../lib/opening-campaign";
import { RAVEN_TENANT_CONFIG } from "../../../lib/tenant-config";

function clean(value: unknown, max = 240) { return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max); }

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const eventName = clean(body?.eventName ?? body?.event_name, 80);
  const campaignId = clean(body?.campaignId ?? body?.campaign_id, 120) || RAVEN_TENANT_CONFIG.openingCampaign.campaignId;
  if (!body || campaignId !== RAVEN_TENANT_CONFIG.openingCampaign.campaignId || !isOpeningCampaignEvent(eventName)) return Response.json({ error: "Invalid campaign event." }, { status: 400 });
  const eventKey = clean(body.eventKey ?? body.event_key, 180);
  if (!eventKey) return Response.json({ error: "event_key is required." }, { status: 400 });
  await env.DB.prepare("INSERT OR IGNORE INTO opening_campaign_events (id, campaign_id, tenant_id, member_id, event_name, event_key, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), campaignId, RAVEN_TENANT_CONFIG.id, clean(body.memberId ?? body.member_id, 120) || null, eventName, eventKey, JSON.stringify(body.payload || {})).run();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
