import type { TenantConfig, TenantOpeningCampaignConfig } from "./tenant-config";

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

export function canUseOpeningCampaignTrial(state: OpeningCampaignState) {
  return state === "active";
}

export function canTransitionOpeningCampaignState(from: OpeningCampaignState, to: OpeningCampaignState) {
  if (from === to) return true;
  const allowed: Record<OpeningCampaignState, OpeningCampaignState[]> = {
    inactive: ["active", "expired"],
    active: ["exhausted", "expired", "converted"],
    exhausted: ["converted"],
    expired: ["converted"],
    converted: [],
  };
  return allowed[from].includes(to);
}

type CampaignConfigDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): { first<T>(): Promise<T | null> };
  };
};

type StoredCampaign = {
  campaign_name?: string;
  enabled?: number;
  start_at?: string | null;
  end_at?: string | null;
  trial_enabled?: number;
  trial_scope?: TenantOpeningCampaignConfig["trialScope"];
  trial_limit?: number;
  campaign_message?: string;
  primary_cta?: string;
  secondary_cta?: string;
  target_audience?: string;
};

export async function loadOpeningCampaignConfig(database: CampaignConfigDatabase, tenant: TenantConfig) {
  const fallback = tenant.openingCampaign;
  try {
    const row = await database.prepare("SELECT campaign_name, enabled, start_at, end_at, trial_enabled, trial_scope, trial_limit, campaign_message, primary_cta, secondary_cta, target_audience FROM opening_campaigns WHERE campaign_id = ? AND tenant_id = ? LIMIT 1")
      .bind(fallback.campaignId, tenant.id).first<StoredCampaign>();
    if (!row) return fallback;
    return {
      ...fallback,
      campaignName: row.campaign_name || fallback.campaignName,
      enabled: Boolean(Number(row.enabled)),
      startAt: row.start_at || null,
      endAt: row.end_at || null,
      trialEnabled: Boolean(Number(row.trial_enabled)),
      trialScope: row.trial_scope || fallback.trialScope,
      trialLimit: Number(row.trial_limit ?? fallback.trialLimit),
      campaignMessage: row.campaign_message || fallback.campaignMessage,
      primaryCta: row.primary_cta || fallback.primaryCta,
      secondaryCta: row.secondary_cta || fallback.secondaryCta,
      targetAudience: row.target_audience || fallback.targetAudience,
    } satisfies TenantOpeningCampaignConfig;
  } catch {
    return fallback;
  }
}
