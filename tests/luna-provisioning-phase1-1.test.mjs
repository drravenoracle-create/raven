import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeContext, resolveTenantIdFromHint, resolveTenantIdFromHost, UnknownRuntimeTenantError } from "../app/lib/studioos-runtime-adapter.ts";
import { readMemberFixture, readTenantMemberFixture } from "../app/lib/studioos-member-isolation-fixture.ts";

test("runtime host and legacy alias mapping is explicit", () => {
  assert.equal(resolveTenantIdFromHost("raven.fortunestudios.jp"), "raven-oracle");
  assert.equal(resolveTenantIdFromHost("luna.fortunestudios.jp:443"), "luna-oracle");
  assert.equal(resolveTenantIdFromHint("luna-starwind"), "luna-oracle");
  assert.throws(() => resolveTenantIdFromHost("unknown.fortunestudios.jp"), UnknownRuntimeTenantError);
  assert.throws(() => resolveTenantIdFromHint("unknown-tenant"), UnknownRuntimeTenantError);
});

test("Raven and Luna resolve independently through all slices", () => {
  const raven = resolveRuntimeContext({ host: "raven.fortunestudios.jp" });
  const luna = resolveRuntimeContext({ host: "luna.fortunestudios.jp" });
  assert.equal(raven.tenantId, "raven-oracle");
  assert.equal(luna.tenantId, "luna-oracle");
  assert.equal(luna.character.characterId, "luna");
  assert.equal(luna.localization.locale, "ja-JP");
  for (const slice of [luna.analytics, luna.blog, luna.sns, luna.reel, luna.growth]) assert.equal(slice.tenantId, "luna-oracle");
  assert.equal(luna.growth.experimentPolicy?.requiresStartApproval, true);
  assert.equal(luna.growth.experimentPolicy?.autoStart, false);
  assert.equal(luna.growth.approvalPolicy?.humanApprovalRequired, true);
  assert.notEqual(luna.config.urls.publicUrl, raven.config.urls.publicUrl);
  assert.notEqual(luna.sns.hashtags.join(" "), raven.sns.hashtags.join(" "));
});

test("legacy Luna alias returns canonical Luna context without Raven fallback", () => {
  const context = resolveRuntimeContext({ tenantHint: "luna-starwind" });
  assert.equal(context.tenantId, "luna-oracle");
  assert.equal(context.alias?.source, "legacy");
  assert.equal(context.character.characterId, "luna");
});

test("Guild Member Core-shaped fixture remains tenant isolated", () => {
  const rows = [
    { memberId: "r-member", tenantId: "raven-oracle", guildId: "raven-guild", characterId: "raven", value: "raven-reading" },
    { memberId: "l-member", tenantId: "luna-oracle", guildId: "raven-guild", characterId: "luna", value: "luna-reading" },
  ];
  assert.deepEqual(readTenantMemberFixture(rows, "luna-oracle").map((row) => row.value), ["luna-reading"]);
  assert.deepEqual(readMemberFixture(rows, { tenantId: "luna-oracle", memberId: "r-member" }), []);
  assert.deepEqual(readTenantMemberFixture(rows, "unknown-tenant"), []);
});
