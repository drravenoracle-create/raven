import test from "node:test";
import assert from "node:assert/strict";
import { getSexagenaryDay } from "../app/lib/calendar/sexagenary.ts";

test("verified reference date is 丁卯日 index 3", () => {
  const day = getSexagenaryDay("2026-08-21");
  assert.equal(day.index, 3);
  assert.equal(day.name, "丁卯");
});

test("sexagenary cycle advances and wraps after 60 days", () => {
  assert.equal(getSexagenaryDay("2026-08-22").index, 4);
  assert.equal(getSexagenaryDay("2026-10-19").index, 2);
  assert.equal(getSexagenaryDay("2026-10-20").index, 3);
});

test("invalid local dates are rejected", () => {
  assert.throws(() => getSexagenaryDay("2026/08/21"));
});
