import type { CharacterCoreConfig, TenantConfig } from "./studioos-tenant-config.ts";

export const SCARLET_CHARACTER_CORE_CONFIG: CharacterCoreConfig = {
  characterId: "scarlet",
  canonicalName: "scarlet",
  displayName: "Scarlet Donovan",
  persona: "A clear, composed guardian for boundaries, safety, courage, and decisions.",
  tone: "clear, direct, composed",
  specialties: ["boundaries", "safety", "courage", "decision support"],
  safetyRules: ["protect personal agency", "avoid certainty claims", "make risks explicit"],
  ctaDefaults: { default: "スカーレットと境界線を整理する" },
  contentDefaults: { hashtags: ["#ScarletDonovan", "#境界線"] },
  visualIdentity: { palette: "burgundy, ivory", atmosphere: "calm, precise, protected" },
};

export const SCARLET_TENANT_CONFIG: TenantConfig = {
  schemaVersion: 1,
  tenantId: "scarlet-donovan",
  tenantKey: "scarlet-donovan",
  guildId: "raven-guild",
  identity: { tenantId: "scarlet-donovan", tenantKey: "scarlet-donovan", guildId: "raven-guild", primaryCharacterId: "scarlet", displayName: "Scarlet Donovan" },
  branding: { displayName: "Scarlet Donovan", brandTone: "clear, direct, composed", brandStyle: "burgundy and ivory" },
  urls: { publicUrl: "https://scarlet.fortunestudios.jp", profileUrl: "https://scarlet.fortunestudios.jp/profile" },
  plan: { planId: "PREMIUM", planVersion: "1" },
  entitlements: { planDefaults: {}, featureFlags: { analytics: true, blog: true, sns: true, reel: true, growth: true }, tenantOverrides: {}, limits: {} },
  localization: { locale: "ja-JP", language: "ja", country: "JP", timezone: "Asia/Tokyo", currency: "JPY", dateFormat: "yyyy-MM-dd", cta: { default: "スカーレットと境界線を整理する" }, hashtags: ["#ScarletDonovan", "#境界線"] },
  market: { marketId: "jp", country: "JP", marketPersonaId: "scarlet-jp", toneOverride: "clear, direct, composed", formality: "neutral", humorStyle: "none", relationshipDistance: "professional", ctaStyle: "direct" },
  characterRef: "scarlet",
  analytics: { enabled: true, tenantId: "scarlet-donovan", provider: "internal", referenceIds: {}, eventNamespace: "scarlet-donovan", publicUrl: "https://scarlet.fortunestudios.jp", sources: ["internal"] },
  blog: { enabled: true, tenantId: "scarlet-donovan", defaultAuthor: "Scarlet Donovan", defaultCta: "スカーレットと境界線を整理する", defaultTags: ["scarlet", "boundaries"], publicBaseUrl: "https://scarlet.fortunestudios.jp", defaultCategories: ["boundaries"], defaultTargetReader: "相談者", defaultSearchIntent: "boundaries and decisions", seoTitleSuffix: " | Scarlet Donovan" },
  sns: { enabled: false, tenantId: "scarlet-donovan", displayName: "Scarlet Donovan", defaultCta: "スカーレットと境界線を整理する", hashtags: ["#ScarletDonovan", "#境界線"], publicBaseUrl: "https://scarlet.fortunestudios.jp", defaultLocale: "ja-JP", publishingDefaults: { externalPublish: false }, providerRefs: {}, storageRefs: {} },
  reel: { enabled: false, tenantId: "scarlet-donovan", rendererProvider: "not_configured", storage: { namespace: "scarlet-donovan-reels" }, backgroundLibrary: [], brandDefaults: { presetId: "scarlet-jp", cta: "スカーレットと境界線を整理する" }, defaultAspectRatio: "9:16", defaultDuration: 30, publicBaseUrl: "https://scarlet.fortunestudios.jp", defaultLocale: "ja-JP", renderDefaults: { aspectRatio: "9:16", duration: 30 }, providerRefs: {} },
  growth: { enabled: true, tenantId: "scarlet-donovan", kpi: [], targetAudience: "相談者", automationLevel: "read-only", constraints: ["no_external_write"], defaultMarket: "jp", defaultLocale: "ja-JP", providerRefs: { analytics: "internal" }, experimentPolicy: { requiresStartApproval: true, autoStart: false }, approvalPolicy: { humanApprovalRequired: true, restrictedActions: ["price", "trial", "billing", "campaign", "character", "menu", "advertising", "external_send", "sns_publish"] } },
  storage: { provider: "optional", mediaNamespace: "scarlet-donovan-media", reelNamespace: "scarlet-donovan-reels", publicBaseUrl: "https://scarlet.fortunestudios.jp" },
  providers: { ai: ["openai"], media: [], video: [], storage: [], social: [], analytics: ["internal"] },
  openingCampaign: { enabled: false, campaignId: "scarlet-opening-not-configured", trialEnabled: false, trialLimit: 0, audience: "scarlet", primaryCta: "", secondaryCta: "", startAt: null, endAt: null },
};
