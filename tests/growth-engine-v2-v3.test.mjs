import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

describe("Growth Engine v2/v3", () => {
  it("defines v2 and v3 migration tables", () => {
    const sql = readFileSync("drizzle/0005_growth_engine_v2_v3.sql", "utf8");
    for (const table of [
      "growth_customer_profiles",
      "growth_retention_recommendations",
      "growth_revenue_records",
      "growth_next_best_actions",
      "growth_executive_reports",
      "growth_business_goals",
      "growth_strategies",
      "growth_autonomous_actions",
      "growth_guardrail_results",
      "growth_kill_switches",
      "growth_knowledge_items",
      "growth_agent_tasks",
      "growth_audit_log",
    ]) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }
    assert.match(sql, /revenue_kind TEXT NOT NULL DEFAULT 'measured'/);
    assert.match(sql, /journey_stage TEXT NOT NULL DEFAULT 'visitor'/);
    assert.match(sql, /autonomous_marketing_os/);
  });

  it("updates the Growth Engine version and guard logic", () => {
    const lib = readFileSync("app/lib/growth-engine.ts", "utf8");
    assert.match(lib, /growth-engine-v3\.0/);
    assert.match(lib, /deriveJourneyStage/);
    assert.match(lib, /evaluateAutonomousAction/);
    assert.match(lib, /emergency_stop_enabled/);
    assert.match(lib, /high_risk_requires_human_approval/);
  });

  it("ships v2/v3 API routes and dashboard integration", () => {
    for (const file of [
      "app/api/growth-engine/journey/route.ts",
      "app/api/growth-engine/revenue/route.ts",
      "app/api/growth-engine/actions/route.ts",
      "app/api/growth-engine/executive/route.ts",
      "app/admin/growth/page.tsx",
    ]) {
      assert.equal(existsSync(file), true);
    }
    const page = readFileSync("app/admin/growth/page.tsx", "utf8");
    assert.match(page, /Raven Oracle Growth Engine v3\.0/);
    assert.match(page, /Executive Brief/);
    assert.match(page, /Approval Center/);
  });
});
