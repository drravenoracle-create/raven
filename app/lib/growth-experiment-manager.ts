import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";

type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

export const EXPERIMENT_STATUSES = [
  "DRAFT",
  "PROPOSED",
  "WAITING_APPROVAL",
  "APPROVED",
  "RUNNING",
  "PAUSED",
  "MEASURING",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "ARCHIVED",
] as const;

export const RESULT_STATUSES = ["WIN", "LOSS", "NEUTRAL", "INCONCLUSIVE", "NOT_MEASURED"] as const;

const statusTransitions: Record<string, string[]> = {
  DRAFT: ["PROPOSED", "WAITING_APPROVAL", "APPROVED", "CANCELLED", "ARCHIVED"],
  PROPOSED: ["WAITING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED", "ARCHIVED"],
  WAITING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["RUNNING", "CANCELLED", "ARCHIVED"],
  RUNNING: ["PAUSED", "MEASURING", "COMPLETED", "CANCELLED"],
  PAUSED: ["RUNNING", "CANCELLED", "ARCHIVED"],
  MEASURING: ["COMPLETED", "RUNNING", "CANCELLED"],
  COMPLETED: ["ARCHIVED"],
  REJECTED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};

const riskyTargetTypes = new Set(["PRICE", "FREE_TRIAL", "CHARACTER", "SNS", "MEMBERSHIP"]);

function clean(value: unknown, maxLength = 1000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function json(value: unknown, fallback: unknown) {
  if (value === undefined || value === null || value === "") return JSON.stringify(fallback);
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(fallback);
    }
  }
  return JSON.stringify(value);
}

function normalizeStatus(value: unknown, fallback = "DRAFT") {
  const next = clean(value, 40).toUpperCase();
  return EXPERIMENT_STATUSES.includes(next as (typeof EXPERIMENT_STATUSES)[number]) ? next : fallback;
}

function normalizeResultStatus(value: unknown) {
  const next = clean(value, 40).toUpperCase();
  return RESULT_STATUSES.includes(next as (typeof RESULT_STATUSES)[number]) ? next : "NOT_MEASURED";
}

function normalizeTargetType(value: unknown) {
  const next = clean(value, 40).toUpperCase();
  return ["PAGE", "CTA", "MENU", "PRICE", "FREE_TRIAL", "CHARACTER", "CONTENT", "SEO", "SNS", "FUNNEL", "MEMBERSHIP", "OTHER"].includes(next) ? next : "OTHER";
}

function normalizePriority(value: unknown, score: number) {
  const next = clean(value, 20).toUpperCase();
  if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(next)) return next;
  if (score >= 80) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

export function calculateIceScore(impact: number, confidence: number, ease: number) {
  const bounded = [impact, confidence, ease].map((value) => Math.max(0, Math.min(Number(value) || 0, 100)));
  return Math.round(((bounded[0] + bounded[1] + bounded[2]) / 3) * 10) / 10;
}

export function requiresHumanApproval(input: { targetType: string; changeSummary?: string; approvalRequired?: unknown }) {
  if (input.approvalRequired === false || input.approvalRequired === 0) return riskyTargetTypes.has(input.targetType);
  if (input.approvalRequired === true || input.approvalRequired === 1) return true;
  const text = clean(input.changeSummary, 2000).toLowerCase();
  return riskyTargetTypes.has(input.targetType) || /価格|課金|無料回数|system prompt|人格|sns自動|外部連携|個人情報|price|billing|prompt|privacy/.test(text);
}

export async function nextExperimentCode(db: D1, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const year = new Date().getUTCFullYear();
  const row = await db.prepare("SELECT experiment_code FROM growth_experiments WHERE tenant_id = ? AND experiment_code LIKE ? ORDER BY experiment_code DESC LIMIT 1")
    .bind(tenantId, `EXP-${year}-%`)
    .first<{ experiment_code: string }>();
  const last = Number((row?.experiment_code || "").split("-").pop() || 0);
  return `EXP-${year}-${String(last + 1).padStart(5, "0")}`;
}

export async function getExperiment(db: D1, idOrCode: string, tenantId = GROWTH_ENGINE_TENANT_ID) {
  return db.prepare("SELECT * FROM growth_experiments WHERE tenant_id = ? AND (experiment_id = ? OR experiment_code = ?) LIMIT 1")
    .bind(tenantId, idOrCode, idOrCode)
    .first<Record<string, unknown>>();
}

export async function listExperiments(db: D1, input: Record<string, unknown> = {}, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const status = clean(input.status, 40).toUpperCase();
  const characterId = clean(input.character_id ?? input.characterId, 80);
  const resultStatus = clean(input.result_status ?? input.resultStatus, 40).toUpperCase();
  const q = `%${clean(input.q, 120)}%`;
  const limit = Math.min(Math.max(Number(input.limit || 50), 1), 100);
  const offset = Math.max(Number(input.offset || 0), 0);
  const result = await db.prepare(
    `SELECT experiment_id, experiment_code, tenant_id, character_id, growth_recommendation_id, title, hypothesis, change_summary,
       target_type, target_id, primary_kpi, primary_kpi_direction, baseline_value, target_value, measured_value, absolute_change,
       relative_change, estimated_revenue_impact, status, priority, priority_score, impact_score, confidence_score, ease_score,
       owner, approval_required, approved_by, approved_at, result_status, result_summary, planned_start_at, planned_end_at,
       actual_start_at, actual_end_at, learning, next_action, created_at, updated_at
     FROM growth_experiments
     WHERE tenant_id = ?
       AND (? = '' OR status = ?)
       AND (? = '' OR character_id = ?)
       AND (? = '' OR result_status = ?)
       AND (? = '%%' OR title LIKE ? OR hypothesis LIKE ? OR experiment_code LIKE ?)
     ORDER BY priority_score DESC, datetime(updated_at) DESC, datetime(created_at) DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(tenantId, status, status, characterId, characterId, resultStatus, resultStatus, q, q, q, q, limit, offset)
    .all();
  return result.results || [];
}

export async function experimentSummary(db: D1, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const rows = await db.prepare(
    `SELECT
       SUM(CASE WHEN status IN ('RUNNING','PAUSED','MEASURING') THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN status = 'WAITING_APPROVAL' THEN 1 ELSE 0 END) AS waiting,
       SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN result_status = 'WIN' THEN 1 ELSE 0 END) AS wins,
       SUM(CASE WHEN result_status = 'LOSS' THEN 1 ELSE 0 END) AS losses,
       SUM(CASE WHEN estimated_revenue_impact IS NOT NULL THEN estimated_revenue_impact ELSE 0 END) AS estimated_revenue_impact
     FROM growth_experiments WHERE tenant_id = ?`,
  ).bind(tenantId).first<Record<string, number>>();
  const active = Number(rows?.active || 0);
  const waiting = Number(rows?.waiting || 0);
  const completed = Number(rows?.completed || 0);
  const wins = Number(rows?.wins || 0);
  const losses = Number(rows?.losses || 0);
  const estimatedRevenueImpact = Number(rows?.estimated_revenue_impact || 0);
  return {
    active,
    waiting,
    completed,
    wins,
    losses,
    estimated_revenue_impact: estimatedRevenueImpact,
    win_rate: completed ? Math.round((wins / completed) * 1000) / 10 : 0,
  };
}

export async function listExperimentDetail(db: D1, idOrCode: string, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const experiment = await getExperiment(db, idOrCode, tenantId);
  if (!experiment) throw new Error("Experiment not found.");
  const id = String(experiment.experiment_id);
  const [metrics, events, approvals, audit] = await Promise.all([
    db.prepare("SELECT * FROM growth_experiment_metrics WHERE tenant_id = ? AND experiment_id = ? ORDER BY datetime(created_at) DESC").bind(tenantId, id).all(),
    db.prepare("SELECT * FROM growth_experiment_events WHERE tenant_id = ? AND experiment_id = ? ORDER BY datetime(created_at) DESC LIMIT 100").bind(tenantId, id).all(),
    db.prepare("SELECT * FROM growth_experiment_approvals WHERE tenant_id = ? AND experiment_id = ? ORDER BY datetime(created_at) DESC").bind(tenantId, id).all(),
    db.prepare("SELECT actor, action, before_json, after_json, created_at FROM growth_audit_log WHERE tenant_id = ? AND subject_type = 'experiment' AND subject_id = ? ORDER BY datetime(created_at) DESC LIMIT 100").bind(tenantId, id).all(),
  ]);
  return { experiment, metrics: metrics.results || [], events: events.results || [], approvals: approvals.results || [], audit: audit.results || [] };
}

async function auditExperiment(db: D1, input: { tenantId: string; experimentId: string; actor: string; action: string; before?: unknown; after?: unknown; reason?: string; fromStatus?: string; toStatus?: string }) {
  await db.prepare("INSERT INTO growth_audit_log (id, tenant_id, actor, action, subject_type, subject_id, before_json, after_json) VALUES (?, ?, ?, ?, 'experiment', ?, ?, ?)")
    .bind(crypto.randomUUID(), input.tenantId, input.actor || "admin", input.action, input.experimentId, json({ ...(input.before as object || {}), reason: input.reason || "" }, {}), json(input.after || {}, {}))
    .run();
  await db.prepare("INSERT INTO growth_experiment_events (id, tenant_id, experiment_id, event_type, actor, from_status, to_status, reason, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), input.tenantId, input.experimentId, input.action, input.actor || "admin", input.fromStatus || null, input.toStatus || null, clean(input.reason, 1000), json(input.before || {}, {}), json(input.after || {}, {}))
    .run();
}

export async function createExperiment(db: D1, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const id = crypto.randomUUID();
  const targetType = normalizeTargetType(input.target_type ?? input.targetType);
  const impact = Number(input.impact_score ?? input.impactScore ?? 50);
  const confidence = Number(input.confidence_score ?? input.confidenceScore ?? input.confidence ?? 50);
  const ease = Number(input.ease_score ?? input.easeScore ?? 50);
  const priorityScore = calculateIceScore(impact, confidence, ease);
  const approvalRequired = requiresHumanApproval({ targetType, changeSummary: clean(input.change_summary ?? input.changeSummary, 2000), approvalRequired: input.approval_required ?? input.approvalRequired }) ? 1 : 0;
  const status = normalizeStatus(input.status, approvalRequired ? "WAITING_APPROVAL" : "APPROVED");
  const experimentCode = clean(input.experiment_code ?? input.experimentCode, 40) || await nextExperimentCode(db, tenantId);
  const primaryKpi = clean(input.primary_kpi ?? input.primaryKpi ?? input.primary_metric ?? input.primaryMetric, 120) || "Conversion Rate";
  const hypothesis = clean(input.hypothesis, 3000);
  if (!hypothesis) throw new Error("hypothesis is required.");
  const title = clean(input.title, 200) || hypothesis.slice(0, 120);
  const guardrails = input.guardrail_kpis ?? input.guardrailKpis ?? input.guardrail_metrics ?? input.guardrailMetrics ?? [];

  await db.prepare(
    `INSERT INTO growth_experiments
      (experiment_id, experiment_code, tenant_id, character_id, growth_recommendation_id, title, description, hypothesis, variants_json,
       primary_metric, guardrail_metrics_json, primary_kpi, primary_kpi_direction, guardrail_kpis_json, change_summary, target_type, target_id,
       baseline_start_at, baseline_end_at, baseline_value, baseline_snapshot_json, target_value, planned_start_at, planned_end_at,
       actual_start_at, actual_end_at, status, priority, priority_score, impact_score, confidence_score, ease_score, owner,
       approval_required, result_status, result_summary, measured_value, absolute_change, relative_change, estimated_revenue_impact,
       learning, next_action, source_json, sample_size, confidence, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  )
    .bind(
      id,
      experimentCode,
      tenantId,
      clean(input.character_id ?? input.characterId, 80) || null,
      clean(input.growth_recommendation_id ?? input.growthRecommendationId, 120) || null,
      title,
      clean(input.description, 3000),
      hypothesis,
      json(input.variants ?? [], []),
      primaryKpi,
      json(guardrails, []),
      primaryKpi,
      clean(input.primary_kpi_direction ?? input.primaryKpiDirection, 40) || "increase",
      json(guardrails, []),
      clean(input.change_summary ?? input.changeSummary, 3000),
      targetType,
      clean(input.target_id ?? input.targetId, 200),
      clean(input.baseline_start_at ?? input.baselineStartAt, 80) || null,
      clean(input.baseline_end_at ?? input.baselineEndAt, 80) || null,
      numberOrNull(input.baseline_value ?? input.baselineValue),
      json(input.baseline_snapshot ?? input.baselineSnapshot ?? { source: "manual" }, {}),
      numberOrNull(input.target_value ?? input.targetValue),
      clean(input.planned_start_at ?? input.plannedStartAt, 80) || null,
      clean(input.planned_end_at ?? input.plannedEndAt, 80) || null,
      clean(input.actual_start_at ?? input.actualStartAt, 80) || null,
      clean(input.actual_end_at ?? input.actualEndAt, 80) || null,
      status,
      normalizePriority(input.priority, priorityScore),
      priorityScore,
      impact,
      confidence,
      ease,
      clean(input.owner, 120),
      approvalRequired,
      normalizeResultStatus(input.result_status ?? input.resultStatus),
      clean(input.result_summary ?? input.resultSummary, 3000),
      numberOrNull(input.measured_value ?? input.measuredValue),
      numberOrNull(input.absolute_change ?? input.absoluteChange),
      numberOrNull(input.relative_change ?? input.relativeChange),
      numberOrNull(input.estimated_revenue_impact ?? input.estimatedRevenueImpact),
      clean(input.learning, 3000),
      clean(input.next_action ?? input.nextAction, 3000),
      json(input.source ?? {}, {}),
      Number(input.sample_size ?? input.sampleSize ?? 0),
      Math.max(0, Math.min(confidence / 100, 1)),
    )
    .run();

  await auditExperiment(db, { tenantId, experimentId: id, actor: clean(input.actor, 120) || "admin", action: "experiment.created", after: { experiment_code: experimentCode, status }, toStatus: status });
  return getExperiment(db, id, tenantId);
}

export async function updateExperiment(db: D1, idOrCode: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const current = await getExperiment(db, idOrCode, tenantId);
  if (!current) throw new Error("Experiment not found.");
  const id = String(current.experiment_id);
  const targetType = normalizeTargetType(input.target_type ?? input.targetType ?? current.target_type);
  const impact = Number(input.impact_score ?? input.impactScore ?? current.impact_score ?? 0);
  const confidence = Number(input.confidence_score ?? input.confidenceScore ?? current.confidence_score ?? 0);
  const ease = Number(input.ease_score ?? input.easeScore ?? current.ease_score ?? 0);
  const priorityScore = calculateIceScore(impact, confidence, ease);
  const guardrails = input.guardrail_kpis ?? input.guardrailKpis ?? current.guardrail_kpis_json ?? [];

  await db.prepare(
    `UPDATE growth_experiments
     SET character_id = ?, title = ?, description = ?, hypothesis = ?, change_summary = ?, target_type = ?, target_id = ?,
       primary_metric = ?, primary_kpi = ?, primary_kpi_direction = ?, guardrail_metrics_json = ?, guardrail_kpis_json = ?,
       baseline_start_at = ?, baseline_end_at = ?, baseline_value = ?, baseline_snapshot_json = ?, target_value = ?,
       planned_start_at = ?, planned_end_at = ?, priority = ?, priority_score = ?, impact_score = ?, confidence_score = ?,
       ease_score = ?, owner = ?, approval_required = ?, source_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = ? AND experiment_id = ?`,
  )
    .bind(
      clean(input.character_id ?? input.characterId ?? current.character_id, 80) || null,
      clean(input.title ?? current.title, 200),
      clean(input.description ?? current.description, 3000),
      clean(input.hypothesis ?? current.hypothesis, 3000),
      clean(input.change_summary ?? input.changeSummary ?? current.change_summary, 3000),
      targetType,
      clean(input.target_id ?? input.targetId ?? current.target_id, 200),
      clean(input.primary_kpi ?? input.primaryKpi ?? current.primary_kpi ?? current.primary_metric, 120),
      clean(input.primary_kpi ?? input.primaryKpi ?? current.primary_kpi ?? current.primary_metric, 120),
      clean(input.primary_kpi_direction ?? input.primaryKpiDirection ?? current.primary_kpi_direction, 40) || "increase",
      json(guardrails, []),
      json(guardrails, []),
      clean(input.baseline_start_at ?? input.baselineStartAt ?? current.baseline_start_at, 80) || null,
      clean(input.baseline_end_at ?? input.baselineEndAt ?? current.baseline_end_at, 80) || null,
      numberOrNull(input.baseline_value ?? input.baselineValue ?? current.baseline_value),
      json(input.baseline_snapshot ?? input.baselineSnapshot ?? current.baseline_snapshot_json ?? {}, {}),
      numberOrNull(input.target_value ?? input.targetValue ?? current.target_value),
      clean(input.planned_start_at ?? input.plannedStartAt ?? current.planned_start_at, 80) || null,
      clean(input.planned_end_at ?? input.plannedEndAt ?? current.planned_end_at, 80) || null,
      normalizePriority(input.priority ?? current.priority, priorityScore),
      priorityScore,
      impact,
      confidence,
      ease,
      clean(input.owner ?? current.owner, 120),
      requiresHumanApproval({ targetType, changeSummary: clean(input.change_summary ?? input.changeSummary ?? current.change_summary, 3000), approvalRequired: input.approval_required ?? input.approvalRequired ?? current.approval_required }) ? 1 : 0,
      json(input.source ?? current.source_json ?? {}, {}),
      tenantId,
      id,
    )
    .run();
  const updated = await getExperiment(db, id, tenantId);
  await auditExperiment(db, { tenantId, experimentId: id, actor: clean(input.actor, 120) || "admin", action: "experiment.updated", before: current, after: updated });
  return updated;
}

export async function transitionExperiment(db: D1, idOrCode: string, toStatusInput: unknown, input: Record<string, unknown> = {}, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const current = await getExperiment(db, idOrCode, tenantId);
  if (!current) throw new Error("Experiment not found.");
  const fromStatus = normalizeStatus(current.status, "DRAFT");
  const toStatus = normalizeStatus(toStatusInput, fromStatus);
  if (fromStatus === toStatus) return current;
  if (!statusTransitions[fromStatus]?.includes(toStatus)) throw new Error(`Invalid transition: ${fromStatus} -> ${toStatus}`);
  const nowField = toStatus === "RUNNING" ? "actual_start_at = COALESCE(actual_start_at, CURRENT_TIMESTAMP)," : toStatus === "COMPLETED" ? "actual_end_at = COALESCE(actual_end_at, CURRENT_TIMESTAMP)," : "";
  await db.prepare(`UPDATE growth_experiments SET ${nowField} status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND experiment_id = ?`)
    .bind(toStatus, tenantId, current.experiment_id)
    .run();
  const updated = await getExperiment(db, String(current.experiment_id), tenantId);
  await auditExperiment(db, {
    tenantId,
    experimentId: String(current.experiment_id),
    actor: clean(input.actor, 120) || "admin",
    action: `experiment.status.${toStatus.toLowerCase()}`,
    before: current,
    after: updated,
    reason: clean(input.reason, 1000),
    fromStatus,
    toStatus,
  });
  return updated;
}

export async function approveExperiment(db: D1, idOrCode: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const actor = clean(input.actor ?? input.approved_by ?? input.approvedBy, 120);
  if (!actor || actor === "growth_engine") throw new Error("Human approver is required.");
  const current = await getExperiment(db, idOrCode, tenantId);
  if (!current) throw new Error("Experiment not found.");
  const fromStatus = normalizeStatus(current.status, "DRAFT");
  if (!["PROPOSED", "WAITING_APPROVAL", "DRAFT"].includes(fromStatus)) throw new Error(`Cannot approve from ${fromStatus}.`);
  await db.prepare("UPDATE growth_experiments SET status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND experiment_id = ?")
    .bind(actor, tenantId, current.experiment_id)
    .run();
  await db.prepare("INSERT INTO growth_experiment_approvals (id, tenant_id, experiment_id, decision, actor, reason) VALUES (?, ?, ?, 'APPROVED', ?, ?)")
    .bind(crypto.randomUUID(), tenantId, current.experiment_id, actor, clean(input.reason, 1000))
    .run();
  const updated = await getExperiment(db, String(current.experiment_id), tenantId);
  await auditExperiment(db, { tenantId, experimentId: String(current.experiment_id), actor, action: "experiment.approved", before: current, after: updated, reason: clean(input.reason, 1000), fromStatus, toStatus: "APPROVED" });
  return updated;
}

export async function rejectExperiment(db: D1, idOrCode: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const actor = clean(input.actor, 120) || "admin";
  const current = await getExperiment(db, idOrCode, tenantId);
  if (!current) throw new Error("Experiment not found.");
  const fromStatus = normalizeStatus(current.status, "DRAFT");
  if (!["PROPOSED", "WAITING_APPROVAL", "DRAFT"].includes(fromStatus)) throw new Error(`Cannot reject from ${fromStatus}.`);
  await db.prepare("UPDATE growth_experiments SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND experiment_id = ?").bind(tenantId, current.experiment_id).run();
  await db.prepare("INSERT INTO growth_experiment_approvals (id, tenant_id, experiment_id, decision, actor, reason) VALUES (?, ?, ?, 'REJECTED', ?, ?)")
    .bind(crypto.randomUUID(), tenantId, current.experiment_id, actor, clean(input.reason, 1000))
    .run();
  const updated = await getExperiment(db, String(current.experiment_id), tenantId);
  await auditExperiment(db, { tenantId, experimentId: String(current.experiment_id), actor, action: "experiment.rejected", before: current, after: updated, reason: clean(input.reason, 1000), fromStatus, toStatus: "REJECTED" });
  return updated;
}

export async function recordExperimentResult(db: D1, idOrCode: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const current = await getExperiment(db, idOrCode, tenantId);
  if (!current) throw new Error("Experiment not found.");
  const baselineValue = numberOrNull(input.baseline_value ?? input.baselineValue ?? current.baseline_value);
  const measuredValue = numberOrNull(input.measured_value ?? input.measuredValue);
  const absolute = baselineValue !== null && measuredValue !== null ? Math.round((measuredValue - baselineValue) * 10000) / 10000 : numberOrNull(input.absolute_change ?? input.absoluteChange);
  const relative = baselineValue && measuredValue !== null ? Math.round(((measuredValue - baselineValue) / baselineValue) * 10000) / 100 : numberOrNull(input.relative_change ?? input.relativeChange);
  const resultStatus = normalizeResultStatus(input.result_status ?? input.resultStatus);
  await db.prepare(
    `UPDATE growth_experiments
     SET result_status = ?, result_summary = ?, measured_value = ?, absolute_change = ?, relative_change = ?,
       estimated_revenue_impact = ?, learning = ?, next_action = ?, sample_size = ?, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = ? AND experiment_id = ?`,
  )
    .bind(
      resultStatus,
      clean(input.result_summary ?? input.resultSummary, 3000),
      measuredValue,
      absolute,
      relative,
      numberOrNull(input.estimated_revenue_impact ?? input.estimatedRevenueImpact),
      clean(input.learning, 3000),
      clean(input.next_action ?? input.nextAction, 3000),
      Number(input.sample_size ?? input.sampleSize ?? current.sample_size ?? 0),
      tenantId,
      current.experiment_id,
    )
    .run();
  await db.prepare(
    `INSERT INTO growth_experiment_metrics
      (id, tenant_id, experiment_id, metric_name, metric_role, direction, baseline_value, measured_value, absolute_change, relative_change,
       source, calculation_method, sample_size, window_start, window_end, data_quality, metadata_json)
     VALUES (?, ?, ?, ?, 'primary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      tenantId,
      current.experiment_id,
      clean(current.primary_kpi ?? current.primary_metric, 120),
      clean(current.primary_kpi_direction, 40) || "increase",
      baselineValue,
      measuredValue,
      absolute,
      relative,
      clean(input.source, 80) || "manual",
      clean(input.calculation_method ?? input.calculationMethod, 200) || "manual_pre_post_comparison",
      Number(input.sample_size ?? input.sampleSize ?? current.sample_size ?? 0),
      clean(input.window_start ?? input.windowStart ?? current.actual_start_at, 80) || null,
      clean(input.window_end ?? input.windowEnd ?? current.actual_end_at, 80) || null,
      clean(input.data_quality ?? input.dataQuality, 80) || "manual",
      json(input.metadata ?? {}, {}),
    )
    .run();
  const updated = await getExperiment(db, String(current.experiment_id), tenantId);
  await auditExperiment(db, { tenantId, experimentId: String(current.experiment_id), actor: clean(input.actor, 120) || "admin", action: "experiment.result.recorded", before: current, after: updated, reason: clean(input.reason, 1000) });
  return updated;
}

export async function createExperimentFromRecommendation(db: D1, recommendationId: string, input: Record<string, unknown> = {}, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const existing = await db.prepare("SELECT experiment_id, experiment_code FROM growth_experiments WHERE tenant_id = ? AND growth_recommendation_id = ? LIMIT 1")
    .bind(tenantId, recommendationId)
    .first();
  if (existing) return existing;
  const insight = await db.prepare("SELECT * FROM growth_content_insights WHERE tenant_id = ? AND id = ? LIMIT 1").bind(tenantId, recommendationId).first<Record<string, unknown>>();
  if (!insight) throw new Error("Recommendation not found.");
  return createExperiment(db, {
    ...input,
    status: "PROPOSED",
    growth_recommendation_id: recommendationId,
    title: clean(input.title ?? insight.topic ?? insight.insight_type, 200),
    description: clean(insight.summary, 2000),
    hypothesis: clean(input.hypothesis ?? `${insight.recommended_action || insight.summary} により、${input.primary_kpi ?? "Conversion Rate"}の改善を検証する。`, 3000),
    change_summary: clean(input.change_summary ?? insight.recommended_action, 3000),
    target_type: input.target_type ?? "CONTENT",
    primary_kpi: input.primary_kpi ?? "Conversion Rate",
    guardrail_kpis: input.guardrail_kpis ?? ["Bounce Rate", "Complaint Rate"],
    impact_score: input.impact_score ?? 60,
    confidence_score: input.confidence_score ?? Math.round(Number(insight.confidence || 0.5) * 100),
    ease_score: input.ease_score ?? 50,
    source: { type: "growth_content_insight", id: recommendationId, evidence: insight.evidence_json || "{}" },
  }, tenantId);
}
