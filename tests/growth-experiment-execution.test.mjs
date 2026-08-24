import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync("app/lib/growth-experiment-execution.ts", "utf8");
const manager = readFileSync("app/lib/growth-experiment-manager.ts", "utf8");
const api = readFileSync("app/api/growth-engine/experiments/route.ts", "utf8");
const migration = readFileSync("drizzle/0028_growth_experiment_execution.sql", "utf8");

describe("Phase 4 Stage 2 Experiment Execution Core", () => {
  it("defines Control / Variant and server-side allocation validation", () => {
    assert.match(migration, /kind TEXT NOT NULL CHECK \(kind IN \('CONTROL', 'VARIANT'\)\)/);
    assert.match(service, /Exactly one CONTROL variant is required/);
    assert.match(service, /At least one VARIANT is required/);
    assert.match(service, /Allocation weight must total 100/);
  });

  it("keeps scope and tenant boundaries server-side", () => {
    assert.match(service, /Variant scope must match the Experiment scope/);
    assert.match(service, /tenant_id = \?/);
    assert.match(migration, /UNIQUE \(tenant_id, experiment_id, subject_type, subject_id\)/);
  });

  it("creates a Run before the RUNNING transition and requires the Run", () => {
    assert.match(service, /INSERT INTO growth_experiment_runs/);
    assert.match(service, /executionRunId: runId/);
    assert.match(manager, /An Execution Run is required before RUNNING transition/);
    assert.match(manager, /status !== "STARTING"/);
    assert.match(manager, /db\.batch\(\[/);
  });

  it("records deterministic assignments without external execution", () => {
    assert.match(service, /bucket\(`\$\{experiment\.experiment_id\}:\$\{subjectType\}:\$\{subjectId\}`\)/);
    assert.match(service, /INSERT INTO growth_experiment_assignments/);
    assert.doesNotMatch(service, /fetch\(|createAutonomousAction|external API|sns/);
  });

  it("exposes only the Stage 2 management actions", () => {
    for (const action of ["createVariant", "updateVariant", "run", "stop", "assign"]) assert.match(api, new RegExp(`action === "${action}"`));
    assert.match(service, /experiment\.run\.stopped/);
    assert.match(service, /growth_audit_log/);
  });
});
