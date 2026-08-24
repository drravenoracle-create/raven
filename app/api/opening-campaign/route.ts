import { env } from "cloudflare:workers";
import { isOpeningCampaignActive, loadOpeningCampaignConfig } from "../../lib/opening-campaign";
import { RAVEN_TENANT_CONFIG } from "../../lib/tenant-config";

export async function GET() {
  const effective = await loadOpeningCampaignConfig(env.DB, RAVEN_TENANT_CONFIG);
  const active = isOpeningCampaignActive(effective);
  return Response.json({ campaign: active ? effective : { ...effective, enabled: false }, state: active ? "active" : "inactive" }, { headers: { "Cache-Control": "no-store" } });
}
