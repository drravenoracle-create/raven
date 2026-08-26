import type { CharacterCoreConfig, TenantConfig } from "./studioos-tenant-config.ts";

const base = (characterId: string, tenantId: string, displayName: string, tone: string, style: string, specialties: string[], cta: string): TenantConfig => ({
  schemaVersion: 1, tenantId, tenantKey: tenantId, guildId: "raven-guild",
  identity: { tenantId, tenantKey: tenantId, guildId: "raven-guild", primaryCharacterId: characterId, displayName },
  branding: { displayName, brandTone: tone, brandStyle: style },
  urls: { publicUrl: `https://${characterId}.fortunestudios.jp`, profileUrl: `https://${characterId}.fortunestudios.jp/profile` },
  plan: { planId: "PREMIUM", planVersion: "1" },
  entitlements: { planDefaults: {}, featureFlags: { analytics: true, blog: true, sns: true, reel: true, growth: true }, tenantOverrides: {}, limits: {} },
  localization: { locale: "ja-JP", language: "ja", country: "JP", timezone: "Asia/Tokyo", currency: "JPY", dateFormat: "yyyy-MM-dd", cta: { default: cta } },
  market: { marketId: "jp", country: "JP", marketPersonaId: `${characterId}-jp`, toneOverride: tone, formality: "neutral", humorStyle: "none", relationshipDistance: "professional", ctaStyle: "direct" },
  characterRef: characterId,
  analytics: { enabled: true, tenantId, provider: "internal", referenceIds: {}, eventNamespace: tenantId, publicUrl: `https://${characterId}.fortunestudios.jp`, sources: ["internal"] },
  blog: { enabled: true, tenantId, defaultAuthor: displayName, defaultCta: cta, defaultTags: [characterId], publicBaseUrl: `https://${characterId}.fortunestudios.jp`, defaultCategories: specialties.slice(0, 2), defaultTargetReader: "相談者", defaultSearchIntent: specialties.join(", "), seoTitleSuffix: ` | ${displayName}` },
  sns: { enabled: false, tenantId, displayName, defaultCta: cta, hashtags: [`#${characterId}`], publicBaseUrl: `https://${characterId}.fortunestudios.jp`, defaultLocale: "ja-JP", publishingDefaults: { externalPublish: false }, providerRefs: {}, storageRefs: {} },
  reel: { enabled: false, tenantId, rendererProvider: "not_configured", storage: { namespace: `${tenantId}-reels` }, backgroundLibrary: [], brandDefaults: { presetId: `${characterId}-jp`, cta }, defaultAspectRatio: "9:16", defaultDuration: 30, publicBaseUrl: `https://${characterId}.fortunestudios.jp`, defaultLocale: "ja-JP", renderDefaults: { aspectRatio: "9:16", duration: 30 }, providerRefs: {} },
  growth: { enabled: true, tenantId, kpi: [], targetAudience: "相談者", automationLevel: "read-only", constraints: ["no_external_write"], defaultMarket: "jp", defaultLocale: "ja-JP", providerRefs: { analytics: "internal" }, experimentPolicy: { requiresStartApproval: true, autoStart: false }, approvalPolicy: { humanApprovalRequired: true, restrictedActions: ["price", "trial", "billing", "campaign", "character", "menu", "advertising", "external_send", "sns_publish"] } },
  storage: { provider: "optional", mediaNamespace: `${tenantId}-media`, reelNamespace: `${tenantId}-reels`, publicBaseUrl: `https://${characterId}.fortunestudios.jp` },
  providers: { ai: [], media: [], video: [], storage: [], social: [], analytics: ["internal"] },
  openingCampaign: { enabled: false, campaignId: `${tenantId}-opening-not-configured`, trialEnabled: false, trialLimit: 0, audience: characterId, primaryCta: "", secondaryCta: "", startAt: null, endAt: null },
});

export const ATLAS_CHARACTER_CORE_CONFIG: CharacterCoreConfig = { characterId: "atlas", canonicalName: "atlas-smith", displayName: "Atlas Smith", persona: "A practical guide for work, continuity, repair, and systems.", tone: "calm, practical, realistic", specialties: ["work", "life repair", "planning", "habits", "technical consultation"], safetyRules: ["break problems into actionable steps", "do not claim certainty"], ctaDefaults: { default: "悩みを今日動ける形に直す" }, contentDefaults: { hashtags: ["#AtlasSmith", "#現実整理"] }, visualIdentity: { palette: "leather brown, iron gray, warm light", atmosphere: "workshop, tools, gears, maps" } };
export const SOL_CHARACTER_CORE_CONFIG: CharacterCoreConfig = { characterId: "sol", canonicalName: "sol-aurora", displayName: "Sol Aurora", persona: "A hopeful messenger who supports smiles, fresh starts, and small steps.", tone: "bright, hopeful, gentle", specialties: ["self-worth", "new beginnings", "emotional reset", "small steps"], safetyRules: ["encourage without pressure", "do not minimize pain", "do not claim certainty"], ctaDefaults: { default: "朝日のメッセージを受け取る" }, contentDefaults: { hashtags: ["#SolAurora", "#小さな一歩"] }, visualIdentity: { palette: "sun gold, young green, white light", atmosphere: "dawn, journey, letters, natural smiles" } };

export const ATLAS_TENANT_CONFIG = base("atlas", "atlas-oracle", "Atlas Smith", "calm, practical, realistic", "workshop, leather brown, iron gray, warm light", ATLAS_CHARACTER_CORE_CONFIG.specialties || [], "悩みを今日動ける形に直す");
export const SOL_TENANT_CONFIG = base("sol", "sol-oracle", "Sol Aurora", "bright, hopeful, gentle", "dawn, sun gold, young green, white light", SOL_CHARACTER_CORE_CONFIG.specialties || [], "朝日のメッセージを受け取る");
