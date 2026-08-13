import assert from "node:assert/strict";
import test from "node:test";
import { decorateCard, parseJsonList, selectCardCandidates } from "../app/lib/card-library.ts";

function card(id, usage_count = 0) {
  return {
    id,
    tenant_id: "raven-oracle",
    deck_id: "deck-1",
    card_number: Number(id.replace(/\D/g, "")) || 0,
    name: id,
    name_ja: id,
    image_url: "",
    storage_provider: "url",
    storage_key: "",
    upright_meaning: "",
    reversed_meaning: "",
    love_meaning: "",
    work_meaning: "",
    money_meaning: "",
    keywords_json: "[\"focus\"]",
    tags_json: "[\"daily\",\"sns\"]",
    sns_summary: "",
    sns_use_allowed: 1,
    enabled: 1,
    sort_order: Number(id.replace(/\D/g, "")) || 0,
    created_at: "",
    updated_at: "",
    usage_count,
  };
}

test("Card Library parses JSON list safely", () => {
  assert.deepEqual(parseJsonList("[\"daily\",\"sns\"]"), ["daily", "sns"]);
  assert.deepEqual(parseJsonList("broken"), []);
});

test("Card Library decorates cards with keywords and tags", () => {
  const decorated = decorateCard(card("card-1"));
  assert.deepEqual(decorated.keywords, ["focus"]);
  assert.deepEqual(decorated.tags, ["daily", "sns"]);
});

test("least_used selection prioritizes lower usage and does not duplicate", () => {
  const selected = selectCardCandidates([card("card-1", 5), card("card-2", 0), card("card-3", 2)], 2, "least_used");
  assert.deepEqual(selected.map((item) => item.id), ["card-2", "card-3"]);
  assert.equal(new Set(selected.map((item) => item.id)).size, selected.length);
});

test("random selection returns requested unique count within pool size", () => {
  const selected = selectCardCandidates([card("card-1"), card("card-2"), card("card-3")], 3, "random");
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((item) => item.id)).size, 3);
});
