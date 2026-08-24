import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { RAVEN_STUDIOOS_TENANT_CONFIG, TENANT_SCHEMA_VERSION } from "../app/lib/studioos-tenant-config.ts";
import { FeatureEntitlementResolver, PLAN_DEFAULTS } from "../app/lib/feature-entitlements.ts";
import { TenantConfigResolver, UnknownTenantError } from "../app/lib/tenant-config-resolver.ts";
import { ENGINE_VERSIONS, STUDIOOS_VERSION, buildTenantVersionSummary, getBuildInfo, resolveVersionStatus } from "../app/lib/studioos-version.ts";

function resolverFor(planId, featureFlags = {}, tenantOverrides = {}) {
  const config = structuredClone(RAVEN_STUDIOOS_TENANT_CONFIG);
  config.tenantId = `fixture-${planId.toLowerCase()}`;
  config.tenantKey = config.tenantId;
  config.identity = { ...config.identity, tenantId: config.tenantId, tenantKey: config.tenantId };
  config.analytics = { ...config.analytics, tenantId: config.tenantId, eventNamespace: config.tenantId };
  config.blog = { ...config.blog, tenantId: config.tenantId };
  config.sns = { ...config.sns, tenantId: config.tenantId };
  config.reel = { ...config.reel, tenantId: config.tenantId };
  config.growth = { ...config.growth, tenantId: config.tenantId };
  config.plan = { planId, planVersion: "1" };
  config.entitlements = { ...config.entitlements, featureFlags, tenantOverrides };
  return new FeatureEntitlementResolver(new TenantConfigResolver([config]));
}

test("VERSION and engine manifest expose valid independent SemVer values", async () => {
  const versionFile = (await readFile(new URL("../VERSION", import.meta.url), "utf8")).trim();
  assert.equal(versionFile, STUDIOOS_VERSION);
  assert.match(STUDIOOS_VERSION, /^\d+\.\d+\.\d+$/);
  for (const version of Object.values(ENGINE_VERSIONS)) assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(TENANT_SCHEMA_VERSION, 1);
});

test("build metadata and version status distinguish unknown, updates and migrations", () => {
  const unknownBuild = getBuildInfo({ environment: "test" });
  assert.equal(unknownBuild.buildCommit, null);
  assert.equal(unknownBuild.tenantSchemaVersion, TENANT_SCHEMA_VERSION);
  assert.equal(resolveVersionStatus({ currentVersion: "1.0.0", targetVersion: "1.0.0", tenantSchemaVersion: 1 }), "UP_TO_DATE");
  assert.equal(resolveVersionStatus({ currentVersion: "1.0.0", targetVersion: "1.1.0", tenantSchemaVersion: 1 }), "UPDATE_AVAILABLE");
  assert.equal(resolveVersionStatus({ currentVersion: "1.0.0", targetVersion: "1.0.0", tenantSchemaVersion: 1, requiredTenantSchemaVersion: 2 }), "MIGRATION_REQUIRED");
  assert.equal(resolveVersionStatus({ currentVersion: "1.0.0", targetVersion: "1.0.0", tenantSchemaVersion: 1, compatibility: "incompatible" }), "INCOMPATIBLE");
  assert.equal(resolveVersionStatus({ currentVersion: "invalid", targetVersion: "1.0.0", tenantSchemaVersion: 1 }), "ATTENTION_REQUIRED");
  assert.equal(buildTenantVersionSummary(RAVEN_STUDIOOS_TENANT_CONFIG).status, "UP_TO_DATE");
});

test("plan defaults expose the intended LIGHT, STANDARD and PREMIUM capabilities", () => {
  const light = resolverFor("LIGHT");
  const standard = resolverFor("STANDARD");
  const premium = resolverFor("PREMIUM");
  assert.equal(light.resolveFeature("fixture-light", "analytics").allowed, true);
  assert.equal(light.resolveFeature("fixture-light", "growth").allowed, false);
  assert.equal(standard.resolveFeature("fixture-standard", "blog").allowed, true);
  assert.equal(standard.resolveFeature("fixture-standard", "sns").allowed, true);
  assert.equal(standard.resolveFeature("fixture-standard", "growth").allowed, false);
  assert.equal(premium.resolveFeature("fixture-premium", "growth").allowed, true);
  assert.equal(PLAN_DEFAULTS.PREMIUM.growth, true);
});

test("feature flags and tenant overrides return auditable decisions", () => {
  const flagOff = resolverFor("PREMIUM", { growth: false });
  const denied = flagOff.resolveFeature("fixture-premium", "growth");
  assert.deepEqual({ allowed: denied.allowed, source: denied.source, reason: denied.reason }, { allowed: false, source: "flag", reason: "feature_flag_off" });

  const overrideAllow = resolverFor("STANDARD", {}, { blog: "allow" });
  const allowed = overrideAllow.resolveFeature("fixture-standard", "blog");
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.source, "override");

  const overrideDeny = resolverFor("PREMIUM", {}, { growth: "deny" });
  const deniedByTenant = overrideDeny.resolveFeature("fixture-premium", "growth");
  assert.equal(deniedByTenant.allowed, false);
  assert.equal(deniedByTenant.source, "override");

  const planCannotBeBypassed = resolverFor("LIGHT", {}, { growth: "allow" }).resolveFeature("fixture-light", "growth");
  assert.equal(planCannotBeBypassed.allowed, false);
  assert.equal(planCannotBeBypassed.reason, "plan_does_not_include_feature");
});

test("unknown tenant entitlement resolution is explicit and Growth hard safety remains separate", () => {
  const resolver = new FeatureEntitlementResolver();
  assert.throws(() => resolver.resolveFeature("unknown-tenant", "growth"), UnknownTenantError);
  const growth = RAVEN_STUDIOOS_TENANT_CONFIG.growth;
  assert.equal(growth.experimentPolicy.autoStart, false);
  assert.equal(growth.experimentPolicy.requiresStartApproval, true);
  assert.equal(growth.approvalPolicy.humanApprovalRequired, true);
});

test("read-only Admin/API boundaries exist without write endpoints", async () => {
  const adminPage = await readFile(new URL("../app/admin/studioos/page.tsx", import.meta.url), "utf8");
  const versionApi = await readFile(new URL("../app/api/admin/studioos/version/route.ts", import.meta.url), "utf8");
  const entitlementApi = await readFile(new URL("../app/api/admin/studioos/entitlements/route.ts", import.meta.url), "utf8");
  assert.match(adminPage, /Version & Entitlements/);
  assert.match(adminPage, /Migration Ledger/);
  assert.match(versionApi, /getAdminSession/);
  assert.match(entitlementApi, /resolveAllFeatures/);
  assert.doesNotMatch(versionApi, /export async function (POST|PATCH|PUT|DELETE)/);
  assert.doesNotMatch(entitlementApi, /export async function (POST|PATCH|PUT|DELETE)/);
});

