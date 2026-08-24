import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { evaluateResultCandidate } = await import("../app/lib/growth-experiment-result-policy.ts");
const service = readFileSync("app/lib/growth-experiment-result.ts", "utf8");
const api = readFileSync("app/api/growth-engine/experiments/route.ts", "utf8");
const migration = readFileSync("drizzle/0030_growth_experiment_result_evaluations.sql", "utf8");

const variants = [{ variant_id: "control", name: "Control", kind: "CONTROL" }, { variant_id: "variant-a", name: "Variant A", kind: "VARIANT" }];
function measurements(control = 100, variant = 110, sampleSize = 50, availability = "AVAILABLE") {
  return [
    { id: "m-control", run_id: "run-1", variant_id: "control", metric_name: "CTR", metric_role: "primary", baseline_value: 100, measured_value: control, sample_size: sampleSize, availability, measured_at: "2026-08-25T01:00:00Z" },
    { id: "m-variant", run_id: "run-1", variant_id: "variant-a", metric_name: "CTR", metric_role: "primary", baseline_value: 100, measured_value: variant, sample_size: sampleSize, availability, measured_at: "2026-08-25T01:01:00Z" },
  ];
}
function evaluate(input = {}) { return evaluateResultCandidate({ experimentId: "exp-1", runId: "run-1", primaryMetric: "CTR", direction: "increase", variants, measurements: measurements(), guardrails: [{ id: "g-1", result: "PASS", checked_at: "2026-08-25T01:02:00Z" }], configuredGuardrails: ["Error Rate"], minimumSampleSize: 30, minimumRelativeLift: 0.05, ...input }); }

describe("Phase 4 Stage 4 Result Decision", () => {
  it("returns WIN / LOSS / NEUTRAL candidates from practical thresholds", () => {
    assert.equal(evaluate().candidateResult, "WIN");
    assert.equal(evaluate({ measurements: measurements(110, 90) }).candidateResult, "LOSS");
    assert.equal(evaluate({ measurements: measurements(100, 102) }).candidateResult, "NEUTRAL");
  });

  it("prefers INCONCLUSIVE for insufficient, unavailable and unknown data", () => {
    assert.equal(evaluate({ measurements: measurements(100, 110, 5) }).candidateResult, "INCONCLUSIVE");
    assert.equal(evaluate({ measurements: measurements(100, 110, 50, "UNAVAILABLE") }).candidateResult, "INCONCLUSIVE");
    assert.equal(evaluate({ guardrails: [{ id: "g-1", result: "UNKNOWN", checked_at: "2026-08-25T01:02:00Z" }] }).candidateResult, "INCONCLUSIVE");
    assert.equal(evaluate({ measurements: measurements(100, null) }).candidateResult, "INCONCLUSIVE");
  });

  it("recommends stopping for Guardrail FAIL without executing a stop", () => {
    const result = evaluate({ guardrails: [{ id: "g-1", result: "FAIL", checked_at: "2026-08-25T01:02:00Z" }] });
    assert.equal(result.candidateResult, "LOSS");
    assert.equal(result.stopRecommendation, "STOP_RECOMMENDED");
    assert.match(service, /autoStop: false/);
    assert.doesNotMatch(service, /transitionExperiment|createAutonomousAction|fetch\(|rollback/i);
  });

  it("stores candidate state separately and exposes human confirmation actions", () => {
    assert.match(migration, /candidate_result TEXT NOT NULL CHECK/);
    assert.match(migration, /status TEXT NOT NULL DEFAULT 'CANDIDATE'/);
    assert.match(service, /Result Candidate is stale/);
    assert.match(service, /confirmed_by/);
    assert.match(api, /action === "evaluateResult"/);
    assert.match(api, /action === "confirmResult"/);
    assert.match(api, /action === "rejectResult"/);
    assert.match(api, /action === "recordResult"\) throw new Error\("Use evaluateResult and confirmResult/);
  });
});
