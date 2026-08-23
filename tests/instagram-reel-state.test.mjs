import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  INSTAGRAM_REEL_STATES,
  observeInstagramContainer,
  sanitizeInstagramResponse,
} from "../app/lib/instagram-reel-state.ts";

test("Instagram Reel state machine has the required states", () => {
  assert.deepEqual(INSTAGRAM_REEL_STATES, ["created", "processing", "ready", "publishing", "published", "failed"]);
});

test("IN_PROGRESS is processing and never failed", () => {
  const result = observeInstagramContainer(200, { status_code: "IN_PROGRESS" });
  assert.equal(result.state, "processing");
});

test("FINISHED is ready", () => {
  const result = observeInstagramContainer(200, { status_code: "FINISHED" });
  assert.equal(result.state, "ready");
});

test("Meta ERROR captures code, subcode, message and type", () => {
  const result = observeInstagramContainer(400, { status_code: "ERROR", error: { code: 2207050, error_subcode: 2207051, message: "processing failed", type: "OAuthException" } });
  assert.equal(result.state, "failed");
  assert.deepEqual(result.error, { code: 2207050, subcode: 2207051, message: "processing failed", type: "OAuthException" });
});

test("Meta response sanitization removes secrets", () => {
  const value = JSON.parse(sanitizeInstagramResponse({ access_token: "secret", nested: { authorization: "Bearer secret", status_code: "FINISHED" } }));
  assert.equal(value.access_token, "[REDACTED]");
  assert.equal(value.nested.authorization, "[REDACTED]");
  assert.equal(value.nested.status_code, "FINISHED");
});

test("Worker and admin API use existing container before creating another one", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/api/admin/sns/publish/route.ts", import.meta.url), "utf8");
  assert.match(worker, /existingContainerId/);
  assert.match(worker, /checkInstagramContainer\(env, post\)/);
  assert.match(admin, /fullPost\.container_id/);
  assert.match(worker, /container_status.*publishing/);
  assert.match(admin, /requiresReconciliation/);
  assert.doesNotMatch(worker, /waitForInstagramContainer/);
  assert.doesNotMatch(admin, /waitForInstagramContainer/);
});
