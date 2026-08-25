import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const preview = fs.readFileSync(new URL("../app/lib/sns-draft-preview.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/sns/drafts/[id]/preview/route.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/admin/sns/drafts/[id]/preview/page.tsx", import.meta.url), "utf8");

test("Draft produces a 9:16 visual Preview without persistence", () => {
  assert.match(preview, /1080/);
  assert.match(preview, /1920/);
  assert.match(preview, /buildDraftPreview/);
  assert.doesNotMatch(preview, /INSERT|UPDATE|wrangler/i);
});
test("THREE_CHOICE and PICK_A_CARD expose scenes and timeline", () => {
  for (const field of ["THREE_CHOICE", "PICK_A_CARD", "openingHook", "choice", "resultA", "resultB", "resultC", "closingCta", "DEFAULT_TIMELINE"]) assert.match(preview, new RegExp(field));
  assert.match(page, /Timeline/);
});
test("Preview has platform, Character Config, locale, safe area and metadata boundaries", () => {
  for (const field of ["instagram", "tiktok", "youtube", "getCharacterConfig", "locale", "safeArea", "caption", "hashtags", "bgm"]) assert.match(`${preview}\n${page}`, new RegExp(field));
  assert.match(route, /tenant/);
});
test("Preview detects missing fields and text overflow without deleting copy", () => {
  for (const field of ["HOOK_MISSING", "CTA_MISSING", "DURATION_INVALID", "estimatedLineCount", "NEEDS_EDIT"]) assert.match(preview, new RegExp(field));
  assert.match(page, /Needs Edit/);
});
test("Preview UI only offers review navigation and refresh", () => {
  assert.match(page, /Draftへ戻る/);
  assert.match(page, /Refresh Preview/);
  assert.doesNotMatch(`${route}\n${page}`, /publish|schedule|createExperiment|autonomous|external API write|ffmpeg|render/i);
});
