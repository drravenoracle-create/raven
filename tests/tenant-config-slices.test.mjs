import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tenantConfigPath = new URL("../app/lib/tenant-config.ts", import.meta.url);

async function tenantConfigSource() {
  return readFile(tenantConfigPath, "utf8");
}

test("TenantConfig preserves Raven identity and public URL values", async () => {
  const source = await tenantConfigSource();
  assert.match(source, /id:\s*RAVEN_CHARACTER_CONFIG\.tenantId/);
  assert.match(source, /displayName:\s*"Raven Oracle"/);
  assert.match(source, /primaryCharacterId:\s*RAVEN_CHARACTER_CONFIG\.id/);
  assert.match(source, /const RAVEN_PUBLIC_URL = "https:\/\/raven\.fortunestudios\.jp"/);
  assert.match(source, /publicUrl:\s*RAVEN_PUBLIC_URL/);
  assert.match(source, /analytics:\s*\{ publicUrl: `\$\{RAVEN_PUBLIC_URL\}\/`/);
});

test("TenantConfig exposes the four requested Slice accessors", async () => {
  const source = await tenantConfigSource();
  for (const accessor of ["getTenantConfig", "getBlogConfig", "getGrowthConfig", "getReelConfig", "getAnalyticsConfig"]) {
    assert.match(source, new RegExp(`export function ${accessor}\\(`));
  }
  for (const slice of ["identity", "branding", "content", "blog", "sns", "reel", "analytics", "growth", "storage", "entitlements"]) {
    assert.match(source, new RegExp(`\\b${slice}:`));
  }
});

test("Raven defaults used by the accessors remain sourced from existing config", async () => {
  const source = await tenantConfigSource();
  assert.match(source, /defaultCta:\s*RAVEN_CHARACTER_CONFIG\.defaultCta/);
  assert.match(source, /hashtags:\s*RAVEN_CHARACTER_CONFIG\.sns\.hashtags/);
  assert.match(source, /defaultCta:\s*RAVEN_CHARACTER_CONFIG\.reelCta/);
  assert.match(source, /tenantId:\s*RAVEN_CHARACTER_CONFIG\.tenantId/);
  assert.match(source, /defaultAspectRatio:\s*"9:16"/);
  assert.match(source, /defaultDuration:\s*30/);
});
