import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync("app/lib/growth-experiment-measurement.ts", "utf8");
const api = readFileSync("app/api/growth-engine/experiments/route.ts", "utf8");
const ui = readFileSync("app/admin/growth/experiments/page.tsx", "utf8");
const migration = readFileSync("drizzle/0029_growth_experiment_measurements.sql", "utf8");

describe("Phase 4 Stage 3 KPI / Guardrail Measurement", () => {
  it("extends the existing metrics contract instead of creating a duplicate table", () => {
    assert.match(migration, /ALTER TABLE growth_experiment_metrics ADD COLUMN run_id/);
    assert.match(migration, /ADD COLUMN variant_id/);
    assert.match(migration, /ADD COLUMN availability/);
    assert.doesNotMatch(migration, /CREATE TABLE.*measurement/i);
    assert.match(service, /growth_experiment_metrics/);
  });

  it("preserves baseline, changes, sample size, measuredAt and source", () => {
    for (const token of ["baseline_value", "measured_value", "absolute_change", "relative_change", "sample_size", "measured_at", "source"]) assert.match(service, new RegExp(token));
    assert.match(service, /baseline !== null && measured !== null && baseline !== 0/);
  });

  it("does not turn unavailable data into zero", () => {
    assert.match(service, /available === "AVAILABLE" \? numberOrNull/);
    assert.match(service, /: null/);
    for (const value of ["AVAILABLE", "UNAVAILABLE", "NOT_SUPPORTED", "ERROR"]) assert.match(service, new RegExp(value));
  });

  it("requires the same tenant, Run, Variant and registered metric", () => {
    assert.match(service, /Run not found for this tenant and Experiment/);
    assert.match(service, /Variant not found for this tenant and Experiment/);
    assert.match(service, /metric_key is not registered for this Experiment/);
    assert.match(service, /run_id and variant_id are required/);
  });

  it("stores guardrail results without automatic action", () => {
    for (const value of ["PASS", "WARNING", "FAIL", "UNKNOWN"]) assert.match(service, new RegExp(value));
    assert.match(service, /experiment_run/);
    assert.match(service, /autoStop: false/);
    assert.match(service, /automaticDecision: false/);
    assert.doesNotMatch(service, /createAutonomousAction|fetch\(|rollback|kill.?switch/i);
  });

  it("exposes measurement API and UI without winner controls", () => {
    assert.match(api, /action === "measure"/);
    assert.match(service, /transitionExperiment\(db, current\.experiment_id, "MEASURING"/);
    assert.match(ui, /KPI \/ Guardrail測定/);
    assert.match(ui, /測定値を追加/);
  });
});
