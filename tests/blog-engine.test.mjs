import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

describe("Blog Engine v1/v2", () => {
  it("defines the Blog Engine migration tables", () => {
    const sql = readFileSync("drizzle/0003_blog_engine.sql", "utf8");
    for (const table of [
      "blog_engine_settings",
      "blog_engine_articles",
      "blog_engine_generation_steps",
      "blog_engine_events",
      "blog_engine_article_metrics",
      "blog_engine_topic_scores",
      "blog_engine_strategy_memories",
      "blog_engine_improvement_recommendations",
      "blog_engine_refresh_jobs",
      "blog_engine_experiments",
      "blog_engine_cta_metrics",
      "blog_engine_content_versions",
      "blog_engine_social_contents",
      "blog_engine_social_metrics",
      "blog_engine_content_growth_scores",
      "blog_engine_optimization_guard"
    ]) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }
    assert.match(sql, /raven-oracle/);
    assert.match(sql, /kill_switch/);
    assert.match(sql, /brand_score_threshold/);
    assert.match(sql, /draft_time":"13:00"/);
    assert.match(sql, /publish_time":"17:00"/);
    assert.match(sql, /homepage-benefits/);
    assert.match(sql, /attribution_type/);
    assert.match(sql, /total_score/);
  });

  it("ships API routes and admin integration", () => {
    for (const file of [
      "app/api/blog-engine/dashboard/route.ts",
      "app/api/blog-engine/generate/route.ts",
      "app/api/blog-engine/status/route.ts",
      "app/api/blog-engine/metrics/route.ts",
      "app/api/blog-engine/review/route.ts",
      "app/api/blog-engine/sns-sync/route.ts",
      "app/api/blog-engine/events/process/route.ts",
      "app/api/blog-engine/social-metrics/route.ts"
    ]) {
      assert.equal(existsSync(file), true);
    }
    const admin = readFileSync("app/admin/blog/page.tsx", "utf8");
    assert.match(admin, /Raven Oracle Blog Engine v2\.0/);
    assert.match(admin, /\/api\/blog-engine\/generate/);
    assert.match(admin, /\/api\/blog-engine\/review/);
  });

  it("implements Blog x SNS tracking and guard primitives", () => {
    const lib = readFileSync("app/lib/blog-engine.ts", "utf8");
    const processRoute = readFileSync("app/api/blog-engine/events/process/route.ts", "utf8");
    const socialMetricsRoute = readFileSync("app/api/blog-engine/social-metrics/route.ts", "utf8");
    assert.match(lib, /createTrackingId/);
    assert.match(lib, /calculateContentGrowthScore/);
    assert.match(lib, /reel_script/);
    assert.match(processRoute, /article\.published/);
    assert.match(processRoute, /dead_letter/);
    assert.match(processRoute, /tracking_id/);
    assert.match(socialMetricsRoute, /social\.performance\.updated/);
    assert.match(socialMetricsRoute, /attribution_type/);
    assert.match(socialMetricsRoute, /provisional/);
  });

  it("documents operations and database", () => {
    for (const file of [
      "docs/blog-engine/README.md",
      "docs/blog-engine/database.md",
      "docs/blog-engine/operations.md"
    ]) {
      assert.equal(existsSync(file), true);
    }
  });
});
