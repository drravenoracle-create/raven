import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { evaluatePreflightPolicy } = await import("../app/lib/growth-experiment-preflight-policy.ts");
const base = { status: "APPROVED", approvalRequired: false, approved: true, evidenceDecision: "GO", evidenceSufficiency: "STRONG", scopeMatch: true, characterMatch: true, killSwitchEnabled: false, guardrailEvaluated: true, guardrailPassed: true, reversible: true, rollbackPlan: true, requireStartState: true };

describe("Phase 4 Stage 1 Experiment Preflight", () => {
  it("allows an approved, evidenced, scoped experiment with passing guardrails", () => {
    assert.deepEqual(evaluatePreflightPolicy(base), { allowed: true, decision: "START_ALLOWED", blockers: [], warnings: [] });
  });
  it("blocks approval, evidence, guardrail, kill switch and rollback failures", () => {
    assert.equal(evaluatePreflightPolicy({ ...base, approvalRequired: true, approved: false }).decision, "REQUIRE_APPROVAL");
    assert.equal(evaluatePreflightPolicy({ ...base, evidenceDecision: "INSUFFICIENT_EVIDENCE", evidenceSufficiency: "INSUFFICIENT" }).allowed, false);
    assert.equal(evaluatePreflightPolicy({ ...base, guardrailPassed: false }).decision, "GUARDRAIL_FAILED");
    assert.equal(evaluatePreflightPolicy({ ...base, guardrailEvaluated: false }).decision, "GUARDRAIL_FAILED");
    assert.equal(evaluatePreflightPolicy({ ...base, killSwitchEnabled: true }).allowed, false);
    assert.equal(evaluatePreflightPolicy({ ...base, reversible: false, rollbackPlan: false }).allowed, false);
  });
  it("blocks every scope boundary and invalid lifecycle state", () => {
    for (const key of ["scopeMatch", "characterMatch"]) assert.equal(evaluatePreflightPolicy({ ...base, [key]: false }).allowed, false);
    for (const status of ["DRAFT", "PROPOSED", "REJECTED", "RUNNING", "COMPLETED"]) assert.equal(evaluatePreflightPolicy({ ...base, status }).allowed, false);
  });
  it("keeps the server start boundary and existing guardrail tables", () => {
    const manager = readFileSync("app/lib/growth-experiment-manager.ts", "utf8");
    const api = readFileSync("app/api/growth-engine/experiments/route.ts", "utf8");
    const service = readFileSync("app/lib/growth-experiment-preflight.ts", "utf8");
    assert.match(manager, /toStatus === "RUNNING"/);
    assert.match(manager, /runExperimentPreflight/);
    assert.match(api, /action === "preflight"/);
    assert.match(service, /growth_guardrail_results/);
    assert.doesNotMatch(service, /transitionExperiment|createAutonomousAction|fetch\(/);
  });
});
