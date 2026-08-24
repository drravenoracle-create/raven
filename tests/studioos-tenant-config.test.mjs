import assert from "node:assert/strict";
import test from "node:test";
import {
  RAVEN_CHARACTER_CORE,
  RAVEN_STUDIOOS_TENANT_CONFIG,
  TENANT_SCHEMA_VERSION,
  adaptRavenTenantConfig,
  validateTenantConfig,
} from "../app/lib/studioos-tenant-config.ts";
import {
  InvalidTenantConfigError,
  UnknownTenantError,
  TenantConfigResolver,
} from "../app/lib/tenant-config-resolver.ts";

test("Raven adapter preserves existing identity and public values", () => {
  const tenant = RAVEN_STUDIOOS_TENANT_CONFIG;
  assert.equal(tenant.schemaVersion, TENANT_SCHEMA_VERSION);
  assert.equal(tenant.tenantId, "raven-oracle");
  assert.equal(tenant.tenantKey, "raven-oracle");
  assert.equal(tenant.guildId, "raven-guild");
  assert.equal(tenant.identity.primaryCharacterId, "raven");
  assert.equal(tenant.urls.publicUrl, "https://raven.fortunestudios.jp");
  assert.equal(tenant.urls.profileUrl, "https://raven.fortunestudios.jp/guild/");
});

test("Raven engine slices retain legacy values", () => {
  const tenant = RAVEN_STUDIOOS_TENANT_CONFIG;
  assert.equal(tenant.sns.defaultCta, "必要なら、レイヴン・ブラックウッドのテキスト鑑定で一緒に整理します。");
  assert.deepEqual(tenant.sns.hashtags, ["#レイヴンブラックウッド", "#文章鑑定", "#相談整理"]);
  assert.equal(tenant.sns.defaultLocale, "ja-JP");
  assert.equal(tenant.sns.providerRefs.instagram, "instagram");
  assert.equal(tenant.sns.storageRefs.publicBaseUrl, tenant.urls.publicUrl);
  assert.equal(tenant.blog.defaultAuthor, "レイヴン・ブラックウッド");
  assert.equal(tenant.reel.defaultDuration, 30);
  assert.equal(tenant.reel.defaultAspectRatio, "9:16");
  assert.equal(tenant.growth.tenantId, "raven-oracle");
  assert.equal(tenant.openingCampaign?.campaignId, "raven-guild-opening");
  assert.equal(tenant.openingCampaign?.audience, "raven-site-members");
  assert.equal(tenant.openingCampaign?.primaryCta, "無料登録");
  assert.equal(tenant.openingCampaign?.secondaryCta, "詳しく見る");
});

test("resolver exposes slices without returning the whole tenant", () => {
  const resolver = new TenantConfigResolver();
  assert.equal(resolver.getTenantIdentity("raven-oracle").tenantId, "raven-oracle");
  assert.equal(resolver.getTenantLocalization("raven-oracle").locale, "ja-JP");
  assert.equal(resolver.getAnalyticsConfig("raven-oracle").eventNamespace, "raven-oracle");
  assert.equal(resolver.getBlogConfig("raven-oracle").publicBaseUrl, "https://raven.fortunestudios.jp");
  assert.equal(resolver.getSnsConfig("raven-oracle").tenantId, "raven-oracle");
  assert.throws(() => resolver.getSnsConfig("unknown-tenant"), /Unknown tenant/);
  assert.equal(resolver.getReelConfig("raven-oracle").storage.namespace, "reel-assets");
  assert.equal(resolver.getReelConfig("raven-oracle").tenantId, "raven-oracle");
  assert.equal(resolver.getReelConfig("raven-oracle").storageRef, "reel-assets");
  assert.equal(resolver.getReelConfig("raven-oracle").backgroundLibraryRef, "media_video_assets");
  assert.equal(resolver.getReelConfig("raven-oracle").publicBaseUrl, "https://raven.fortunestudios.jp");
  assert.equal(resolver.getGrowthConfig("raven-oracle").tenantId, "raven-oracle");
  assert.deepEqual(resolver.getEntitlements("raven-oracle").tenantOverrides, {});
  assert.equal("persona" in resolver.getTenantConfig("raven-oracle"), false);
  assert.equal(RAVEN_CHARACTER_CORE.displayName, "レイヴン・ブラックウッド");
});

test("unknown tenants are not silently mapped to Raven", () => {
  const resolver = new TenantConfigResolver();
  assert.equal(resolver.getTenantConfig("luna-starwind"), undefined);
  assert.throws(() => resolver.requireTenantConfig("luna-starwind"), UnknownTenantError);
  assert.throws(() => resolver.getSnsConfig("luna-starwind"), UnknownTenantError);
});

test("missing required contract fields are rejected", () => {
  const missing = validateTenantConfig({ tenantId: "broken" });
  assert.ok(missing.includes("schemaVersion"));
  assert.ok(missing.includes("urls.publicUrl"));
  assert.throws(() => new TenantConfigResolver([{}]), InvalidTenantConfigError);
});

test("character boundary keeps persona data outside TenantConfig", () => {
  const tenant = adaptRavenTenantConfig();
  assert.equal("persona" in tenant, false);
  assert.equal(RAVEN_CHARACTER_CORE.characterId, tenant.characterRef);
  assert.equal(RAVEN_CHARACTER_CORE.ctaDefaults.default, tenant.sns.defaultCta);
});
