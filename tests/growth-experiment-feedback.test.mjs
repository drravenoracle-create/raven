import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync("app/lib/growth-experiment-feedback.ts", "utf8");
const api = readFileSync("app/api/growth-engine/experiments/route.ts", "utf8");
const migration = readFileSync("drizzle/0031_growth_experiment_feedback.sql", "utf8");

describe("Phase 4 Stage 5 Rollback / Feedback Boundary", () => {
  it("creates recommendations only for confirmed LOSS or unsafe conditions", () => {
    assert.match(service, /candidate_result/);
    assert.match(service, /Guardrail FAIL/);
    assert.match(service, /automaticExecution: false/);
    assert.match(service, /status !== "CONFIRMED"/);
    assert.match(service, /result === "WIN"/);
  });

  it("stores an approval-only rollback plan and prevents execution", () => {
    assert.match(migration, /growth_experiment_rollback_plans/);
    assert.match(migration, /approval_status/);
    assert.match(service, /execution: "NOT_IMPLEMENTED"/);
    assert.doesNotMatch(service, /fetch\(|createAutonomousAction|external API write/i);
    assert.doesNotMatch(api, /executeRollback|rollbackExecution|autonomousAction/i);
  });

  it("feeds confirmed results into the existing Evidence Source / Claim contract", () => {
    assert.match(service, /sourceType: "experiment_result"/);
    assert.match(service, /createSource\(db, source\)/);
    assert.match(service, /createClaim\(db, claim\)/);
    assert.match(service, /growth_experiment_feedback/);
    assert.match(service, /duplicate: true/);
    assert.match(service, /sampleSize/);
    assert.match(service, /scope must match the Experiment/);
  });

  it("exposes only internal planning and feedback actions", () => {
    assert.match(api, /action === "createRollbackPlan"/);
    assert.match(api, /action === "approveRollbackPlan"/);
    assert.match(api, /action === "rejectRollbackPlan"/);
    assert.match(api, /action === "feedback"/);
    assert.doesNotMatch(api, /action === "executeRollback"/);
  });
});
