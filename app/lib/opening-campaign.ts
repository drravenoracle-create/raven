import type { TenantOpeningCampaignConfig } from "./tenant-config";

export type OpeningCampaignState = "inactive" | "active" | "exhausted" | "expired" | "converted";
export type OpeningCampaignEventName =
  | "campaign_view"
  | "trial_started"
  | "trial_used"
  | "trial_exhausted"
  | "trial_converted"
  | "campaign_cta_clicked";

export const OPENING_CAMPAIGN_EVENTS: readonly OpeningCampaignEventName[] = [
  "campaign_view",
  "trial_started",
  "trial_used",
  "trial_exhausted",
  "trial_converted",
  "campaign_cta_clicked",
];

export function isOpeningCampaignActive(config: TenantOpeningCampaignConfig, now = new Date()) {
  if (!config.enabled || !config.trialEnabled) return false;
  const time = now.getTime();
  if (config.startAt && time < new Date(config.startAt).getTime()) return false;
  if (config.endAt && time >= new Date(config.endAt).getTime()) return false;
  return true;
}

export function deriveOpeningCampaignState(input: {
  config: TenantOpeningCampaignConfig;
  usedCount?: number;
  converted?: boolean;
  now?: Date;
}): OpeningCampaignState {
  if (input.converted) return "converted";
  if (input.usedCount !== undefined && input.usedCount >= input.config.trialLimit) return "exhausted";
  if (!input.config.enabled || !input.config.trialEnabled) return "inactive";
  if (!isOpeningCampaignActive(input.config, input.now)) {
    if (input.config.endAt && (input.now || new Date()).getTime() >= new Date(input.config.endAt).getTime()) return "expired";
    return "inactive";
  }
  return "active";
}

export function isOpeningCampaignEvent(value: unknown): value is OpeningCampaignEventName {
  return typeof value === "string" && OPENING_CAMPAIGN_EVENTS.includes(value as OpeningCampaignEventName);
}
