import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeContext, resolveTenantIdFromHint, resolveTenantIdFromHost, UnknownRuntimeTenantError } from "../app/lib/studioos-runtime-adapter.ts";
import { readMemberFixture, readTenantMemberFixture } from "../app/lib/studioos-member-isolation-fixture.ts";

test("Scarlet host and legacy identity resolve explicitly", () => {
  assert.equal(resolveTenantIdFromHost("scarlet.fortunestudios.jp"), "scarlet-donovan");
  assert.equal(resolveTenantIdFromHint("scarlet-guardian"), "scarlet-donovan");
  assert.throws(() => resolveTenantIdFromHost("unknown.fortunestudios.jp"), UnknownRuntimeTenantError);
});

test("Scarlet resolves through isolated StudioOS slices", () => {
  const scarlet = resolveRuntimeContext({ host: "scarlet.fortunestudios.jp" });
  assert.equal(scarlet.tenantId, "scarlet-donovan");
  assert.equal(scarlet.character.characterId, "scarlet");
  assert.equal(scarlet.config.guildId, "raven-guild");
  assert.equal(scarlet.localization.locale, "ja-JP");
  assert.equal(scarlet.config.market.marketId, "jp");
  for (const slice of [scarlet.analytics, scarlet.blog, scarlet.sns, scarlet.reel, scarlet.growth]) assert.equal(slice.tenantId, "scarlet-donovan");
  assert.equal(scarlet.growth.experimentPolicy?.requiresStartApproval, true);
  assert.equal(scarlet.growth.experimentPolicy?.autoStart, false);
  assert.notEqual(scarlet.config.urls.publicUrl, "https://luna.fortunestudios.jp");
});

test("Scarlet member fixture stays isolated from Raven and Luna", () => {
  const rows = [
    { memberId: "shared-member", tenantId: "raven-oracle", guildId: "raven-guild", characterId: "raven", value: "raven" },
    { memberId: "shared-member", tenantId: "luna-oracle", guildId: "raven-guild", characterId: "luna", value: "luna" },
    { memberId: "shared-member", tenantId: "scarlet-donovan", guildId: "raven-guild", characterId: "scarlet", value: "scarlet" },
  ];
  assert.deepEqual(readTenantMemberFixture(rows, "scarlet-donovan").map((row) => row.value), ["scarlet"]);
  assert.deepEqual(readMemberFixture(rows, { tenantId: "scarlet-donovan", memberId: "shared-member" }).map((row) => row.value), ["scarlet"]);
  assert.deepEqual(readMemberFixture(rows, { tenantId: "scarlet-donovan", memberId: "raven-member" }), []);
});
