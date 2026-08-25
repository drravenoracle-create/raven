import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  GUILD_MARKET_DEFAULTS,
  MARKET_CONFIGS,
  MARKET_PERSONAS,
  LocalizationResolver,
  UnknownCharacterError,
  UnknownMarketError,
  UnknownTenantMarketError,
  getCharacterCoreForMarket,
  resolveLocalization,
  resolveMarketPersona,
  resolveTenantMarket,
} from "../app/lib/studioos-market.ts";

test("Japan market resolves Raven Core and JP persona", () => {
  const resolved = resolveTenantMarket("raven-oracle");
  assert.deepEqual({ market: resolved.market.marketId, country: resolved.market.country, locale: resolved.market.locale, currency: resolved.market.currency, timezone: resolved.market.timezone }, { market: "jp", country: "JP", locale: "ja-JP", currency: "JPY", timezone: "Asia/Tokyo" });
  assert.equal(resolved.character.characterId, "raven");
  assert.equal(resolved.persona.marketId, "jp");
});

test("English fixture reuses the same Character Core with market-only differences", () => {
  const jp = resolveMarketPersona("raven", "jp");
  const en = resolveTenantMarket("test-up-to-date");
  assert.equal(en.character.characterId, "raven");
  assert.equal(en.persona.marketId, "en-us");
  assert.equal(en.market.locale, "en-US");
  assert.equal(en.market.currency, "USD");
  assert.equal(en.character.canonicalName, getCharacterCoreForMarket("raven").canonicalName);
  assert.notEqual(jp.tone, en.persona.tone);
  assert.notEqual(jp.ctaStyle, en.persona.ctaStyle);
});

test("Core identity is invariant while Persona carries market differences", () => {
  const jp = new LocalizationResolver().resolveTenantMarket("raven-oracle");
  const en = new LocalizationResolver().resolveTenantMarket("test-up-to-date");
  assert.deepEqual(en.character, jp.character);
  assert.notDeepEqual(en.persona, jp.persona);
});

test("Tenant override wins over Market, Guild and Platform defaults", () => {
  const resolver = new LocalizationResolver({
    bindings: [{ tenantId: "override-tenant", guildId: "test-global-guild", characterId: "raven", marketId: "en-us", localizationOverrides: { locale: "en-GB", currency: "GBP", timezone: "Europe/London" } }],
  });
  const resolved = resolver.resolveTenantMarket("override-tenant");
  assert.equal(resolved.market.locale, "en-GB");
  assert.equal(resolved.market.currency, "GBP");
  assert.equal(resolved.market.timezone, "Europe/London");
  assert.equal(resolved.persona.marketId, "en-us");
});

test("Unknown market, character and tenant do not fall back", () => {
  assert.throws(() => resolveMarketPersona("raven", "missing-market"), UnknownMarketError);
  assert.throws(() => getCharacterCoreForMarket("missing-character"), UnknownCharacterError);
  assert.throws(() => resolveTenantMarket("missing-tenant"), UnknownTenantMarketError);
  assert.equal(resolveLocalization("raven-oracle").marketId, "jp");
});

test("Market and registry contracts expose future legal, pricing and localization boundaries", () => {
  assert.equal(MARKET_CONFIGS.jp.pricingRegion, "JP");
  assert.equal(MARKET_CONFIGS["en-us"].legalRegion, "US");
  assert.equal(GUILD_MARKET_DEFAULTS["raven-guild"].defaultMarket, "jp");
  assert.ok(MARKET_PERSONAS.every((persona) => Array.isArray(persona.culturalRules)));
});

test("market read APIs are GET-only", async () => {
  for (const path of ["../app/api/admin/studioos/markets/route.ts", "../app/api/admin/studioos/market-personas/route.ts"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /export async function GET/);
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/);
  }
});
