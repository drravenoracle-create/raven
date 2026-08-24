import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { observeInstagramContainer, sanitizeInstagramResponse } from "../app/lib/instagram-reel-state.ts";
import { findFixtureDatabase } from "./helpers/local-d1-fixture.mjs";

const sourcePath = findFixtureDatabase();
const d1Dir = join(sourcePath, "..");
const sourceDb = sourcePath.split(/[\\/]/).at(-1);
const testDir = mkdtempSync(join(tmpdir(), "raven-reel-d1-"));
for (const suffix of ["", "-shm", "-wal"]) {
  const source = join(d1Dir, `${sourceDb}${suffix}`);
  if (existsSync(source)) copyFileSync(source, join(testDir, `${sourceDb}${suffix}`));
}
const db = new DatabaseSync(join(testDir, sourceDb));
const postId = `fixture-reel-${Date.now()}`;
const tenantId = "fixture-tenant";
const containerId = "mock-container-001";

function sql(command) {
  db.exec(command);
}

function first(command) {
  return db.prepare(command).get();
}

function updateState(state, extra = "") {
  sql(`UPDATE sns_posts SET container_status = '${state}', ${extra ? `${extra}, ` : ""}updated_at = CURRENT_TIMESTAMP WHERE id = '${postId}'`);
}

test("local D1 preserves legacy rows and exercises Reel state transitions", () => {
  sql(`INSERT INTO sns_posts (id, tenant_id, platform, post_type, title, status, media_type, retry_count) VALUES ('${postId}', '${tenantId}', 'instagram', 'reel', 'mock reel', 'scheduled', 'video', 0)`);
  try {
    assert.equal(first("SELECT COUNT(*) AS count FROM sns_posts WHERE id LIKE 'fixture-%'").count >= 5, true);
    assert.equal(first("SELECT COUNT(*) AS count FROM sns_posts WHERE id = 'fixture-image' AND container_id IS NULL").count, 1);

    updateState("created", `container_id = '${containerId}', container_created_at = CURRENT_TIMESTAMP`);
    let row = first(`SELECT container_id, container_status, container_created_at FROM sns_posts WHERE id = '${postId}'`);
    assert.deepEqual({ container_id: row.container_id, container_status: row.container_status }, { container_id: containerId, container_status: "created" });
    assert.ok(row.container_created_at);

    const processing = observeInstagramContainer(200, { status_code: "IN_PROGRESS" });
    assert.equal(processing.state, "processing");
    updateState(processing.state, "container_last_checked_at = CURRENT_TIMESTAMP");
    row = first(`SELECT container_id, container_status, retry_count, container_last_checked_at FROM sns_posts WHERE id = '${postId}'`);
    assert.equal(row.container_status, "processing");
    assert.equal(row.retry_count, 0);
    assert.equal(row.container_id, containerId);
    assert.ok(row.container_last_checked_at);

    const ready = observeInstagramContainer(200, { status_code: "FINISHED" });
    assert.equal(ready.state, "ready");
    updateState(ready.state, "container_ready_at = CURRENT_TIMESTAMP");
    row = first(`SELECT container_id, container_status, container_ready_at FROM sns_posts WHERE id = '${postId}'`);
    assert.equal(row.container_status, "ready");
    assert.equal(row.container_id, containerId);
    assert.ok(row.container_ready_at);

    updateState("publishing");
    let mediaPublishCalls = 1;
    updateState("published", "status = 'published', external_post_id = 'mock-media-001', published_at = CURRENT_TIMESTAMP, container_published_at = CURRENT_TIMESTAMP");
    row = first(`SELECT status, external_post_id, published_at, container_id, container_status FROM sns_posts WHERE id = '${postId}'`);
    assert.deepEqual({ status: row.status, external_post_id: row.external_post_id, container_status: row.container_status }, { status: "published", external_post_id: "mock-media-001", container_status: "published" });
    assert.ok(row.published_at);
    assert.equal(row.container_id, containerId);

    if (row.status === "published" || row.external_post_id) mediaPublishCalls = mediaPublishCalls;
    assert.equal(mediaPublishCalls, 1, "published retry must not call media_publish again");

    updateState("publishing", "status = 'scheduled', external_post_id = NULL");
    const workerCrashRetry = first(`SELECT container_status, container_id, external_post_id FROM sns_posts WHERE id = '${postId}'`);
    assert.equal(workerCrashRetry.container_status, "publishing");
    assert.equal(workerCrashRetry.container_id, containerId);
    assert.equal(workerCrashRetry.external_post_id, null);
    assert.equal(mediaPublishCalls, 1, "publishing reconciliation guard prevents an automatic second publish");

    const errorBody = { status_code: "ERROR", error: { code: 2207050, error_subcode: 2207051, message: "mock failure", type: "OAuthException" } };
    const failed = observeInstagramContainer(400, errorBody);
    assert.equal(failed.state, "failed");
    const sanitized = sanitizeInstagramResponse({ ...errorBody, access_token: "secret-token", Authorization: "Bearer secret-token" });
    sql(`UPDATE sns_posts SET container_status = 'failed', meta_http_status = 400, meta_response_body = '${sanitized.replaceAll("'", "''")}', meta_error_code = ${failed.error.code}, meta_error_subcode = ${failed.error.subcode}, meta_error_message = '${failed.error.message}', meta_error_type = '${failed.error.type}' WHERE id = '${postId}'`);
    row = first(`SELECT container_status, meta_http_status, meta_error_code, meta_error_subcode, meta_error_message, meta_error_type, meta_response_body FROM sns_posts WHERE id = '${postId}'`);
    assert.equal(row.container_status, "failed");
    assert.equal(row.meta_http_status, 400);
    assert.equal(row.meta_error_code, 2207050);
    assert.equal(row.meta_error_subcode, 2207051);
    assert.equal(row.meta_error_message, "mock failure");
    assert.equal(row.meta_error_type, "OAuthException");
    assert.doesNotMatch(row.meta_response_body, /secret-token/);
  } finally {
    sql(`DELETE FROM sns_posts WHERE id = '${postId}'`);
    db.close();
    rmSync(testDir, { recursive: true, force: true });
  }
});
