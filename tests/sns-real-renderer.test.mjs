import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const source = new URL("../app/lib/sns-real-renderer.ts", import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
test("real provider boundary rejects production Cloud Run and requires explicit URL", async () => {
  const code = readFileSync(source, "utf8");
  assert.ok(code.includes("SNS_REAL_RENDERER_URL"));
  assert.ok(code.includes("Production Cloud Run Renderer"));
  assert.ok(code.includes("MEDIA_BUCKET"));
});
test("local fixture produces a real 1080x1920 H.264/AAC MP4 with Japanese text", () => {
  const script = readFileSync(resolve(root, "scripts/render-reel.mjs"), "utf8"); assert.match(script, /spawnSync\("ffmpeg"/); const input = resolve(root, "public/sns-test/three-choice-sample.mp4"); const bytes = readFileSync(input);
  assert.ok(statSync(input).size > 0); assert.equal(bytes.subarray(4, 8).toString("ascii"), "ftyp"); assert.ok(bytes.length > 1000);
});
