import { FeatureEntitlementResolver } from "./feature-entitlements.ts";
import { TenantConfigResolver } from "./tenant-config-resolver.ts";
import { LUNA_CHARACTER_CORE } from "./studioos-market.ts";
import { ENGINE_VERSIONS, STUDIOOS_VERSION, type StudioOSMigrationState } from "./studioos-version.ts";
import { RAVEN_STUDIOOS_TENANT_CONFIG, type CharacterCoreConfig, type TenantConfig } from "./studioos-tenant-config.ts";
import { SCARLET_CHARACTER_CORE_CONFIG, SCARLET_TENANT_CONFIG } from "./studioos-scarlet.ts";
import { buildVersionCenterEntries, type RegistrySet, type TenantProvisioningRequest, type VersionCenterEntry } from "./studioos-registry.ts";

export const LUNA_CHARACTER_CORE_CONFIG: CharacterCoreConfig = {
  characterId: LUNA_CHARACTER_CORE.characterId,
  canonicalName: LUNA_CHARACTER_CORE.canonicalName,
  displayName: "Luna",
  persona: "A gentle lunar guide for reflective questions.",
  tone: "warm, gentle",
  specialties: [...LUNA_CHARACTER_CORE.specialties],
  worldbuilding: [...LUNA_CHARACTER_CORE.worldbuilding],
  safetyRules: [...LUNA_CHARACTER_CORE.values],
  ctaDefaults: { default: "Lunaと静かに振り返る" },
  contentDefaults: { hashtags: ["#Luna", "#月の便り"] },
  visualIdentity: { palette: "silver-blue", atmosphere: "soft night light" },
};

const LUNA_PREVIEW_URL = "https://preview.invalid/luna";

export const LUNA_TENANT_CONFIG: TenantConfig = {
  schemaVersion: 1,
  tenantId: "luna-oracle",
  tenantKey: "luna-oracle",
  guildId: "raven-guild",
  identity: { tenantId: "luna-oracle", tenantKey: "luna-oracle", guildId: "raven-guild", primaryCharacterId: "luna", displayName: "Luna" },
  branding: { displayName: "Luna", brandTone: "warm, gentle", brandStyle: "silver-blue" },
  urls: { publicUrl: LUNA_PREVIEW_URL, profileUrl: `${LUNA_PREVIEW_URL}/profile` },
  plan: { planId: "PREMIUM", planVersion: "1" },
  entitlements: { planDefaults: {}, featureFlags: { analytics: true, blog: true, sns: true, reel: true, growth: true }, tenantOverrides: {}, limits: {} },
  localization: { locale: "ja-JP", language: "ja", country: "JP", timezone: "Asia/Tokyo", currency: "JPY", dateFormat: "yyyy-MM-dd", cta: { default: "Lunaと静かに振り返る" }, hashtags: ["#Luna", "#月の便り"] },
  market: { marketId: "jp", country: "JP", marketPersonaId: "luna-jp", toneOverride: "warm, gentle", formality: "neutral", humorStyle: "light", relationshipDistance: "friendly", ctaStyle: "community-oriented" },
  characterRef: "luna",
  analytics: { enabled: true, tenantId: "luna-oracle", provider: "pilot-fixture", referenceIds: { property: "luna-fixture" }, eventNamespace: "luna-oracle", publicUrl: LUNA_PREVIEW_URL, sources: ["pilot-fixture"] },
  blog: { enabled: true, tenantId: "luna-oracle", defaultAuthor: "Luna", defaultCta: "Lunaと静かに振り返る", defaultTags: ["luna", "moon"], publicBaseUrl: LUNA_PREVIEW_URL, defaultCategories: ["reflection"], defaultTargetReader: "pilot reader", defaultSearchIntent: "reflection", seoTitleSuffix: " | Luna" },
  sns: { enabled: true, tenantId: "luna-oracle", displayName: "Luna", defaultCta: "Lunaと静かに振り返る", hashtags: ["#Luna", "#月の便り"], publicBaseUrl: LUNA_PREVIEW_URL, defaultLocale: "ja-JP", templateDefaults: { source: "pilot" }, publishingDefaults: { externalPublish: false }, providerRefs: { instagram: "pilot-fixture" }, storageRefs: { publicBaseUrl: LUNA_PREVIEW_URL } },
  reel: { enabled: true, tenantId: "luna-oracle", rendererProvider: "pilot-fixture", storage: { namespace: "luna-oracle-preview-media" }, backgroundLibrary: ["luna-night"], brandDefaults: { presetId: "luna-jp-preview", cta: "Lunaと静かに振り返る" }, defaultAspectRatio: "9:16", defaultDuration: 30, storageRef: "luna-oracle-preview-media", backgroundLibraryRef: "luna-preview-library", publicBaseUrl: LUNA_PREVIEW_URL, defaultLocale: "ja-JP", renderDefaults: { aspectRatio: "9:16", duration: 30 }, providerRefs: { renderer: "pilot-fixture", storage: "pilot-fixture" } },
  growth: { enabled: true, tenantId: "luna-oracle", kpi: ["pilot_engagement"], targetAudience: "pilot readers", automationLevel: "read-only", constraints: ["preview_only", "no_external_write"], defaultMarket: "jp", defaultLocale: "ja-JP", providerRefs: { analytics: "pilot-fixture", sns: "pilot-fixture" }, experimentPolicy: { requiresStartApproval: true, autoStart: false }, approvalPolicy: { humanApprovalRequired: true, restrictedActions: ["price", "trial", "billing", "campaign", "character", "menu", "advertising", "external_send", "sns_publish"] } },
  storage: { provider: "pilot-fixture", mediaNamespace: "luna-oracle-preview-media", reelNamespace: "luna-oracle-preview-reels", publicBaseUrl: LUNA_PREVIEW_URL },
  providers: { ai: ["pilot-fixture"], media: ["pilot-fixture"], video: ["pilot-fixture"], storage: ["pilot-fixture"], social: ["pilot-fixture"], analytics: ["pilot-fixture"] },
  openingCampaign: { enabled: false, campaignId: "luna-opening-not-configured", trialEnabled: false, trialLimit: 0, audience: "luna-pilot", primaryCta: "", secondaryCta: "", startAt: null, endAt: null },
};

export class PilotTenantConfigResolver extends TenantConfigResolver {
  constructor() { super([RAVEN_STUDIOOS_TENANT_CONFIG, LUNA_TENANT_CONFIG, SCARLET_TENANT_CONFIG]); }
  override getCharacterConfig(characterId: string) {
    if (characterId === LUNA_CHARACTER_CORE_CONFIG.characterId) return LUNA_CHARACTER_CORE_CONFIG;
    if (characterId === SCARLET_CHARACTER_CORE_CONFIG.characterId) return SCARLET_CHARACTER_CORE_CONFIG;
    return super.getCharacterConfig(characterId);
  }
}

export const pilotTenantConfigResolver = new PilotTenantConfigResolver();
export const pilotEntitlementResolver = new FeatureEntitlementResolver(pilotTenantConfigResolver);
export const resolvePilotTenantConfig = (tenantId: string) => pilotTenantConfigResolver.requireTenantConfig(tenantId);
export const resolvePilotAnalyticsConfig = (tenantId: string) => pilotTenantConfigResolver.getAnalyticsConfig(tenantId);
export const resolvePilotBlogConfig = (tenantId: string) => pilotTenantConfigResolver.getBlogConfig(tenantId);
export const resolvePilotSnsConfig = (tenantId: string) => pilotTenantConfigResolver.getSnsConfig(tenantId);
export const resolvePilotReelConfig = (tenantId: string) => pilotTenantConfigResolver.getReelConfig(tenantId);
export const resolvePilotGrowthConfig = (tenantId: string) => pilotTenantConfigResolver.getGrowthConfig(tenantId);

export const LUNA_MIGRATION_STATE: StudioOSMigrationState = { migrationState: "not_provisioned", d1MigrationVersion: null, migrationLedgerRef: null, schemaCompatibility: "compatible" };

export const LUNA_PILOT_REGISTRY: RegistrySet = {
  guilds: [],
  tenants: [{ tenantId: "luna-oracle", tenantKey: "luna-oracle", guildId: "raven-guild", characterId: "luna", characterCoreId: "luna", marketPersonaId: "luna-jp", displayName: "Luna", plan: "PREMIUM", environment: "preview", status: "planned", studioOsVersion: STUDIOOS_VERSION, tenantSchemaVersion: 1, buildCommit: "pilot-fixture", migration: LUNA_MIGRATION_STATE, engineVersions: ENGINE_VERSIONS, lastDeploy: null, isFixture: true, market: "jp", country: "JP", locale: "ja-JP", timezone: "Asia/Tokyo", currency: "JPY" }],
  workers: [{ workerId: "luna-oracle-preview", tenantId: "luna-oracle", workerName: "luna-oracle-preview", provider: "cloudflare", environment: "preview", publicUrl: LUNA_PREVIEW_URL, deployedVersion: null, buildCommit: "pilot-fixture", status: "planned", isFixture: true }],
};

export const LUNA_PROVISIONING_MANIFEST = {
  tenant: "luna-oracle",
  guild: "raven-guild",
  character: "luna",
  market: "jp",
  plan: "PREMIUM",
  entitlements: ["analytics", "blog", "sns", "reel", "growth"],
  worker: "luna-oracle-preview",
  storage: { mediaNamespace: "luna-oracle-preview-media", reelNamespace: "luna-oracle-preview-reels" },
  providers: { mode: "pilot-fixture", refs: ["pilot-fixture"] },
  urls: { preview: LUNA_PREVIEW_URL },
  requiredSecrets: ["OPENAI_API_KEY", "INSTAGRAM_ACCESS_TOKEN"],
  requiredMigrations: [],
  readiness: "PREVIEW_READY",
  executionAllowed: false,
} as const;

export const LUNA_PROVISIONING_REQUEST: TenantProvisioningRequest = { guildId: "raven-guild", tenantId: "luna-oracle", characterId: "luna", marketPersonaId: "luna-jp", workerName: "luna-oracle-preview", plan: "PREMIUM", status: "preview" };

export function buildPilotVersionCenterEntries(): VersionCenterEntry[] {
  const entries = buildVersionCenterEntries({ registry: LUNA_PILOT_REGISTRY });
  const lunaEntitlements = pilotEntitlementResolver.resolveAllFeatures("luna-oracle");
  return entries.map((entry) => entry.tenant.tenantId === "luna-oracle" ? { ...entry, entitlements: lunaEntitlements, enabledFeatureCount: lunaEntitlements.filter((item) => item.allowed).length, deniedFeatureCount: lunaEntitlements.filter((item) => !item.allowed).length } : entry);
}
