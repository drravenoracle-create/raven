import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyInstagramReconciliation } from "../app/lib/instagram-reconciliation.ts";

test("PUBLISHED without a reliable media ID remains reconciliation_required", () => {
  const result = classifyInstagramReconciliation(200, { status_code: "PUBLISHED", id: "container-1" });
  assert.equal(result.state, "reconciliation_required");
  assert.equal(result.mediaId, null);
});

test("PUBLISHED with explicit media_id can be marked published", () => {
  const result = classifyInstagramReconciliation(200, { status_code: "PUBLISHED", media_id: "media-1" });
  assert.equal(result.state, "published");
  assert.equal(result.mediaId, "media-1");
});

test("FINISHED and IN_PROGRESS do not trigger a second publish", () => {
  assert.equal(classifyInstagramReconciliation(200, { status_code: "FINISHED" }).state, "reconciliation_required");
  assert.equal(classifyInstagramReconciliation(200, { status_code: "IN_PROGRESS" }).state, "reconciliation_required");
});

test("ERROR and EXPIRED are terminal failed states", () => {
  assert.equal(classifyInstagramReconciliation(400, { status_code: "ERROR", error: { code: 1, error_subcode: 2, message: "failed", type: "OAuthException" } }).state, "failed");
  assert.equal(classifyInstagramReconciliation(200, { status_code: "EXPIRED" }).state, "failed");
});

test("reconciliation API and UI expose manual confirmation fields", async () => {
  const api = await readFile(new URL("../app/api/admin/sns/reconciliation/route.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../app/admin/sns/page.tsx", import.meta.url), "utf8");
  assert.match(api, /reconciliation_required/);
  assert.match(api, /media_id/);
  assert.match(ui, /Meta状態を再確認/);
  assert.match(ui, /container ID/);
  assert.match(ui, /reconciliation_reason/);
  assert.match(ui, /post\.status !== "reconciliation_required"/);
});
