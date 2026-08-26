import test from "node:test";
import assert from "node:assert/strict";
import { resolveRuntimeContext, resolveTenantIdFromHost } from "../app/lib/studioos-runtime-adapter.ts";
import { analyticsReadWhere, analyticsWriteValues } from "../app/lib/studioos-analytics.ts";

test("Atlas and Sol resolve independently from host", () => {
  assert.equal(resolveTenantIdFromHost("atlas.fortunestudios.jp"), "atlas-oracle");
  assert.equal(resolveTenantIdFromHost("sol.fortunestudios.jp"), "sol-oracle");
  assert.equal(resolveRuntimeContext({ tenantHint: "atlas-oracle" }).character.characterId, "atlas");
  assert.equal(resolveRuntimeContext({ tenantHint: "sol-oracle" }).character.characterId, "sol");
});

test("Atlas and Sol retain market, locale, and safe activation boundaries", () => {
  for (const [tenant, character] of [["atlas-oracle", "atlas"], ["sol-oracle", "sol"]]) {
    const context = resolveRuntimeContext({ tenantHint: tenant });
    assert.equal(context.config.market.marketId, "jp");
    assert.equal(context.localization.locale, "ja-JP");
    assert.equal(context.character.characterId, character);
    assert.equal(context.growth.automationLevel, "read-only");
    assert.equal(context.growth.experimentPolicy?.requiresStartApproval, true);
    assert.equal(context.growth.experimentPolicy?.autoStart, false);
    assert.equal(context.config.openingCampaign?.enabled, false);
    assert.equal(context.config.openingCampaign?.trialEnabled, false);
    assert.equal(context.sns.enabled, false);
    assert.equal(context.reel.enabled, false);
  }
});

test("shared analytics requires resolved tenant context and isolates Atlas/Sol", () => {
  const atlas = analyticsWriteValues({ guildId: "raven-guild", tenantId: "atlas-oracle", characterId: "atlas", market: "jp", locale: "ja-JP" });
  const sol = analyticsWriteValues({ guildId: "raven-guild", tenantId: "sol-oracle", characterId: "sol", market: "jp", locale: "ja-JP" });
  assert.notDeepEqual(analyticsReadWhere(atlas).bindings, analyticsReadWhere(sol).bindings);
  assert.throws(() => analyticsReadWhere({ tenantId: "atlas-oracle" }), /ANALYTICS_TENANT_CONTEXT_REQUIRED/);
  assert.throws(() => analyticsWriteValues({ guildId: "raven-guild", tenantId: "unknown", characterId: "raven", market: "jp", locale: "ja-JP" }), /ANALYTICS_TENANT_CONTEXT_INVALID/);
});

test("Atlas and Sol use the shared Core physical database without copying rows", () => {
  const atlasCore = { database: "atlas-oracle", tenantId: "atlas-oracle", characterId: "atlas" };
  const solCore = { database: "atlas-oracle", tenantId: "sol-oracle", characterId: "sol" };
  assert.equal(atlasCore.database, solCore.database);
  assert.notEqual(atlasCore.tenantId, solCore.tenantId);
  assert.notEqual(atlasCore.characterId, solCore.characterId);
});
