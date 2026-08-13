import test from "node:test";
import assert from "node:assert/strict";
import { MockVideoRendererProvider, assertReelEntitlement, composeScenes, defaultEntitlement, generateReelScript, reelProjectToSnsDraft, selectBackgroundAssets, validateComposition } from "../app/lib/reel-engine.ts";

test("Reel script supports 15, 30, and 60 second presets", () => {
  assert.equal(generateReelScript({ title: "A", duration: 15 }).scenes.length, 3);
  assert.equal(generateReelScript({ title: "A", duration: 30 }).scenes.length, 4);
  assert.equal(generateReelScript({ title: "A", duration: 60 }).scenes.length, 6);
});

test("Background selector prefers matching category and low usage", () => {
  const script = generateReelScript({ title: "A", duration: 30 });
  const selected = selectBackgroundAssets(script, [
    { assetId: "used", tenantId: "t", source: "stock", storageKey: "a", duration: 10, width: 1080, height: 1920, tags: ["calm"], category: "calm", mood: "m", usageCount: 10, performanceScore: 90 },
    { assetId: "fresh", tenantId: "t", source: "stock", storageKey: "b", duration: 10, width: 1080, height: 1920, tags: ["calm"], category: "calm", mood: "m", usageCount: 0, performanceScore: 50 },
  ], 1);
  assert.equal(selected[0].assetId, "fresh");
});

test("Entitlement denies light plan and allows standard", () => {
  assert.equal(assertReelEntitlement(defaultEntitlement("LIGHT")).allowed, false);
  assert.equal(assertReelEntitlement(defaultEntitlement("STANDARD")).allowed, true);
});

test("Composition validates safe scene and text timing", () => {
  const script = generateReelScript({ title: "A", duration: 30 });
  const composition = composeScenes(30, script, ["asset-1"]);
  const result = validateComposition({ duration: 30, scenes: composition.scenes, textLayers: composition.textLayers });
  assert.equal(result.valid, true);
});

test("Mock renderer is safe when provider is unconfigured", async () => {
  const script = generateReelScript({ title: "A", duration: 30 });
  const composition = composeScenes(30, script, ["asset-1"]);
  const provider = new MockVideoRendererProvider();
  const job = await provider.createRenderJob({ tenantId: "t", reelId: "r", title: "A", objective: "O", platform: "instagram", aspectRatio: "9:16", duration: 30, status: "planned", script, scenes: composition.scenes, backgroundAssetIds: ["asset-1"], textLayers: composition.textLayers, brandPresetId: "brand", rendererProvider: "unconfigured" });
  assert.equal(job.status, "unavailable");
});

test("Reel can be converted to existing SNS draft payload", () => {
  const script = generateReelScript({ title: "A", duration: 30 });
  const composition = composeScenes(30, script, ["asset-1"]);
  const sns = reelProjectToSnsDraft({ tenantId: "t", reelId: "r", title: "A", objective: "O", platform: "instagram", aspectRatio: "9:16", duration: 30, status: "approved", script, scenes: composition.scenes, backgroundAssetIds: ["asset-1"], textLayers: composition.textLayers, brandPresetId: "Raven Blackwood", rendererProvider: "unconfigured" });
  assert.equal(sns.postType, "reel");
  assert.match(sns.caption, /Raven|続き|迷った/);
});
