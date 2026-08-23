import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../drizzle/0021_sns_format_presets_v1.sql", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/sns/templates/route.ts", import.meta.url), "utf8");
const detailRoute = await readFile(new URL("../app/api/sns/templates/[id]/route.ts", import.meta.url), "utf8");

const presetKeys = [
  "destiny_stop_one_card",
  "next_72_hours_three_choice",
  "raven_truth",
  "divination_clash",
  "first_sight_card",
  "community_oracle",
  "guild_debate",
  "card_myth_buster",
  "oracle_behind_scenes",
  "future_self_message",
];

test("registers the ten SNS format presets", () => {
  for (const key of presetKeys) assert.match(migration, new RegExp(`'${key}'`));
  assert.equal((migration.match(/is_system_preset = 1/g) || []).length >= 1, true);
});

test("keeps the existing three-choice renderer as the 72-hour format renderer", () => {
  assert.match(migration, /WHEN 'next_72_hours_three_choice' THEN 'three_choice'/);
  assert.match(migration, /'three_choice_reading'/);
});

test("exposes preset feature flag and draft metadata actions", () => {
  assert.match(route, /sns_format_presets_v1_enabled/);
  assert.match(detailRoute, /action === "create_post"/);
  assert.match(detailRoute, /sns_post_format_metadata/);
});
