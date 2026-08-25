import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const renderer = fs.readFileSync(new URL("../app/lib/sns-draft-renderer.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../drizzle/0035_sns_draft_render_jobs.sql", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/sns/drafts/[id]/render/route.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/admin/sns/drafts/[id]/page.tsx", import.meta.url), "utf8");

test("Draft render creates a scoped Job and MP4 Artifact metadata", () => {
  for (const field of ["renderDraftToMp4", "draft_version", "renderer_provider", "artifact_id", "file_reference", "video_codec", "audio_codec", "checksum"]) assert.match(`${renderer}\n${migration}`, new RegExp(field));
  assert.match(renderer, /1080/);
  assert.match(renderer, /1920/);
});
test("Renderer reuses Preview Contract and supports all platforms", () => {
  assert.match(renderer, /buildDraftPreview/);
  for (const platform of ["instagram", "tiktok", "youtube"]) assert.match(renderer, new RegExp(platform));
  assert.match(renderer, /previewContract/);
});
test("Idempotency and explicit re-render are separate", () => {
  assert.match(renderer, /render_revision/);
  assert.match(renderer, /input\.rerender/);
  assert.match(route, /rerender/);
});
test("Failure and safety boundaries are explicit", () => {
  assert.match(renderer, /VALIDATION_FAILED/);
  assert.match(renderer, /RENDERER_UNAVAILABLE/);
  assert.match(renderer, /mock/);
  assert.doesNotMatch(`${renderer}\n${route}\n${page}`, /instagram.*publish|tiktok.*publish|youtube.*publish|schedule|autonomous|external API write|ffmpeg/i);
});
test("UI exposes render review metadata without publish controls", () => {
  for (const field of ["MP4を生成", "Render Artifact", "Renderer", "artifact", "v{draft.version}"]) assert.match(page, new RegExp(field));
  assert.doesNotMatch(page, /Publish|Schedule|Auto Publish|公開する/);
});
