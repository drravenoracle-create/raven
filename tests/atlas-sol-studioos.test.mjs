import test from "node:test";
import assert from "node:assert/strict";
import { resolveRuntimeContext, resolveTenantIdFromHost } from "../app/lib/studioos-runtime-adapter.ts";

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
