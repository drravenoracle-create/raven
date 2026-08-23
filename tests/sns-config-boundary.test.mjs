import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Raven character config is the SNS defaults source of truth", async () => {
  const config = await source("app/lib/character-config.ts");
  assert.match(config, /tenantId:\s*"raven-oracle"/);
  assert.match(config, /displayName:\s*"レイヴン・ブラックウッド"/);
  assert.match(config, /baseUrl:\s*"https:\/\/raven\.fortunestudios\.jp"/);
  assert.match(config, /defaultCta:/);
  assert.match(config, /dailyThreeChoiceHashtags:/);
  assert.match(config, /instagram:\s*\{/);
  assert.match(config, /tiktok:\s*\{/);
  assert.match(config, /youtube:\s*\{/);
});

test("SNS surfaces consume tenant and character config", async () => {
  const files = [
    "worker/index.ts",
    "app/admin/sns/page.tsx",
    "app/admin/sns/templates/page.tsx",
    "app/api/admin/sns/posts/route.ts",
    "app/api/admin/sns/publish/route.ts",
    "app/api/admin/sns/metrics-sync/route.ts",
    "app/api/admin/sns/ping/route.ts",
    "app/api/sns/accounts/route.ts",
    "app/api/sns/platforms/route.ts",
    "app/api/sns/templates/route.ts",
    "app/api/sns/templates/[id]/route.ts",
    "app/api/sns/backgrounds/drive/route.ts",
    "app/api/sns/videos/storage/route.ts",
  ];
  const contents = await Promise.all(files.map(source));
  for (const [index, content] of contents.entries()) {
    assert.match(content, /RAVEN_TENANT_CONFIG|RAVEN_CHARACTER_CONFIG|CHARACTER_CONFIG/,
      `${files[index]} must consume the config boundary`);
  }
});

test("Raven SNS tenant literal is not reintroduced in refactored surfaces", async () => {
  const files = [
    "app/admin/sns/page.tsx",
    "app/admin/sns/templates/page.tsx",
    "app/api/admin/sns/posts/route.ts",
    "app/api/admin/sns/publish/route.ts",
    "app/api/admin/sns/metrics-sync/route.ts",
    "app/api/admin/sns/ping/route.ts",
    "app/api/sns/accounts/route.ts",
    "app/api/sns/platforms/route.ts",
    "app/api/sns/templates/route.ts",
    "app/api/sns/templates/[id]/route.ts",
    "app/api/sns/backgrounds/drive/route.ts",
    "app/api/sns/videos/storage/route.ts",
  ];
  const contents = await Promise.all(files.map(source));
  for (const [index, content] of contents.entries()) {
    assert.doesNotMatch(content, /["'`]raven-oracle["'`]/,
      `${files[index]} contains a direct Raven tenant literal`);
  }
});
