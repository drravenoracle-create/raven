import { getExperiment, transitionExperiment } from "./growth-experiment-manager";
import { listExperimentVariants } from "./growth-experiment-execution";
import { GROWTH_ENGINE_TENANT_ID } from "./growth-engine";

type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
    };
  };
};

type Experiment = Record<string, unknown> & { experiment_id: string; tenant_id: string; status: string; primary_kpi?: string; primary_metric?: string; primary_kpi_direction?: string; guardrail_kpis_json?: string };
type Run = { run_id: string; experiment_id: string; tenant_id: string; status: string };
type Variant = { variant_id: string; experiment_id: string; tenant_id: string; kind: string; status: string };
export const MEASUREMENT_AVAILABILITY = ["AVAILABLE", "UNAVAILABLE", "NOT_SUPPORTED", "ERROR"] as const;
export const GUARDRAIL_RESULTS = ["PASS", "WARNING", "FAIL", "UNKNOWN"] as const;
export type MeasurementAvailability = typeof MEASUREMENT_AVAILABILITY[number];
export type GuardrailResult = typeof GUARDRAIL_RESULTS[number];

export type ExperimentMetricAdapter = {
  source: string;
  measure(input: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export const manualExperimentMetricAdapter: ExperimentMetricAdapter = {
  source: "manual",
  async measure(input) { return input; },
};

function clean(value: unknown, maxLength = 240) { return String(value ?? "").trim().slice(0, maxLength); }
function numberOrNull(value: unknown) { if (value === null || value === undefined || value === "") return null; const next = Number(value); return Number.isFinite(next) ? next : null; }
function integer(value: unknown) { const next = Number(value ?? 0); if (!Number.isInteger(next) || next < 0) throw new Error("sample_size must be a non-negative integer."); return next; }
function json(value: unknown) { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return JSON.stringify(parsed && typeof parsed === "object" ? parsed : {}); } catch { return "{}"; } }
function normalizeKey(value: unknown) { return clean(value, 120).toLowerCase().replace(/[\s-]+/g, "_"); }
function availability(value: unknown): MeasurementAvailability { const next = clean(value, 30).toUpperCase() as MeasurementAvailability; if (!MEASUREMENT_AVAILABILITY.includes(next)) throw new Error("Invalid measurement availability."); return next; }
function guardrailResult(value: unknown): GuardrailResult { const next = clean(value || "UNKNOWN", 30).toUpperCase() as GuardrailResult; if (!GUARDRAIL_RESULTS.includes(next)) throw new Error("Invalid guardrail result."); return next; }
function measuredAt(value: unknown) { const next = clean(value, 80) || new Date().toISOString(); if (!Number.isFinite(Date.parse(next))) throw new Error("measured_at must be a valid date."); return next; }
function sourceJson(experiment: Experiment) { try { return JSON.parse(String(experiment.guardrail_kpis_json || "[]")); } catch { return []; } }
function metricRegistry(experiment: Experiment) {
  const primary = clean(experiment.primary_kpi ?? experiment.primary_metric, 120);
  const guardrails = sourceJson(experiment);
  const entries = [{ key: normalizeKey(primary), name: primary, role: "primary", direction: clean(experiment.primary_kpi_direction, 40) || "increase" }];
  if (Array.isArray(guardrails)) for (const item of guardrails) { const name = clean(item, 120); if (name) entries.push({ key: normalizeKey(name), name, role: "guardrail", direction: "decrease" }); }
  return entries.filter((item, index, list) => item.key && list.findIndex((candidate) => candidate.key === item.key) === index);
}
async function experiment(db: D1, idOrCode: string, tenantId: string) { return getExperiment(db, idOrCode, tenantId) as Promise<Experiment | null>; }
async function run(db: D1, experimentId: string, runId: string, tenantId: string) { return db.prepare("SELECT run_id, experiment_id, tenant_id, status FROM growth_experiment_runs WHERE tenant_id = ? AND experiment_id = ? AND run_id = ? LIMIT 1").bind(tenantId, experimentId, runId).first<Run>(); }
async function variant(db: D1, experimentId: string, variantId: string, tenantId: string) { return db.prepare("SELECT variant_id, experiment_id, tenant_id, kind, status FROM growth_experiment_variants WHERE tenant_id = ? AND experiment_id = ? AND variant_id = ? LIMIT 1").bind(tenantId, experimentId, variantId).first<Variant>(); }

async function audit(db: D1, tenantId: string, experimentId: string, actor: string, action: string, after: unknown) {
  const payload = json(after);
  await db.prepare("INSERT INTO growth_audit_log (id, tenant_id, actor, action, subject_type, subject_id, before_json, after_json) VALUES (?, ?, ?, ?, 'experiment', ?, '{}', ?)")
    .bind(crypto.randomUUID(), tenantId, actor || "admin", action, experimentId, payload).run();
  await db.prepare("INSERT INTO growth_experiment_events (id, tenant_id, experiment_id, event_type, actor, reason, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), tenantId, experimentId, action, actor || "admin", "Measurement recorded", payload).run();
}

export async function listExperimentMeasurements(db: D1, idOrCode: string, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const current = await experiment(db, idOrCode, tenantId); if (!current) throw new Error("Experiment not found.");
  const result = await db.prepare("SELECT * FROM growth_experiment_metrics WHERE tenant_id = ? AND experiment_id = ? ORDER BY datetime(COALESCE(measured_at, created_at)) DESC").bind(tenantId, current.experiment_id).all();
  const guardrails = await db.prepare("SELECT * FROM growth_guardrail_results WHERE tenant_id = ? AND subject_type = 'experiment_run' AND subject_id IN (SELECT run_id FROM growth_experiment_runs WHERE tenant_id = ? AND experiment_id = ?) ORDER BY datetime(checked_at) DESC").bind(tenantId, tenantId, current.experiment_id).all();
  return { measurements: result.results || [], guardrails: guardrails.results || [] };
}

export async function recordExperimentMeasurement(db: D1, idOrCode: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const current = await experiment(db, idOrCode, tenantId); if (!current) throw new Error("Experiment not found.");
  const runId = clean(input.run_id ?? input.runId, 120); const variantId = clean(input.variant_id ?? input.variantId, 120);
  if (!runId || !variantId) throw new Error("run_id and variant_id are required.");
  const activeRun = await run(db, current.experiment_id, runId, tenantId); if (!activeRun) throw new Error("Run not found for this tenant and Experiment.");
  if (!["RUNNING", "MEASURING"].includes(activeRun.status)) throw new Error("Measurement requires a RUNNING or MEASURING Run.");
  const selectedVariant = await variant(db, current.experiment_id, variantId, tenantId); if (!selectedVariant) throw new Error("Variant not found for this tenant and Experiment.");
  const key = normalizeKey(input.metric_key ?? input.metricKey); const registry = metricRegistry(current); const entry = registry.find((item) => item.key === key);
  if (!entry) throw new Error("metric_key is not registered for this Experiment.");
  const available = availability(input.availability); const baseline = numberOrNull(input.baseline_value ?? input.baselineValue); const measured = available === "AVAILABLE" ? numberOrNull(input.measured_value ?? input.measuredValue) : null;
  const absolute = baseline !== null && measured !== null ? Math.round((measured - baseline) * 10000) / 10000 : null;
  const relative = baseline !== null && measured !== null && baseline !== 0 ? Math.round(((measured - baseline) / baseline) * 10000) / 100 : null;
  const sampleSize = integer(input.sample_size ?? input.sampleSize);
  const at = measuredAt(input.measured_at ?? input.measuredAt); const source = clean(input.source, 80) || "manual";
  const idempotency = clean(input.idempotency_key ?? input.idempotencyKey, 240) || `${runId}:${variantId}:${entry.key}:${at}`;
  const existing = await db.prepare("SELECT * FROM growth_experiment_metrics WHERE tenant_id = ? AND idempotency_key = ? LIMIT 1").bind(tenantId, idempotency).first(); if (existing) return { measurement: existing, duplicate: true, guardrail: null };
  const measurementId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO growth_experiment_metrics
      (id, tenant_id, experiment_id, run_id, variant_id, metric_name, metric_role, direction, baseline_value, measured_value, absolute_change, relative_change, source, availability, measured_at, calculation_method, sample_size, data_quality, idempotency_key, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(measurementId, tenantId, current.experiment_id, runId, variantId, entry.name, entry.role, entry.direction, baseline, measured, absolute, relative, source, available, at, clean(input.calculation_method ?? input.calculationMethod, 200) || "manual", sampleSize, available === "AVAILABLE" ? "manual" : "unavailable", idempotency, json(input.metadata)).run();
  let guardrail = null;
  if (entry.role === "guardrail") {
    const result = guardrailResult(input.guardrail_result ?? input.guardrailResult);
    const reasons = [clean(input.guardrail_reason ?? input.guardrailReason, 1000) || `Guardrail ${result}.`];
    await db.prepare("INSERT INTO growth_guardrail_results (id, tenant_id, subject_type, subject_id, result, reasons_json, policy_snapshot_json) VALUES (?, ?, 'experiment_run', ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), tenantId, runId, result, JSON.stringify(reasons), JSON.stringify({ experimentId: current.experiment_id, variantId, metricKey: entry.key, measuredAt: at, autoStop: false, automaticDecision: false })).run();
    guardrail = { result, reasons };
  }
  if (current.status === "RUNNING") await transitionExperiment(db, current.experiment_id, "MEASURING", { actor: clean(input.actor, 120) || "admin", reason: "KPI measurement recorded" }, tenantId);
  const saved = await db.prepare("SELECT * FROM growth_experiment_metrics WHERE tenant_id = ? AND id = ?").bind(tenantId, measurementId).first();
  await audit(db, tenantId, current.experiment_id, clean(input.actor, 120) || "admin", "experiment.measurement.recorded", { measurement: saved, guardrail, autoStop: false, automaticDecision: false });
  return { measurement: saved, duplicate: false, guardrail };
}

export async function listMeasurementVariants(db: D1, idOrCode: string, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const current = await experiment(db, idOrCode, tenantId); if (!current) throw new Error("Experiment not found."); return listExperimentVariants(db, current.experiment_id, tenantId);
}
