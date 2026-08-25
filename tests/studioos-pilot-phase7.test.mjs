import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  LUNA_CHARACTER_CORE,
  resolveMarketPersona,
  resolveTenantMarket,
} from "../app/lib/studioos-market.ts";
import {
  LUNA_MIGRATION_STATE,
  LUNA_PROVISIONING_MANIFEST,
  LUNA_TENANT_CONFIG,
  buildPilotVersionCenterEntries,
  pilotEntitlementResolver,
  pilotTenantConfigResolver,
  resolvePilotAnalyticsConfig,
  resolvePilotBlogConfig,
  resolvePilotGrowthConfig,
  resolvePilotReelConfig,
  resolvePilotSnsConfig,
  resolvePilotTenantConfig,
} from "../app/lib/studioos-pilot.ts";
import { UnknownTenantError } from "../app/lib/tenant-config-resolver.ts";

test("Luna pilot TenantConfig resolves independently", () => {
  const config = resolvePilotTenantConfig("luna-oracle");
  assert.equal(config.tenantId, "luna-oracle");
  assert.equal(config.guildId, "raven-guild");
  assert.equal(config.identity.primaryCharacterId, "luna");
  assert.equal(config.urls.publicUrl, "https://preview.invalid/luna");
  assert.equal(config.openingCampaign?.enabled, false);
  assert.equal(config.openingCampaign?.trialEnabled, false);
});

test("Luna Character Core and JP Market Persona resolve", () => {
  const market = resolveTenantMarket("luna-oracle");
  const persona = resolveMarketPersona("luna", "jp");
  assert.equal(market.character.characterId, LUNA_CHARACTER_CORE.characterId);
  assert.equal(market.market.locale, "ja-JP");
  assert.equal(market.market.currency, "JPY");
  assert.equal(market.market.timezone, "Asia/Tokyo");
  assert.equal(persona.ctaStyle, "community-oriented");
  assert.equal(persona.relationshipDistance, "friendly");
});

test("all five Engine Slices resolve Luna values without Raven values", () => {
  const analytics = resolvePilotAnalyticsConfig("luna-oracle");
  const blog = resolvePilotBlogConfig("luna-oracle");
  const sns = resolvePilotSnsConfig("luna-oracle");
  const reel = resolvePilotReelConfig("luna-oracle");
  const growth = resolvePilotGrowthConfig("luna-oracle");
  assert.equal(analytics.tenantId, "luna-oracle");
  assert.equal(blog.defaultAuthor, "Luna");
  assert.equal(sns.displayName, "Luna");
  assert.equal(reel.tenantId, "luna-oracle");
  assert.equal(reel.storage.namespace, "luna-oracle-preview-media");
  assert.equal(growth.tenantId, "luna-oracle");
  assert.ok(!JSON.stringify({ analytics, blog, sns, reel, growth }).includes("raven.fortunestudios.jp"));
});

test("Luna Entitlements and Growth safety remain human-controlled", () => {
  const decisions = pilotEntitlementResolver.resolveAllFeatures("luna-oracle");
  assert.equal(decisions.find((item) => item.feature === "analytics")?.allowed, true);
  assert.equal(decisions.find((item) => item.feature === "growth")?.allowed, true);
  const growth = resolvePilotGrowthConfig("luna-oracle");
  assert.equal(growth.experimentPolicy?.requiresStartApproval, true);
  assert.equal(growth.experimentPolicy?.autoStart, false);
  assert.equal(growth.approvalPolicy?.humanApprovalRequired, true);
});

test("Raven and Luna stay isolated", () => {
  const raven = pilotTenantConfigResolver.requireTenantConfig("raven-oracle");
  const luna = pilotTenantConfigResolver.requireTenantConfig("luna-oracle");
  assert.notEqual(raven.tenantId, luna.tenantId);
  assert.notEqual(raven.identity.displayName, luna.identity.displayName);
  assert.notEqual(raven.urls.publicUrl, luna.urls.publicUrl);
  assert.notEqual(raven.sns.hashtags.join("|"), luna.sns.hashtags.join("|"));
  assert.notEqual(raven.storage.reelNamespace, luna.storage.reelNamespace);
  assert.equal(raven.openingCampaign?.campaignId, "raven-guild-opening");
  assert.equal(luna.openingCampaign?.enabled, false);
  assert.notEqual(raven.openingCampaign?.campaignId, luna.openingCampaign?.campaignId);
});

test("unknown pilot tenant has no Raven fallback", () => {
  assert.throws(() => resolvePilotTenantConfig("missing-pilot"), UnknownTenantError);
  assert.throws(() => pilotEntitlementResolver.resolveAllFeatures("missing-pilot"), UnknownTenantError);
});

test("Pilot Version Center shows Raven production and Luna preview/planned", () => {
  const entries = buildPilotVersionCenterEntries();
  const raven = entries.find((entry) => entry.tenant.tenantId === "raven-oracle");
  const luna = entries.find((entry) => entry.tenant.tenantId === "luna-oracle");
  assert.equal(raven?.tenant.status, "active");
  assert.equal(luna?.tenant.status, "planned");
  assert.equal(luna?.tenant.environment, "preview");
  assert.equal(luna?.migration.migrationState, "not_provisioned");
  assert.equal(luna?.worker?.workerName, "luna-oracle-preview");
});

test("Provisioning manifest is preview-only and contains secret names only", () => {
  assert.equal(LUNA_PROVISIONING_MANIFEST.readiness, "PREVIEW_READY");
  assert.equal(LUNA_PROVISIONING_MANIFEST.executionAllowed, false);
  assert.deepEqual(LUNA_MIGRATION_STATE, { migrationState: "not_provisioned", d1MigrationVersion: null, migrationLedgerRef: null, schemaCompatibility: "compatible" });
  assert.ok(LUNA_PROVISIONING_MANIFEST.requiredSecrets.every((name) => /^[A-Z0-9_]+$/.test(name)));
  assert.doesNotMatch(JSON.stringify(LUNA_PROVISIONING_MANIFEST), /sk-|Bearer |password|secret-value|token=/i);
});

test("Raven production source files are not modified by the pilot fixture", async () => {
  const pilotSource = await readFile(new URL("../app/lib/studioos-pilot.ts", import.meta.url), "utf8");
  assert.match(pilotSource, /luna-oracle/);
  assert.match(pilotSource, /preview\.invalid\/luna/);
  assert.match(pilotSource, /openingCampaign: \{ enabled: false/);
  assert.equal(LUNA_TENANT_CONFIG.urls.publicUrl.startsWith("https://preview.invalid/"), true);
});
