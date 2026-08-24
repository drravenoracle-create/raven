import { env } from "cloudflare:workers";
import { isOpeningCampaignActive } from "../../lib/opening-campaign";
import { RAVEN_TENANT_CONFIG } from "../../lib/tenant-config";

export async function GET() {
  const config = RAVEN_TENANT_CONFIG.openingCampaign;
  let stored: Record<string, unknown> | null = null;
  try { stored = await env.DB.prepare("SELECT * FROM opening_campaigns WHERE campaign_id = ? AND tenant_id = ? LIMIT 1").bind(config.campaignId, RAVEN_TENANT_CONFIG.id).first<Record<string, unknown>>(); } catch {}
  const effective = stored ? { ...config, enabled: Boolean(Number(stored.enabled)), startAt: String(stored.start_at || config.startAt || "") || null, endAt: String(stored.end_at || config.endAt || "") || null } : config;
  const active = isOpeningCampaignActive(effective);
  return Response.json({ campaign: active ? effective : { ...effective, enabled: false }, state: active ? "active" : "inactive" }, { headers: { "Cache-Control": "no-store" } });
}
