import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

describe("Growth Engine S-B extension", () => {
  it("defines the Growth Engine schema", () => {
    const sql = readFileSync("drizzle/0004_growth_engine_sb.sql", "utf8");
    for (const table of [
      "growth_engine_settings",
      "growth_data_connectors",
      "growth_metric_points",
      "growth_events",
      "growth_conversion_events",
      "growth_content_insights",
      "growth_internal_link_recommendations",
      "growth_cta_definitions",
      "growth_trends",
      "growth_calendar_items",
      "growth_audience_segments",
      "growth_experiments",
      "growth_cost_usage",
    ]) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }
    assert.match(sql, /attribution_type TEXT NOT NULL DEFAULT 'unknown'/);
    assert.match(sql, /sensitive_attribute_used INTEGER NOT NULL DEFAULT 0/);
    assert.match(sql, /feature_flags_json/);
  });

  it("ships Growth Engine API and admin routes", () => {
    for (const file of [
      "app/lib/growth-engine.ts",
      "app/api/growth-engine/dashboard/route.ts",
      "app/api/growth-engine/metrics/route.ts",
      "app/api/growth-engine/conversion/route.ts",
      "app/api/growth-engine/insights/route.ts",
      "app/admin/growth/page.tsx",
    ]) {
      assert.equal(existsSync(file), true);
    }
  });

  it("guards low-quality or sensitive recommendations", () => {
    const lib = readFileSync("app/lib/growth-engine.ts", "utf8");
    const conversion = readFileSync("app/api/growth-engine/conversion/route.ts", "utf8");
    const insights = readFileSync("app/api/growth-engine/insights/route.ts", "utf8");
    assert.match(lib, /sensitive_attribute_not_allowed/);
    assert.match(lib, /insufficient_sample_size/);
    assert.match(lib, /brand_score_below_threshold/);
    assert.match(conversion, /normalizeAttribution/);
    assert.match(insights, /evaluateInsightGuard/);
  });

  it("documents Growth Engine operations", () => {
    for (const file of [
      "docs/growth-engine/README.md",
      "docs/growth-engine/database.md",
      "docs/growth-engine/operations.md",
    ]) {
      assert.equal(existsSync(file), true);
    }
  });
});
