import { getExperiment } from "./growth-experiment-manager.ts";
import { GROWTH_ENGINE_TENANT_ID } from "./growth-engine.ts";
import { evaluateResultCandidate } from "./growth-experiment-result-policy.ts";

type D1 = {
  batch?(statements: unknown[]): Promise<unknown[]>;
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
    };
  };
};
type Experiment = Record<string, unknown> & { experiment_id: string; tenant_id: string; status: string; primary_kpi?: string; primary_metric?: string; primary_kpi_direction?: string; guardrail_kpis_json?: string; source_json?: string };
type Run = { run_id: string; experiment_id: string; tenant_id: string; status: string };
type Variant = { variant_id: string; name: string; kind: string; allocation_weight?: number };
type Measurement = { id: string; run_id: string; variant_id: string; metric_name: string; metric_role?: string; direction?: string; baseline_value?: number | null; measured_value?: number | null; absolute_change?: number | null; relative_change?: number | null; sample_size?: number; availability?: string; measured_at?: string };
type Guardrail = { id: string; result: string; reasons_json?: string; checked_at?: string };

function clean(value: unknown, maxLength = 240) { return String(value ?? "").trim().slice(0, maxLength); }
function json(value: unknown) { try { return JSON.stringify(value ?? {}); } catch { return "{}"; } }
function parseArray(value: unknown) { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function policy(experiment: Experiment) {
  try { const source = JSON.parse(String(experiment.source_json || "{}")); const configured = source.resultPolicy || source.result_policy || {}; return { minimumSampleSize: Math.max(1, Number(configured.minimumSampleSize ?? configured.minSampleSize ?? 30)), minimumRelativeLift: Math.max(0, Number(configured.minimumRelativeLift ?? configured.minRelativeLift ?? 0.05)), minimumAbsoluteLift: Math.max(0, Number(configured.minimumAbsoluteLift ?? configured.minAbsoluteLift ?? 0)) }; } catch { return { minimumSampleSize: 30, minimumRelativeLift: 0.05, minimumAbsoluteLift: 0 }; }
}
async function currentExperiment(db: D1, idOrCode: string, tenantId: string) { return getExperiment(db, idOrCode, tenantId) as Promise<Experiment | null>; }
async function snapshot(db: D1, experiment: Experiment, runId: string, tenantId: string) {
  const run = await db.prepare("SELECT run_id, experiment_id, tenant_id, status FROM growth_experiment_runs WHERE tenant_id = ? AND experiment_id = ? AND run_id = ? LIMIT 1").bind(tenantId, experiment.experiment_id, runId).first<Run>();
  if (!run) throw new Error("Run not found for this tenant and Experiment.");
  const variants = (await db.prepare("SELECT variant_id, name, kind, allocation_weight FROM growth_experiment_variants WHERE tenant_id = ? AND experiment_id = ? ORDER BY kind, created_at").bind(tenantId, experiment.experiment_id).all<Variant>()).results || [];
  const measurements = (await db.prepare("SELECT * FROM growth_experiment_metrics WHERE tenant_id = ? AND experiment_id = ? AND run_id = ? ORDER BY datetime(COALESCE(measured_at, created_at)) DESC").bind(tenantId, experiment.experiment_id, runId).all<Measurement>()).results || [];
  const guardrails = (await db.prepare("SELECT * FROM growth_guardrail_results WHERE tenant_id = ? AND subject_type = 'experiment_run' AND subject_id = ? ORDER BY datetime(checked_at) DESC").bind(tenantId, runId).all<Guardrail>()).results || [];
  return { run, variants, measurements, guardrails };
}
function configuredGuardrails(experiment: Experiment) { return parseArray(experiment.guardrail_kpis_json).map(String).filter(Boolean); }
async function audit(db: D1, tenantId: string, experimentId: string, actor: string, action: string, after: unknown) {
  const payload = json(after);
  await db.prepare("INSERT INTO growth_audit_log (id, tenant_id, actor, action, subject_type, subject_id, before_json, after_json) VALUES (?, ?, ?, ?, 'experiment', ?, '{}', ?)").bind(crypto.randomUUID(), tenantId, actor || "admin", action, experimentId, payload).run();
  await db.prepare("INSERT INTO growth_experiment_events (id, tenant_id, experiment_id, event_type, actor, reason, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), tenantId, experimentId, action, actor || "admin", "Result evaluation", payload).run();
}

export async function evaluateExperimentResult(db: D1, idOrCode: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const experiment = await currentExperiment(db, idOrCode, tenantId); if (!experiment) throw new Error("Experiment not found.");
  if (!["RUNNING", "MEASURING", "PAUSED"].includes(experiment.status)) throw new Error("Result evaluation requires a RUNNING, MEASURING, or PAUSED Experiment.");
  const runId = clean(input.run_id ?? input.runId, 120) || String((await db.prepare("SELECT run_id FROM growth_experiment_runs WHERE tenant_id = ? AND experiment_id = ? ORDER BY datetime(created_at) DESC LIMIT 1").bind(tenantId, experiment.experiment_id).first<{ run_id: string }>())?.run_id || "");
  if (!runId) throw new Error("A Run is required for result evaluation.");
  const view = await snapshot(db, experiment, runId, tenantId); const config = policy(experiment); const candidate = evaluateResultCandidate({ experimentId: experiment.experiment_id, runId, primaryMetric: clean(experiment.primary_kpi ?? experiment.primary_metric, 120), direction: experiment.primary_kpi_direction, variants: view.variants, measurements: view.measurements, guardrails: view.guardrails, configuredGuardrails: configuredGuardrails(experiment), ...config }); const autoStop = false; // autoStop: false
  await db.prepare("UPDATE growth_experiment_result_evaluations SET status = 'STALE', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND experiment_id = ? AND run_id = ? AND status = 'CANDIDATE'").bind(tenantId, experiment.experiment_id, runId).run();
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO growth_experiment_result_evaluations (evaluation_id, experiment_id, run_id, tenant_id, candidate_result, stop_recommendation, primary_metric, control_value, variant_value, absolute_difference, relative_difference, sample_size, confidence, guardrail_status, reasons_json, blockers_json, source_measurements_json, measurement_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, experiment.experiment_id, runId, tenantId, candidate.candidateResult, candidate.stopRecommendation, candidate.primaryMetric, candidate.controlValue, candidate.variantValue, candidate.absoluteDifference, candidate.relativeDifference, candidate.sampleSize, candidate.confidence, candidate.guardrailStatus, JSON.stringify(candidate.reasons), JSON.stringify(candidate.blockers), JSON.stringify(candidate.sourceMeasurementIds), candidate.measurementFingerprint).run();
  await audit(db, tenantId, experiment.experiment_id, clean(input.actor, 120) || "admin", "experiment.result.evaluated", { evaluationId: id, ...candidate, autoStop });
  return db.prepare("SELECT * FROM growth_experiment_result_evaluations WHERE tenant_id = ? AND evaluation_id = ?").bind(tenantId, id).first();
}

export async function getResultEvaluation(db: D1, evaluationId: string, tenantId = GROWTH_ENGINE_TENANT_ID) { return db.prepare("SELECT * FROM growth_experiment_result_evaluations WHERE tenant_id = ? AND evaluation_id = ? LIMIT 1").bind(tenantId, evaluationId).first<Record<string, unknown>>(); }

export async function listResultEvaluations(db: D1, idOrCode: string, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const experiment = await currentExperiment(db, idOrCode, tenantId); if (!experiment) throw new Error("Experiment not found.");
  const rows = await db.prepare("SELECT * FROM growth_experiment_result_evaluations WHERE tenant_id = ? AND experiment_id = ? ORDER BY datetime(evaluated_at) DESC").bind(tenantId, experiment.experiment_id).all();
  return rows.results || [];
}

export async function confirmExperimentResult(db: D1, evaluationId: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const evaluation = await getResultEvaluation(db, evaluationId, tenantId); if (!evaluation) throw new Error("Result Candidate not found.");
  if (evaluation.status !== "CANDIDATE") throw new Error("Only a current Result Candidate can be confirmed.");
  const experiment = await currentExperiment(db, String(evaluation.experiment_id), tenantId); if (!experiment || !["RUNNING", "MEASURING", "PAUSED"].includes(experiment.status)) throw new Error("Experiment state does not allow confirmation.");
  const view = await snapshot(db, experiment, String(evaluation.run_id), tenantId); const config = policy(experiment); const latest = evaluateResultCandidate({ experimentId: experiment.experiment_id, runId: String(evaluation.run_id), primaryMetric: clean(experiment.primary_kpi ?? experiment.primary_metric, 120), direction: experiment.primary_kpi_direction, variants: view.variants, measurements: view.measurements, guardrails: view.guardrails, configuredGuardrails: configuredGuardrails(experiment), ...config });
  if (latest.measurementFingerprint !== evaluation.measurement_fingerprint) { await db.prepare("UPDATE growth_experiment_result_evaluations SET status = 'STALE', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND evaluation_id = ?").bind(tenantId, evaluationId).run(); throw new Error("Result Candidate is stale; re-evaluate before confirmation."); }
  if (!db.batch) throw new Error("Atomic Result confirmation is unavailable.");
  const actor = clean(input.actor, 120) || "admin"; const reason = clean(input.reason, 2000) || "Human confirmed the Result Candidate."; const result = latest.candidateResult;
  await db.batch([
    db.prepare("UPDATE growth_experiments SET status = 'COMPLETED', result_status = ?, result_summary = ?, measured_value = ?, absolute_change = ?, relative_change = ?, sample_size = ?, actual_end_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND experiment_id = ? AND status IN ('RUNNING','MEASURING','PAUSED')").bind(result, reason, latest.variantValue, latest.absoluteDifference, latest.relativeDifference, latest.sampleSize, tenantId, experiment.experiment_id),
    db.prepare("UPDATE growth_experiment_result_evaluations SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP, confirmation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND evaluation_id = ? AND status = 'CANDIDATE'").bind(actor, reason, tenantId, evaluationId),
  ]);
  await audit(db, tenantId, experiment.experiment_id, actor, "experiment.result.confirmed", { evaluationId, result, reason, sourceMeasurements: latest.sourceMeasurementIds, completed: true });
  return db.prepare("SELECT * FROM growth_experiment_result_evaluations WHERE tenant_id = ? AND evaluation_id = ?").bind(tenantId, evaluationId).first();
}

export async function rejectExperimentResult(db: D1, evaluationId: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const evaluation = await getResultEvaluation(db, evaluationId, tenantId); if (!evaluation) throw new Error("Result Candidate not found.");
  if (evaluation.status !== "CANDIDATE") throw new Error("Only a current Result Candidate can be rejected.");
  await db.prepare("UPDATE growth_experiment_result_evaluations SET status = 'REJECTED', confirmation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND evaluation_id = ?").bind(clean(input.reason, 2000) || "Result Candidate rejected for re-evaluation.", tenantId, evaluationId).run();
  await audit(db, tenantId, String(evaluation.experiment_id), clean(input.actor, 120) || "admin", "experiment.result.rejected", { evaluationId, reason: clean(input.reason, 2000) });
  return getResultEvaluation(db, evaluationId, tenantId);
}
