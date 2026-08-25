import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const service = fs.readFileSync(new URL("../app/lib/sns-content-draft.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/sns/drafts/route.ts", import.meta.url), "utf8");
const detailRoute = fs.readFileSync(new URL("../app/api/sns/drafts/[id]/route.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/admin/sns/drafts/[id]/page.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../drizzle/0034_sns_content_drafts.sql", import.meta.url), "utf8");

test("Idea Candidate creates an idempotent structured Draft", () => {
  assert.match(service, /createContentDraft/);
  assert.match(service, /idea_candidate_id/);
  assert.match(service, /UNIQUE|version/);
  assert.match(service, /growth_sns_content_drafts/);
});
test("Draft supports structured three-choice placeholders", () => {
  for (const field of ["openingHook", "choicePrompt", "resultA", "resultB", "resultC", "closingCta"]) assert.match(service, new RegExp(field));
  assert.match(service, /THREE_CHOICE/);
});
test("Draft keeps platform, Character Config, locale and Evidence traceability", () => {
  for (const field of ["platformContent", "getCharacterConfig", "locale", "sourceRecommendationId", "sourcePatternId", "supportingEvidenceIds", "experimentIds"]) assert.match(service, new RegExp(field));
  assert.match(migration, /scope_json/);
});
test("Draft editing is structured and limited to safe fields", () => {
  assert.match(service, /validatePatch/);
  assert.match(service, /recommendedDuration/);
  assert.match(service, /READY_FOR_PREVIEW/);
  assert.match(service, /DISCARDED/);
  assert.match(page, /下書きを保存/);
  assert.match(page, /破棄/);
});
test("Draft layer has no publication boundary", () => {
  const source = `${service}\n${route}\n${detailRoute}`;
  assert.doesNotMatch(source, /publish|schedule|createExperiment|autonomous|external API write/i);
  assert.match(route, /createContentDraft/);
  assert.match(detailRoute, /updateContentDraft/);
});
