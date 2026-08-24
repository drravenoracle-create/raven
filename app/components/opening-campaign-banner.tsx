"use client";
import type { TenantOpeningCampaignConfig } from "../lib/tenant-config";
import {
  buildOpeningCampaignEvent,
  getOpeningCampaignLocale,
  sendOpeningCampaignEvent,
  type OpeningCampaignAnalyticsEvent,
  type OpeningCampaignCtaType,
} from "../lib/opening-campaign-analytics";
import { useEffect } from "react";

export function OpeningCampaignBanner({ config }: { config: TenantOpeningCampaignConfig }) {
  const track = (eventType: OpeningCampaignAnalyticsEvent, ctaType?: OpeningCampaignCtaType) => {
    sendOpeningCampaignEvent(buildOpeningCampaignEvent({
      config,
      eventType,
      pagePath: window.location.pathname,
      locale: getOpeningCampaignLocale(document.documentElement.lang),
      ctaType,
    }));
  };
  useEffect(() => { track("campaign_view"); }, []);
  return <section className="mx-auto max-w-7xl px-5 pt-6" aria-label="オープン記念キャンペーン"><div className="raven-home-card border-l-4 border-[#8d6a2f] p-5"><p className="text-sm font-semibold text-[#8d6a2f]">{config.campaignName}</p><h2 className="mt-2 text-2xl font-semibold">{config.campaignMessage}</h2><div className="mt-4 flex flex-wrap gap-3"><a className="raven-hero-button" href={`/member/?campaign=${encodeURIComponent(config.campaignId)}`} onClick={() => track("campaign_cta_clicked", "primary")}>{config.primaryCta}</a><a className="raven-hero-button raven-hero-button-secondary" href={`/faq/?campaign=${encodeURIComponent(config.campaignId)}`} onClick={() => track("campaign_cta_clicked", "secondary")}>{config.secondaryCta}</a></div></div></section>;
}
