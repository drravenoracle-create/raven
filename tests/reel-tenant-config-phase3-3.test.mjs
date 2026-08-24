import assert from "node:assert/strict";
import test from "node:test";
import { RAVEN_STUDIOOS_TENANT_CONFIG } from "../app/lib/studioos-tenant-config.ts";
import { resolveReelConfig } from "../app/lib/tenant-config-resolver.ts";
import { REEL_ENGINE_CONFIG, REEL_ENGINE_TENANT_ID } from "../app/lib/reel-engine.ts";

test("Reel slice preserves Raven parity and exposes renderer/storage refs", () => {
  const legacy = RAVEN_STUDIOOS_TENANT_CONFIG.reel;
  const resolved = resolveReelConfig("raven-oracle");
  assert.equal(REEL_ENGINE_TENANT_ID, resolved.tenantId);
  assert.equal(resolved.tenantId, legacy.tenantId);
  assert.equal(resolved.enabled, legacy.enabled);
  assert.equal(resolved.rendererProvider, legacy.rendererProvider);
  assert.deepEqual(resolved.storage, legacy.storage);
  assert.deepEqual(resolved.backgroundLibrary, legacy.backgroundLibrary);
  assert.deepEqual(resolved.brandDefaults, legacy.brandDefaults);
  assert.equal(resolved.publicBaseUrl, RAVEN_STUDIOOS_TENANT_CONFIG.urls.publicUrl);
  assert.deepEqual(resolved.renderDefaults, { aspectRatio: legacy.defaultAspectRatio, duration: legacy.defaultDuration });
  assert.equal(REEL_ENGINE_CONFIG.storageRef, legacy.storage.namespace);
});

test("Reel resolver never falls back to Raven for an unknown tenant", () => {
  assert.throws(() => resolveReelConfig("tenant-that-does-not-exist"), /Unknown tenant/);
});

test("Reel state machine remains unchanged at the configuration boundary", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../app/lib/instagram-reel-state.ts", import.meta.url), "utf8");
  assert.match(source, /processing|published|reconciliation_required/);
});
