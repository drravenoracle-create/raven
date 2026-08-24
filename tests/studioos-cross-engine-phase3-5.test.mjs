import assert from "node:assert/strict";
import test from "node:test";
import { RAVEN_STUDIOOS_TENANT_CONFIG } from "../app/lib/studioos-tenant-config.ts";
import { TenantConfigResolver, UnknownTenantError } from "../app/lib/tenant-config-resolver.ts";

function testTenantConfig() {
  const config = structuredClone(RAVEN_STUDIOOS_TENANT_CONFIG);
  config.tenantId = "test-tenant";
  config.tenantKey = "test-tenant";
  config.guildId = "test-guild";
  config.identity = { ...config.identity, tenantId: "test-tenant", tenantKey: "test-tenant", guildId: "test-guild", displayName: "Test Tenant" };
  config.branding = { ...config.branding, displayName: "Test Character" };
  config.urls = { ...config.urls, publicUrl: "https://test.example.test" };
  config.localization = { ...config.localization, locale: "en-US", language: "en", country: "US" };
  config.market = { ...config.market, marketId: "us", country: "US" };
  config.analytics = { ...config.analytics, tenantId: "test-tenant", eventNamespace: "test-tenant", publicUrl: "https://test.example.test/" };
  config.blog = { ...config.blog, tenantId: "test-tenant", defaultCta: "Test blog CTA", publicBaseUrl: "https://test.example.test" };
  config.sns = { ...config.sns, tenantId: "test-tenant", displayName: "Test Character", defaultCta: "Test SNS CTA", hashtags: ["#test"], publicBaseUrl: "https://test.example.test", defaultLocale: "en-US" };
  config.reel = { ...config.reel, tenantId: "test-tenant", publicBaseUrl: "https://test.example.test", defaultLocale: "en-US", storage: { namespace: "test-reel-assets" }, storageRef: "test-reel-assets" };
  config.growth = { ...config.growth, tenantId: "test-tenant", defaultMarket: "us", defaultLocale: "en-US", targetAudience: "test-audience", providerRefs: { analytics: "test-analytics", sns: "test-sns" } };
  config.storage = { ...config.storage, mediaNamespace: "test-media", reelNamespace: "test-reel-assets", publicBaseUrl: "https://test.example.test" };
  return config;
}

test("all engine slices resolve a coherent Raven tenant contract", () => {
  const resolver = new TenantConfigResolver();
  const identity = resolver.getTenantIdentity("raven-oracle");
  const localization = resolver.getTenantLocalization("raven-oracle");
  const analytics = resolver.getAnalyticsConfig("raven-oracle");
  const blog = resolver.getBlogConfig("raven-oracle");
  const sns = resolver.getSnsConfig("raven-oracle");
  const reel = resolver.getReelConfig("raven-oracle");
  const growth = resolver.getGrowthConfig("raven-oracle");
  const campaign = resolver.getTenantConfig("raven-oracle").openingCampaign;
  const tenant = resolver.getTenantConfig("raven-oracle");

  for (const slice of [analytics, blog, sns, reel, growth]) assert.equal(slice.tenantId, "raven-oracle");
  assert.equal(identity.tenantId, "raven-oracle");
  assert.equal(tenant.branding.displayName, sns.displayName);
  assert.equal(analytics.publicUrl.replace(/\/$/, ""), blog.publicBaseUrl);
  assert.equal(blog.publicBaseUrl, sns.publicBaseUrl);
  assert.equal(sns.publicBaseUrl, reel.publicBaseUrl);
  assert.equal(localization.locale, sns.defaultLocale);
  assert.equal(localization.locale, reel.defaultLocale);
  assert.equal(growth.defaultLocale, localization.locale);
  assert.equal(growth.defaultMarket, "jp");
  assert.equal(campaign.primaryCta, "無料登録");
  assert.equal(campaign.secondaryCta, "詳しく見る");
});

test("unknown tenants never fall back across engine slices", () => {
  const resolver = new TenantConfigResolver();
  for (const accessor of ["getTenantIdentity", "getTenantLocalization", "getAnalyticsConfig", "getBlogConfig", "getSnsConfig", "getReelConfig", "getGrowthConfig", "getEntitlements"]) {
    assert.throws(() => resolver[accessor]("unknown-tenant"), UnknownTenantError);
  }
});

test("a fixture tenant stays isolated across Blog, SNS, Reel, Analytics and Growth", () => {
  const resolver = new TenantConfigResolver([RAVEN_STUDIOOS_TENANT_CONFIG, testTenantConfig()]);
  const testTenant = resolver.getTenantConfig("test-tenant");
  const ravenSns = resolver.getSnsConfig("raven-oracle");
  const testSns = resolver.getSnsConfig("test-tenant");
  const testReel = resolver.getReelConfig("test-tenant");
  const testAnalytics = resolver.getAnalyticsConfig("test-tenant");
  const testGrowth = resolver.getGrowthConfig("test-tenant");

  assert.equal(testTenant.urls.publicUrl, "https://test.example.test");
  assert.notEqual(testSns.defaultCta, ravenSns.defaultCta);
  assert.deepEqual(testSns.hashtags, ["#test"]);
  assert.equal(testReel.storage.namespace, "test-reel-assets");
  assert.equal(testAnalytics.eventNamespace, "test-tenant");
  assert.equal(testGrowth.tenantId, "test-tenant");
  assert.equal(testGrowth.defaultMarket, "us");
  assert.equal(testGrowth.defaultLocale, "en-US");
  assert.equal(testGrowth.targetAudience, "test-audience");
});

test("cross-engine boundaries preserve values and Growth remains human-controlled", () => {
  const resolver = new TenantConfigResolver();
  const blog = resolver.getBlogConfig("raven-oracle");
  const sns = resolver.getSnsConfig("raven-oracle");
  const reel = resolver.getReelConfig("raven-oracle");
  const analytics = resolver.getAnalyticsConfig("raven-oracle");
  const growth = resolver.getGrowthConfig("raven-oracle");

  assert.equal(sns.publicBaseUrl, blog.publicBaseUrl);
  assert.equal(reel.publicBaseUrl, sns.publicBaseUrl);
  assert.equal(analytics.tenantId, growth.tenantId);
  assert.equal(growth.experimentPolicy.autoStart, false);
  assert.equal(growth.experimentPolicy.requiresStartApproval, true);
  assert.equal(growth.approvalPolicy.humanApprovalRequired, true);
  assert.ok(growth.approvalPolicy.restrictedActions.includes("campaign"));
  assert.ok(growth.approvalPolicy.restrictedActions.includes("sns_publish"));
  assert.equal(JSON.stringify(growth).includes("token"), false);
  assert.equal(JSON.stringify(growth).includes("secret"), false);
});
