import { RAVEN_CHARACTER_CONFIG, type CharacterConfig } from "./character-config.ts";
import { RAVEN_GUILD_CONFIG } from "./guild-config.ts";
import { RAVEN_TENANT_CONFIG, type TenantConfig as RavenTenantConfig } from "./tenant-config.ts";

export const TENANT_SCHEMA_VERSION = 1;

export type TenantIdentityConfig = {
  tenantId: string;
  tenantKey: string;
  guildId?: string;
  primaryCharacterId: string;
  displayName: string;
};

export type TenantBrandingConfig = {
  displayName: string;
  brandTone?: string;
  brandStyle?: string;
};

export type TenantPublicUrlConfig = {
  publicUrl: string;
  profileUrl?: string;
};

export type TenantPlanConfig = {
  planId?: string;
  planVersion?: string;
};

export type EntitlementValue = "allow" | "deny" | "inherit";

export type TenantEntitlementConfig = {
  planDefaults?: Record<string, EntitlementValue>;
  featureFlags?: Record<string, boolean>;
  tenantOverrides?: Record<string, EntitlementValue>;
  limits?: Record<string, number>;
};

export type TenantLocalizationConfig = {
  locale: string;
  language: string;
  country?: string;
  timezone: string;
  currency?: string;
  dateFormat?: string;
  pricing?: Record<string, string | number>;
  cta?: Record<string, string>;
  hashtags?: string[];
  seoKeywords?: string[];
  culturalRules?: string[];
  prohibitedExpressions?: string[];
  legalTextRef?: string;
  paymentProviderRef?: string;
};

export type TenantMarketConfig = {
  marketId?: string;
  country?: string;
  marketPersonaId?: string;
  toneOverride?: string;
  formality?: string;
  humorStyle?: string;
  relationshipDistance?: string;
  visualDirection?: string;
  ctaStyle?: string;
  culturalRules?: string[];
  localizationOverrides?: Record<string, string>;
};

export type CharacterCoreConfig = {
  characterId: string;
  canonicalName: string;
  displayName: string;
  persona?: string;
  tone?: string;
  specialties?: string[];
  worldbuilding?: string[];
  safetyRules?: string[];
  ctaDefaults?: Record<string, string>;
  contentDefaults?: Record<string, string | string[]>;
  visualIdentity?: Record<string, string>;
};

export type MarketPersonaConfig = {
  market: string;
  locale: string;
  toneOverride?: string;
  formality?: string;
  humorStyle?: string;
  relationshipDistance?: string;
  visualDirection?: string;
  ctaStyle?: string;
  culturalRules?: string[];
  localizationOverrides?: Record<string, string>;
};

export type AnalyticsConfigSlice = {
  enabled?: boolean;
  provider?: string;
  referenceIds?: Record<string, string>;
  eventNamespace: string;
  publicUrl: string;
  sources: string[];
};

export type BlogConfigSlice = {
  enabled?: boolean;
  defaultAuthor?: string;
  defaultCta?: string;
  defaultTags?: string[];
  publicBaseUrl: string;
  defaultCategories: string[];
  defaultTargetReader: string;
  defaultSearchIntent: string;
  seoTitleSuffix: string;
};

export type SnsConfigSlice = {
  enabled?: boolean;
  tenantId: string;
  displayName: string;
  defaultCta: string;
  hashtags: string[];
  publicBaseUrl: string;
};

export type ReelConfigSlice = {
  enabled?: boolean;
  rendererProvider?: string;
  storage: { namespace: string };
  backgroundLibrary: string[];
  brandDefaults: { presetId: string; cta: string };
  defaultAspectRatio: string;
  defaultDuration: number;
};

export type GrowthConfigSlice = {
  enabled?: boolean;
  kpi?: string[];
  targetAudience?: string;
  automationLevel?: string;
  constraints?: string[];
  tenantId: string;
};

export type StorageConfigSlice = {
  provider?: string;
  mediaNamespace: string;
  reelNamespace: string;
  publicBaseUrl?: string;
};

export type ProviderConfigSlice = {
  ai?: string[];
  media?: string[];
  video?: string[];
  storage?: string[];
  social?: string[];
  analytics?: string[];
};

export type OpeningCampaignConfigSlice = {
  enabled: boolean;
  campaignId: string;
  trialEnabled: boolean;
  trialLimit: number;
  audience: string;
  primaryCta: string;
  secondaryCta: string;
  startAt: string | null;
  endAt: string | null;
};

export type TenantConfig = {
  schemaVersion: number;
  tenantId: string;
  tenantKey: string;
  guildId?: string;
  identity: TenantIdentityConfig;
  branding: TenantBrandingConfig;
  urls: TenantPublicUrlConfig;
  plan: TenantPlanConfig;
  entitlements: TenantEntitlementConfig;
  localization: TenantLocalizationConfig;
  market: TenantMarketConfig;
  characterRef: string;
  analytics: AnalyticsConfigSlice;
  blog: BlogConfigSlice;
  sns: SnsConfigSlice;
  reel: ReelConfigSlice;
  growth: GrowthConfigSlice;
  storage: StorageConfigSlice;
  providers: ProviderConfigSlice;
  openingCampaign?: OpeningCampaignConfigSlice;
};

export function validateTenantConfig(config: Partial<TenantConfig>): string[] {
  const missing: string[] = [];
  if (!Number.isInteger(config.schemaVersion) || Number(config.schemaVersion) < 1) missing.push("schemaVersion");
  if (!config.tenantId) missing.push("tenantId");
  if (!config.tenantKey) missing.push("tenantKey");
  if (!config.identity?.primaryCharacterId) missing.push("identity.primaryCharacterId");
  if (!config.urls?.publicUrl) missing.push("urls.publicUrl");
  if (!config.localization?.locale) missing.push("localization.locale");
  if (!config.analytics?.eventNamespace) missing.push("analytics.eventNamespace");
  if (!config.blog?.publicBaseUrl) missing.push("blog.publicBaseUrl");
  if (!config.sns?.tenantId) missing.push("sns.tenantId");
  if (!config.reel?.storage?.namespace) missing.push("reel.storage.namespace");
  if (!config.growth?.tenantId) missing.push("growth.tenantId");
  return missing;
}

function characterCore(character: CharacterConfig): CharacterCoreConfig {
  return {
    characterId: character.id,
    canonicalName: character.slug,
    displayName: character.displayName,
    tone: character.brand.tone,
    specialties: [],
    ctaDefaults: {
      default: character.defaultCta,
      reel: character.reelCta,
      threeChoice: character.threeChoiceCta,
    },
    contentDefaults: {
      hashtags: character.sns.hashtags,
      defaultPurpose: character.sns.defaultPurpose,
    },
    visualIdentity: { style: character.brand.style },
  };
}

export function adaptRavenTenantConfig(legacy: RavenTenantConfig = RAVEN_TENANT_CONFIG): TenantConfig {
  const publicUrl = legacy.publicUrl;
  return {
    schemaVersion: TENANT_SCHEMA_VERSION,
    tenantId: legacy.id,
    tenantKey: legacy.identity.tenantKey,
    guildId: RAVEN_GUILD_CONFIG.id,
    identity: {
      tenantId: legacy.identity.tenantId,
      tenantKey: legacy.identity.tenantKey,
      guildId: RAVEN_GUILD_CONFIG.id,
      primaryCharacterId: legacy.identity.primaryCharacterId,
      displayName: legacy.identity.displayName,
    },
    branding: {
      displayName: legacy.branding.characterDisplayName,
      brandTone: legacy.branding.tone,
      brandStyle: legacy.branding.style,
    },
    urls: {
      publicUrl,
      profileUrl: legacy.character.publicProfile.profileUrl,
    },
    plan: {},
    entitlements: {
      planDefaults: {},
      featureFlags: legacy.entitlements.features || {},
      tenantOverrides: {},
      limits: legacy.entitlements.limits || {},
    },
    localization: {
      locale: "ja-JP",
      language: "ja",
      country: "JP",
      timezone: "Asia/Tokyo",
      currency: "JPY",
      dateFormat: "yyyy-MM-dd",
    },
    market: { marketId: "jp", country: "JP", marketPersonaId: "raven-jp" },
    characterRef: legacy.primaryCharacterId,
    analytics: {
      enabled: legacy.analytics.enabled,
      provider: "external-connectors",
      referenceIds: {},
      eventNamespace: legacy.id,
      publicUrl: legacy.analytics.publicUrl,
      sources: legacy.analytics.sources,
    },
    blog: {
      enabled: legacy.blog.enabled,
      defaultAuthor: legacy.branding.characterDisplayName,
      defaultCta: legacy.content.defaultCta,
      defaultTags: legacy.content.hashtags,
      publicBaseUrl: publicUrl,
      defaultCategories: legacy.blog.defaultCategories,
      defaultTargetReader: legacy.blog.defaultTargetReader,
      defaultSearchIntent: legacy.blog.defaultSearchIntent,
      seoTitleSuffix: legacy.blog.seoTitleSuffix,
    },
    sns: {
      enabled: true,
      tenantId: legacy.id,
      displayName: legacy.branding.characterDisplayName,
      defaultCta: legacy.sns.defaultCta,
      hashtags: legacy.sns.hashtags,
      publicBaseUrl: publicUrl,
    },
    reel: {
      enabled: true,
      rendererProvider: "configured",
      storage: { namespace: legacy.reel.storageNamespace },
      backgroundLibrary: legacy.reel.backgroundCategories,
      brandDefaults: { presetId: legacy.reel.brandPresetId, cta: legacy.reel.defaultCta },
      defaultAspectRatio: legacy.reel.defaultAspectRatio,
      defaultDuration: legacy.reel.defaultDuration,
    },
    growth: {
      enabled: true,
      kpi: [],
      constraints: [],
      tenantId: legacy.growth.tenantId,
    },
    storage: {
      provider: "r2",
      mediaNamespace: legacy.storage.mediaNamespace,
      reelNamespace: legacy.storage.reelNamespace,
      publicBaseUrl: publicUrl,
    },
    providers: {
      ai: ["openai"],
      media: ["openai-image"],
      video: ["raven-renderer"],
      storage: ["r2"],
      social: ["instagram", "tiktok", "youtube"],
      analytics: legacy.analytics.sources,
    },
    openingCampaign: {
      enabled: legacy.openingCampaign.enabled,
      campaignId: legacy.openingCampaign.campaignId,
      trialEnabled: legacy.openingCampaign.trialEnabled,
      trialLimit: legacy.openingCampaign.trialLimit,
      audience: legacy.openingCampaign.targetAudience,
      primaryCta: legacy.openingCampaign.primaryCta,
      secondaryCta: legacy.openingCampaign.secondaryCta,
      startAt: legacy.openingCampaign.startAt,
      endAt: legacy.openingCampaign.endAt,
    },
  };
}

export const RAVEN_STUDIOOS_TENANT_CONFIG = adaptRavenTenantConfig();
export const RAVEN_CHARACTER_CORE = characterCore(RAVEN_CHARACTER_CONFIG);

export function getCharacterCore(characterId = RAVEN_CHARACTER_CORE.characterId) {
  return characterId === RAVEN_CHARACTER_CORE.characterId ? RAVEN_CHARACTER_CORE : undefined;
}
