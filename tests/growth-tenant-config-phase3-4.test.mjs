import assert from "node:assert/strict";
import test from "node:test";
import { RAVEN_STUDIOOS_TENANT_CONFIG } from "../app/lib/studioos-tenant-config.ts";
import { UnknownTenantError, resolveGrowthConfig } from "../app/lib/tenant-config-resolver.ts";

test("GrowthConfigSlice resolves Raven settings without changing the legacy tenant", () => {
  const config = resolveGrowthConfig("raven-oracle");
  assert.equal(config.tenantId, "raven-oracle");
  assert.equal(config.enabled, true);
  assert.deepEqual(config.kpi, RAVEN_STUDIOOS_TENANT_CONFIG.growth.kpi);
  assert.equal(config.targetAudience, undefined);
  assert.equal(config.automationLevel, "read-only");
  assert.deepEqual(config.constraints, []);
  assert.equal(config.defaultMarket, "jp");
  assert.equal(config.defaultLocale, "ja-JP");
  assert.deepEqual(config.providerRefs, { analytics: "external-connectors", sns: "sns-engine" });
});

test("Growth safety policy remains human-controlled and cannot be enabled by the slice", () => {
  const config = resolveGrowthConfig("raven-oracle");
  assert.deepEqual(config.experimentPolicy, { requiresStartApproval: true, autoStart: false });
  assert.equal(config.approvalPolicy?.humanApprovalRequired, true);
  for (const action of ["price", "trial", "billing", "campaign", "character", "menu", "advertising", "external_send", "sns_publish"]) {
    assert.ok(config.approvalPolicy?.restrictedActions.includes(action));
  }
});

test("unknown Growth tenants never fall back to Raven", () => {
  assert.throws(() => resolveGrowthConfig("unknown-growth-tenant"), UnknownTenantError);
});

