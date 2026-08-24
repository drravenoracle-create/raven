import { getExperiment, transitionExperiment } from "./growth-experiment-manager";
import { runExperimentPreflight } from "./growth-experiment-preflight";
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

type Experiment = Record<string, unknown> & { experiment_id: string; tenant_id: string; status: string; character_id?: string | null; source_json?: string | null };
export type ExperimentVariant = Record<string, unknown> & {
  variant_id: string;
  experiment_id: string;
  tenant_id: string;
  name: string;
  kind: "CONTROL" | "VARIANT";
  allocation_weight: number;
  status: string;
};
export type ExperimentRun = Record<string, unknown> & { run_id: string; experiment_id: string; tenant_id: string; status: string };

function clean(value: unknown, maxLength = 240) { return String(value ?? "").trim().slice(0, maxLength); }
function nullable(value: unknown) { const next = clean(value, 120); return next || null; }
function parseJson(value: unknown): Record<string, unknown> {
  try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}
function jsonObject(value: unknown) {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  return JSON.stringify(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
}
function weight(value: unknown) {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0 || next > 100) throw new Error("allocation_weight must be between 0 and 100.");
  return Math.round(next * 10000) / 10000;
}
function kind(value: unknown) {
  const next = clean(value, 20).toUpperCase();
  if (next !== "CONTROL" && next !== "VARIANT") throw new Error("kind must be CONTROL or VARIANT.");
  return next as "CONTROL" | "VARIANT";
}
function sourceScope(experiment: Experiment) {
  const source = parseJson(experiment.source_json);
  const scope = parseJson(source.scope);
  return {
    guildId: nullable(source.guildId ?? source.guild_id ?? scope.guildId ?? scope.guild_id),
    market: nullable(source.market ?? scope.market),
    country: nullable(source.country ?? scope.country),
    locale: nullable(source.locale ?? scope.locale),
    characterId: nullable(source.characterId ?? source.character_id ?? experiment.character_id),
    targetSegment: nullable(source.targetSegment ?? source.target_segment ?? scope.targetSegment ?? scope.target_segment),
  };
}
function variantScope(input: Record<string, unknown>, experiment: Experiment) {
  const expected = sourceScope(experiment);
  return {
    guildId: nullable(input.guildId ?? input.guild_id ?? expected.guildId),
    market: nullable(input.market ?? expected.market),
    country: nullable(input.country ?? expected.country),
    locale: nullable(input.locale ?? expected.locale),
    characterId: nullable(input.characterId ?? input.character_id ?? expected.characterId),
    targetSegment: nullable(input.targetSegment ?? input.target_segment ?? expected.targetSegment),
  };
}
function same(a: unknown, b: unknown) { return nullable(a) === nullable(b); }
function scopeMatches(experiment: Experiment, variant: Record<string, unknown>) {
  const expected = sourceScope(experiment);
  return ["guildId", "market", "country", "locale", "characterId", "targetSegment"].every((key) => same(expected[key as keyof typeof expected], variant[key]));
}
function active(status: unknown) { return ["ACTIVE", "ENABLED", "DRAFT"].includes(clean(status, 30).toUpperCase()); }

async function audit(db: D1, input: { tenantId: string; experimentId: string; actor: string; action: string; before?: unknown; after?: unknown; reason?: string }) {
  const after = JSON.stringify(input.after || {});
  const before = JSON.stringify({ ...(input.before as object || {}), reason: input.reason || "" });
  await db.prepare("INSERT INTO growth_audit_log (id, tenant_id, actor, action, subject_type, subject_id, before_json, after_json) VALUES (?, ?, ?, ?, 'experiment', ?, ?, ?)")
    .bind(crypto.randomUUID(), input.tenantId, input.actor || "admin", input.action, input.experimentId, before, after).run();
  await db.prepare("INSERT INTO growth_experiment_events (id, tenant_id, experiment_id, event_type, actor, reason, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), input.tenantId, input.experimentId, input.action, input.actor || "admin", clean(input.reason, 1000), before, after).run();
}

async function findExperiment(db: D1, idOrCode: string, tenantId: string) {
  return getExperiment(db, idOrCode, tenantId) as Promise<Experiment | null>;
}

export async function listExperimentVariants(db: D1, experimentId: string, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const result = await db.prepare("SELECT * FROM growth_experiment_variants WHERE tenant_id = ? AND experiment_id = ? ORDER BY CASE kind WHEN 'CONTROL' THEN 0 ELSE 1 END, datetime(created_at)").bind(tenantId, experimentId).all<ExperimentVariant>();
  return result.results || [];
}

export async function listExperimentRuns(db: D1, experimentId: string, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const result = await db.prepare(
    `SELECT r.*, (SELECT COUNT(*) FROM growth_experiment_assignments a WHERE a.tenant_id = r.tenant_id AND a.run_id = r.run_id) AS exposure_count
     FROM growth_experiment_runs r WHERE r.tenant_id = ? AND r.experiment_id = ? ORDER BY datetime(r.created_at) DESC`,
  ).bind(tenantId, experimentId).all<ExperimentRun & { exposure_count: number }>();
  return result.results || [];
}

export async function createExperimentVariant(db: D1, idOrCode: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const experiment = await findExperiment(db, idOrCode, tenantId);
  if (!experiment) throw new Error("Experiment not found.");
  const name = clean(input.name, 120);
  if (!name) throw new Error("Variant name is required.");
  const variantKind = kind(input.kind);
  const allocationWeight = weight(input.allocation_weight ?? input.allocationWeight);
  if (variantKind === "CONTROL") {
    const existing = await db.prepare("SELECT variant_id FROM growth_experiment_variants WHERE tenant_id = ? AND experiment_id = ? AND kind = 'CONTROL' LIMIT 1").bind(tenantId, experiment.experiment_id).first();
    if (existing) throw new Error("Only one CONTROL variant is allowed.");
  }
  const scope = variantScope(input, experiment);
  if (!scopeMatches(experiment, scope)) throw new Error("Variant scope must match the Experiment scope.");
  const variantId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO growth_experiment_variants
      (variant_id, experiment_id, tenant_id, guild_id, market, country, locale, character_id, target_segment, name, kind, configuration_json, allocation_weight, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
  ).bind(variantId, experiment.experiment_id, tenantId, scope.guildId, scope.market, scope.country, scope.locale, scope.characterId, scope.targetSegment, name, variantKind, jsonObject(input.configuration), allocationWeight).run();
  const created = await db.prepare("SELECT * FROM growth_experiment_variants WHERE tenant_id = ? AND variant_id = ?").bind(tenantId, variantId).first<ExperimentVariant>();
  await audit(db, { tenantId, experimentId: experiment.experiment_id, actor: clean(input.actor, 120) || "admin", action: "experiment.variant.created", after: created });
  return created;
}

export async function updateExperimentVariant(db: D1, idOrCode: string, variantId: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const experiment = await findExperiment(db, idOrCode, tenantId);
  if (!experiment) throw new Error("Experiment not found.");
  const current = await db.prepare("SELECT * FROM growth_experiment_variants WHERE tenant_id = ? AND experiment_id = ? AND variant_id = ?").bind(tenantId, experiment.experiment_id, variantId).first<ExperimentVariant>();
  if (!current) throw new Error("Variant not found.");
  const nextKind = input.kind === undefined ? current.kind : kind(input.kind);
  if (nextKind === "CONTROL" && current.kind !== "CONTROL") {
    const existing = await db.prepare("SELECT variant_id FROM growth_experiment_variants WHERE tenant_id = ? AND experiment_id = ? AND kind = 'CONTROL' AND variant_id <> ? LIMIT 1").bind(tenantId, experiment.experiment_id, variantId).first();
    if (existing) throw new Error("Only one CONTROL variant is allowed.");
  }
  const scope = variantScope({ ...current, ...input }, experiment);
  if (!scopeMatches(experiment, scope)) throw new Error("Variant scope must match the Experiment scope.");
  await db.prepare(
    `UPDATE growth_experiment_variants SET name = ?, kind = ?, configuration_json = ?, allocation_weight = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = ? AND experiment_id = ? AND variant_id = ?`,
  ).bind(clean(input.name ?? current.name, 120), nextKind, jsonObject(input.configuration ?? current.configuration_json), weight(input.allocation_weight ?? input.allocationWeight ?? current.allocation_weight), clean(input.status ?? current.status, 30).toUpperCase() || "ACTIVE", tenantId, experiment.experiment_id, variantId).run();
  const updated = await db.prepare("SELECT * FROM growth_experiment_variants WHERE tenant_id = ? AND variant_id = ?").bind(tenantId, variantId).first<ExperimentVariant>();
  await audit(db, { tenantId, experimentId: experiment.experiment_id, actor: clean(input.actor, 120) || "admin", action: "experiment.variant.updated", before: current, after: updated });
  return updated;
}

async function validateRunSetup(db: D1, experiment: Experiment, variants: ExperimentVariant[]) {
  const controls = variants.filter((item) => item.kind === "CONTROL");
  const alternatives = variants.filter((item) => item.kind === "VARIANT");
  if (controls.length !== 1) throw new Error("Exactly one CONTROL variant is required.");
  if (!alternatives.length) throw new Error("At least one VARIANT is required.");
  if (variants.some((item) => !active(item.status))) throw new Error("All Control and Variant entries must be active.");
  if (variants.some((item) => !scopeMatches(experiment, item))) throw new Error("All variants must match the Experiment scope.");
  const total = variants.reduce((sum, item) => sum + Number(item.allocation_weight || 0), 0);
  if (Math.abs(total - 100) > 0.0001) throw new Error(`Allocation weight must total 100 (current: ${total}).`);
}

export async function startExperimentRun(db: D1, idOrCode: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const experiment = await findExperiment(db, idOrCode, tenantId);
  if (!experiment) throw new Error("Experiment not found.");
  const activeRun = await db.prepare("SELECT run_id FROM growth_experiment_runs WHERE tenant_id = ? AND experiment_id = ? AND status IN ('STARTING','RUNNING') LIMIT 1").bind(tenantId, experiment.experiment_id).first();
  if (activeRun) throw new Error("An active Run already exists for this Experiment.");
  const preflight = await runExperimentPreflight(db, experiment.experiment_id, { tenantId }, clean(input.actor, 120) || "admin", true);
  if (!preflight.allowed) throw new Error(`Run start blocked by Preflight: ${preflight.decision}. ${preflight.blockers.join(" ")}`);
  const variants = await listExperimentVariants(db, experiment.experiment_id, tenantId);
  await validateRunSetup(db, experiment, variants);
  const preflightRow = await db.prepare("SELECT id FROM growth_guardrail_results WHERE tenant_id = ? AND subject_type = 'experiment' AND subject_id = ? ORDER BY rowid DESC LIMIT 1").bind(tenantId, experiment.experiment_id).first<{ id: string }>();
  const runId = crypto.randomUUID();
  await db.prepare("INSERT INTO growth_experiment_runs (run_id, experiment_id, tenant_id, status, started_at, start_reason, preflight_result_id) VALUES (?, ?, ?, 'STARTING', CURRENT_TIMESTAMP, ?, ?)")
    .bind(runId, experiment.experiment_id, tenantId, clean(input.start_reason ?? input.startReason, 1000) || "Manual approved Run start", preflightRow?.id || null).run();
  try {
    await transitionExperiment(db, experiment.experiment_id, "RUNNING", { actor: clean(input.actor, 120) || "admin", reason: "Execution Run started", executionRunId: runId }, tenantId);
  } catch (error) {
    await db.prepare("DELETE FROM growth_experiment_runs WHERE tenant_id = ? AND run_id = ? AND status = 'STARTING'").bind(tenantId, runId).run();
    throw error;
  }
  const run = await db.prepare("SELECT * FROM growth_experiment_runs WHERE tenant_id = ? AND run_id = ?").bind(tenantId, runId).first<ExperimentRun>();
  await audit(db, { tenantId, experimentId: experiment.experiment_id, actor: clean(input.actor, 120) || "admin", action: "experiment.run.started", after: run });
  return run;
}

export async function stopExperimentRun(db: D1, idOrCode: string, runId: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const experiment = await findExperiment(db, idOrCode, tenantId);
  if (!experiment) throw new Error("Experiment not found.");
  const run = await db.prepare("SELECT * FROM growth_experiment_runs WHERE tenant_id = ? AND experiment_id = ? AND run_id = ?").bind(tenantId, experiment.experiment_id, runId).first<ExperimentRun>();
  if (!run) throw new Error("Run not found.");
  if (!["STARTING", "RUNNING"].includes(run.status)) throw new Error("Run is not active.");
  await db.prepare("UPDATE growth_experiment_runs SET status = 'STOPPED', stopped_at = CURRENT_TIMESTAMP, stop_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND run_id = ?").bind(clean(input.stop_reason ?? input.stopReason, 1000) || "Manually stopped", tenantId, runId).run();
  if (experiment.status === "RUNNING") await transitionExperiment(db, experiment.experiment_id, "PAUSED", { actor: clean(input.actor, 120) || "admin", reason: "Execution Run stopped" }, tenantId);
  const stopped = await db.prepare("SELECT * FROM growth_experiment_runs WHERE tenant_id = ? AND run_id = ?").bind(tenantId, runId).first<ExperimentRun>();
  await audit(db, { tenantId, experimentId: experiment.experiment_id, actor: clean(input.actor, 120) || "admin", action: "experiment.run.stopped", before: run, after: stopped, reason: clean(input.stop_reason ?? input.stopReason, 1000) });
  return stopped;
}

function bucket(value: string) {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.codePointAt(0) || 0; hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % 10000 / 100;
}

export async function assignExperimentSubject(db: D1, idOrCode: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const experiment = await findExperiment(db, idOrCode, tenantId);
  if (!experiment) throw new Error("Experiment not found.");
  const subjectType = clean(input.subject_type ?? input.subjectType, 40);
  const subjectId = clean(input.subject_id ?? input.subjectId, 160);
  if (!subjectType || !subjectId) throw new Error("subject_type and subject_id are required.");
  const existing = await db.prepare("SELECT * FROM growth_experiment_assignments WHERE tenant_id = ? AND experiment_id = ? AND subject_type = ? AND subject_id = ? LIMIT 1").bind(tenantId, experiment.experiment_id, subjectType, subjectId).first();
  if (existing) return existing;
  const run = await db.prepare("SELECT * FROM growth_experiment_runs WHERE tenant_id = ? AND experiment_id = ? AND status = 'RUNNING' ORDER BY datetime(started_at) DESC LIMIT 1").bind(tenantId, experiment.experiment_id).first<ExperimentRun>();
  if (!run) throw new Error("A RUNNING Experiment Run is required.");
  const variants = (await listExperimentVariants(db, experiment.experiment_id, tenantId)).filter((item) => active(item.status));
  await validateRunSetup(db, experiment, variants);
  const point = bucket(`${experiment.experiment_id}:${subjectType}:${subjectId}`);
  let cursor = 0;
  const chosen = variants.find((item) => { cursor += Number(item.allocation_weight); return point < cursor; }) || variants[variants.length - 1];
  const assignmentId = crypto.randomUUID();
  await db.prepare("INSERT INTO growth_experiment_assignments (assignment_id, experiment_id, run_id, variant_id, tenant_id, subject_type, subject_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(assignmentId, experiment.experiment_id, run.run_id, chosen.variant_id, tenantId, subjectType, subjectId).run();
  return db.prepare("SELECT * FROM growth_experiment_assignments WHERE tenant_id = ? AND assignment_id = ?").bind(tenantId, assignmentId).first();
}
