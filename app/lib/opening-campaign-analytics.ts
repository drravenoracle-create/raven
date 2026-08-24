import type { TenantOpeningCampaignConfig } from "./tenant-config";

export type OpeningCampaignAnalyticsEvent =
  | "campaign_view"
  | "campaign_cta_clicked";
export type OpeningCampaignCtaType = "primary" | "secondary";
export type OpeningCampaignLocale = "ja" | "en";

export type OpeningCampaignEventRequest = {
  campaignId: string;
  eventName: string;
  eventKey: string;
  payload: Record<string, string>;
};

export function getOpeningCampaignLocale(documentLanguage: string): OpeningCampaignLocale {
  return documentLanguage.toLowerCase().startsWith("en") ? "en" : "ja";
}

export function buildOpeningCampaignEvent({
  config,
  eventType,
  pagePath,
  locale,
  ctaType,
}: {
  config: TenantOpeningCampaignConfig;
  eventType: OpeningCampaignAnalyticsEvent;
  pagePath: string;
  locale: OpeningCampaignLocale;
  ctaType?: OpeningCampaignCtaType;
}): OpeningCampaignEventRequest {
  const eventKeyParts = [config.campaignId, eventType, locale, pagePath];
  const payload: Record<string, string> = {
    campaign_id: config.campaignId,
    event_type: eventType,
    audience: config.targetAudience,
    page_path: pagePath,
    locale,
  };
  if (eventType === "campaign_cta_clicked" && ctaType) {
    eventKeyParts.push(ctaType);
    payload.cta_type = ctaType;
  }
  return {
    campaignId: config.campaignId,
    eventName: eventType,
    eventKey: eventKeyParts.join(":"),
    payload,
  };
}

type AnalyticsTransport = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<unknown>;

export function sendOpeningCampaignEvent(
  event: OpeningCampaignEventRequest,
  transport: AnalyticsTransport = fetch,
) {
  void transport("/api/opening-campaign/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}
