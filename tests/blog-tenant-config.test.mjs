import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildBlogDraft, createBlogEvent, createSocialDerivatives } from "../app/lib/blog-engine.ts";
import { resolveBlogConfig } from "../app/lib/tenant-config-resolver.ts";
import { buildDailyAlmanac } from "../app/lib/calendar/daily-almanac.ts";

test("Raven BlogConfigSlice preserves legacy values", () => {
  const config = resolveBlogConfig();
  assert.equal(config.tenantId, "raven-oracle");
  assert.equal(config.defaultAuthor, "レイヴン・ブラックウッド");
  assert.equal(config.defaultCta, "必要なら、レイヴン・ブラックウッドのテキスト鑑定で一緒に整理します。");
  assert.deepEqual(config.defaultTags, ["#レイヴンブラックウッド", "#文章鑑定", "#相談整理"]);
  assert.equal(config.publicBaseUrl, "https://raven.fortunestudios.jp");
  assert.equal(config.enabled, true);
});

test("Blog Engine resolves through the tenant slice and preserves output", () => {
  const draft = buildBlogDraft({ tenantId: "raven-oracle", topic: "resolver parity", category: "占術解説" });
  assert.equal(draft.category, "占術解説");
  assert.match(draft.seoTitle, /レイヴン・ブラックウッド/);
  assert.equal(createBlogEvent({ tenantId: "raven-oracle", eventType: "article.created" }).tenant_id, "raven-oracle");
  assert.match(createSocialDerivatives("article-1", draft, "raven-oracle")[0].content, /レイヴン/);
});

test("Unknown Blog tenant never falls back to Raven", () => {
  assert.throws(() => resolveBlogConfig("unknown-tenant"), /Unknown tenant/);
  assert.throws(() => buildBlogDraft({ tenantId: "unknown-tenant" }), /Unknown tenant/);
  assert.throws(() => createBlogEvent({ tenantId: "unknown-tenant", eventType: "article.created" }), /Unknown tenant/);
  assert.throws(() => buildDailyAlmanac("2026-08-21", "unknown-tenant"), /Unknown tenant/);
});

test("Blog public and scheduler paths use the resolver boundary", async () => {
  const page = await readFile(new URL("../app/blog/page.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../app/blog/[slug]/page.tsx", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(page, /resolveBlogConfig/);
  assert.match(page, /WHERE a\.tenant_id = \?/);
  assert.match(detail, /resolveBlogConfig/);
  assert.match(detail, /WHERE a\.tenant_id = \?/);
  assert.match(worker, /const BLOG_CONFIG = resolveBlogConfig\(TENANT_ID\)/);
  assert.match(worker, /buildDailyAlmanac\(date, BLOG_TENANT_ID\)/);
});
