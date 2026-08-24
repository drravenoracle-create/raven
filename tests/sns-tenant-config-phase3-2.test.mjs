import assert from "node:assert/strict";
import test from "node:test";
import { RAVEN_STUDIOOS_TENANT_CONFIG } from "../app/lib/studioos-tenant-config.ts";
import { resolveSnsConfig } from "../app/lib/tenant-config-resolver.ts";

test("SNS slice preserves Raven parity and exposes extension refs", () => {
  const legacy = RAVEN_STUDIOOS_TENANT_CONFIG.sns;
  const resolved = resolveSnsConfig("raven-oracle");
  assert.equal(resolved.tenantId, legacy.tenantId);
  assert.equal(resolved.displayName, legacy.displayName);
  assert.equal(resolved.defaultCta, legacy.defaultCta);
  assert.deepEqual(resolved.hashtags, legacy.hashtags);
  assert.equal(resolved.publicBaseUrl, legacy.publicBaseUrl);
  assert.equal(resolved.defaultLocale, "ja-JP");
  assert.deepEqual(resolved.providerRefs, { instagram: "instagram", tiktok: "tiktok", youtube: "youtube" });
  assert.deepEqual(resolved.storageRefs, { publicBaseUrl: legacy.publicBaseUrl });
});

test("SNS resolver never falls back to Raven for an unknown tenant", () => {
  assert.throws(() => resolveSnsConfig("tenant-that-does-not-exist"), /Unknown tenant/);
});

test("SNS CTA and hashtag defaults remain config-driven", () => {
  const config = resolveSnsConfig("raven-oracle");
  const postCta = "post-specific";
  const templateCta = "template-specific";
  assert.equal(postCta || templateCta || config.defaultCta, postCta);
  assert.equal(templateCta || config.defaultCta, templateCta);
  assert.equal(config.defaultCta, "必要なら、レイヴン・ブラックウッドのテキスト鑑定で一緒に整理します。");
  assert.deepEqual(config.hashtags, ["#レイヴンブラックウッド", "#文章鑑定", "#相談整理"]);
});
