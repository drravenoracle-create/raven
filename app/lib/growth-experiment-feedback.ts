import { createClaim, createSource, getSource, listClaimsBySource, type EvidenceClaim, type EvidenceSource } from "./evidence-layer.ts";
import { getExperiment } from "./growth-experiment-manager.ts";
import { getResultEvaluation } from "./growth-experiment-result.ts";
import { GROWTH_ENGINE_TENANT_ID } from "./growth-engine.ts";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { first<T = unknown>(): Promise<T | null>; all<T = unknown>(): Promise<{ results?: T[] }>; run(): Promise<unknown> } } };
type Experiment = Record<string, unknown> & { experiment_id: string; tenant_id: string; title?: string; character_id?: string | null; source_json?: string | null };
type Evaluation = Record<string, unknown> & { evaluation_id: string; experiment_id: string; tenant_id: string; status: string; candidate_result: string; guardrail_status?: string; sample_size?: number; confidence?: number; primary_metric?: string; control_value?: number; variant_value?: number; absolute_difference?: number; relative_difference?: number; evaluated_at?: string; confirmed_at?: string };

const HIGH_RISK_TYPES = new Set(["PRICE", "BILLING", "TRIAL", "NEW_CHARACTER", "NEW_GUILD", "MARKET", "BRAND", "DESTRUCTIVE", "AUTO_PUBLISH", "EXTERNAL", "PUBLIC"]);
function clean(value: unknown, max = 240) { return String(value ?? "").trim().slice(0, max); }
function parse(value: unknown): Record<string, unknown> { try { const result = typeof value === "string" ? JSON.parse(value) : value; return result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : {}; } catch { return {}; } }
function json(value: unknown) { try { return JSON.stringify(value ?? {}); } catch { return "{}"; } }
function scope(experiment: Experiment, input: Record<string, unknown> = {}) {
  const source = parse(experiment.source_json);
  return { tenantId: experiment.tenant_id, guildId: clean(input.guild_id ?? input.guildId ?? source.guildId, 120) || null, market: clean(input.market ?? source.market, 80) || null, country: clean(input.country ?? source.country, 80) || null, locale: clean(input.locale ?? source.locale, 40) || null, characterId: clean(input.character_id ?? input.characterId ?? experiment.character_id, 80) || null };
}
function assertScope(experiment: Experiment, input: Record<string, unknown>) {
  const base = scope(experiment);
  for (const [key, label] of [["guild_id", "guild"], ["market", "market"], ["country", "country"], ["locale", "locale"]] as const) {
    const supplied = clean(input[key] ?? input[key.replace("_id", "Id")], 80);
    const expected = clean(base[key === "guild_id" ? "guildId" : key], 80);
    if (supplied && expected && supplied !== expected) throw new Error(`${label} scope must match the Experiment.`);
  }
  return base;
}
function riskType(experiment: Experiment, input: Record<string, unknown> = {}) { return clean(input.rollback_type ?? input.rollbackType ?? experiment.target_type, 80).toUpperCase() || "EXPERIMENT"; }
function recommendation(evaluation: Evaluation, experiment: Experiment, input: Record<string, unknown> = {}) {
  const result = clean(evaluation.candidate_result, 40).toUpperCase(); const guardrail = clean(evaluation.guardrail_status, 40).toUpperCase(); const type = riskType(experiment, input);
  const requested = input.manual_rollback_request === true || input.manualRollbackRequest === true;
  const unsafe = HIGH_RISK_TYPES.has(type) || input.unsafe === true;
  if (result === "WIN" && !requested) return null;
  if (result === "LOSS" || guardrail === "FAIL" || requested || unsafe) return { recommended: true, reason: result === "LOSS" ? "Confirmed LOSS result." : guardrail === "FAIL" ? "Confirmed Guardrail FAIL." : requested ? "Manual rollback request." : "Potentially unsafe or destructive scope.", rollbackType: type, riskClass: unsafe ? "HIGH" : "MEDIUM", approvalRequired: true, automaticExecution: false };
  return { recommended: false, reason: result === "INCONCLUSIVE" ? "Insufficient result data; gather more evidence before rollback." : "No rollback recommendation for this result.", rollbackType: type, riskClass: "LOW", approvalRequired: false, automaticExecution: false };
}
async function audit(db: D1, tenantId: string, experimentId: string, actor: string, action: string, payload: unknown) {
  await db.prepare("INSERT INTO growth_audit_log (id, tenant_id, actor, action, subject_type, subject_id, before_json, after_json) VALUES (?, ?, ?, ?, 'experiment', ?, '{}', ?)").bind(crypto.randomUUID(), tenantId, actor || "admin", action, experimentId, json(payload)).run();
  await db.prepare("INSERT INTO growth_experiment_events (id, tenant_id, experiment_id, event_type, actor, reason, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), tenantId, experimentId, action, actor || "admin", "Stage 5 internal planning", json(payload)).run();
}

async function confirmed(db: D1, evaluationId: string, tenantId: string) {
  const evaluation = await getResultEvaluation(db, evaluationId, tenantId) as Evaluation | null;
  if (!evaluation || evaluation.status !== "CONFIRMED") throw new Error("A confirmed Experiment Result is required.");
  const experiment = await getExperiment(db, evaluation.experiment_id, tenantId) as Promise<Experiment | null>;
  if (!experiment) throw new Error("Experiment not found.");
  return { evaluation, experiment };
}

export async function getRollbackRecommendation(db: D1, evaluationId: string, input: Record<string, unknown> = {}, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const { evaluation, experiment } = await confirmed(db, evaluationId, tenantId);
  return { evaluationId, experimentId: experiment.experiment_id, recommendation: recommendation(evaluation, experiment, input), scope: scope(experiment, input) };
}

export async function createRollbackPlan(db: D1, idOrCode: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const evaluationId = clean(input.evaluation_id ?? input.evaluationId, 120); if (!evaluationId) throw new Error("evaluation_id is required.");
  const { evaluation, experiment } = await confirmed(db, evaluationId, tenantId); const requestedExperiment = await getExperiment(db, idOrCode, tenantId) as Promise<Experiment | null>; if (!requestedExperiment || String(evaluation.experiment_id) !== String(requestedExperiment.experiment_id)) throw new Error("Evaluation does not belong to this Experiment."); assertScope(experiment, input);
  const rec = recommendation(evaluation, experiment, input); if (!rec?.recommended) throw new Error("This confirmed result has no rollback recommendation.");
  const existing = await db.prepare("SELECT * FROM growth_experiment_rollback_plans WHERE tenant_id = ? AND evaluation_id = ? LIMIT 1").bind(tenantId, evaluationId).first<Record<string, unknown>>(); if (existing) return existing;
  const s = scope(experiment); const planId = crypto.randomUUID(); const proposalId = clean(parse(experiment.source_json).proposalId, 120) || null;
  const steps = Array.isArray(input.steps) ? input.steps.map((item) => clean(item, 500)).filter(Boolean) : ["影響範囲と変更前設定を確認する。", "人間承認後に別途Rollback実行可否を判断する。"];
  await db.prepare("INSERT INTO growth_experiment_rollback_plans (rollback_plan_id, tenant_id, guild_id, experiment_id, proposal_id, evaluation_id, reason, reversible, rollback_type, steps_json, affected_scope_json, risk_class, approval_required, approval_status, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'PENDING', 'DRAFT')")
    .bind(planId, tenantId, s.guildId, experiment.experiment_id, proposalId, evaluationId, rec.reason, input.reversible === false ? 0 : 1, rec.rollbackType, json(steps), json(s), rec.riskClass).run();
  await audit(db, tenantId, experiment.experiment_id, clean(input.actor, 120), "experiment.rollback_plan.created", { rollbackPlanId: planId, evaluationId, recommendation: rec, execution: "NOT_IMPLEMENTED" });
  return db.prepare("SELECT * FROM growth_experiment_rollback_plans WHERE tenant_id = ? AND rollback_plan_id = ?").bind(tenantId, planId).first();
}

export async function listRollbackPlans(db: D1, experimentId: string, tenantId = GROWTH_ENGINE_TENANT_ID) { const rows = await db.prepare("SELECT * FROM growth_experiment_rollback_plans WHERE tenant_id = ? AND experiment_id = ? ORDER BY datetime(created_at) DESC").bind(tenantId, experimentId).all(); return rows.results || []; }
async function planAction(db: D1, planId: string, input: Record<string, unknown>, tenantId: string, approved: boolean) {
  const plan = await db.prepare("SELECT * FROM growth_experiment_rollback_plans WHERE tenant_id = ? AND rollback_plan_id = ? LIMIT 1").bind(tenantId, planId).first<Record<string, unknown>>(); if (!plan) throw new Error("Rollback Plan not found.");
  if (approved && Number(plan.approval_required) === 1) { await db.prepare("UPDATE growth_experiment_rollback_plans SET approval_status = 'APPROVED', status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND rollback_plan_id = ? AND status = 'DRAFT'").bind(tenantId, planId).run(); }
  else if (!approved) await db.prepare("UPDATE growth_experiment_rollback_plans SET approval_status = 'REJECTED', status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND rollback_plan_id = ? AND status = 'DRAFT'").bind(tenantId, planId).run();
  await audit(db, tenantId, String(plan.experiment_id), clean(input.actor, 120), approved ? "experiment.rollback_plan.approved" : "experiment.rollback_plan.rejected", { rollbackPlanId: planId, execution: "NOT_IMPLEMENTED" });
  return db.prepare("SELECT * FROM growth_experiment_rollback_plans WHERE tenant_id = ? AND rollback_plan_id = ?").bind(tenantId, planId).first();
}
export async function approveRollbackPlan(db: D1, planId: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) { return planAction(db, planId, input, tenantId, true); }
export async function rejectRollbackPlan(db: D1, planId: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) { return planAction(db, planId, input, tenantId, false); }

export async function registerExperimentFeedback(db: D1, evaluationId: string, input: Record<string, unknown> = {}, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const { evaluation, experiment } = await confirmed(db, evaluationId, tenantId); const existing = await db.prepare("SELECT * FROM growth_experiment_feedback WHERE tenant_id = ? AND experiment_id = ? AND evaluation_id = ? LIMIT 1").bind(tenantId, experiment.experiment_id, evaluationId).first<Record<string, unknown>>(); if (existing) return { duplicate: true, feedback: existing }; assertScope(experiment, input);
  const s = scope(experiment); const result = clean(evaluation.candidate_result, 40).toUpperCase(); const trace = parse(experiment.source_json); const sourceId = `experiment-result-${experiment.experiment_id}-${evaluationId}`.slice(0, 120); const base = { experimentId: experiment.experiment_id, hypothesisId: clean(trace.hypothesisId, 120) || null, proposalId: clean(trace.proposalId, 120) || null, result, primaryMetric: evaluation.primary_metric || null, controlValue: evaluation.control_value ?? null, variantValue: evaluation.variant_value ?? null, absoluteDifference: evaluation.absolute_difference ?? null, relativeDifference: evaluation.relative_difference ?? null, sampleSize: evaluation.sample_size ?? null, confidence: evaluation.confidence ?? null, guardrailStatus: evaluation.guardrail_status || "UNKNOWN", measuredAt: evaluation.evaluated_at || null, confirmedAt: evaluation.confirmed_at || null, recency: evaluation.confirmed_at || evaluation.evaluated_at || null, ...s, platform: trace.platform || null, topic: trace.topic || null, hookStyle: trace.hookStyle || null, template: trace.template || null, cta: trace.cta || null, postingTime: trace.postingTime || null };
  const source: EvidenceSource = { sourceId, tenantId, guildId: s.guildId, market: s.market, country: s.country, locale: s.locale, sourceType: "experiment_result", title: `Experiment Result: ${experiment.title || experiment.experiment_id}`, observedAt: String(evaluation.confirmed_at || evaluation.evaluated_at || new Date().toISOString()), provider: "Growth Experiment Manager", metadata: { ...base, learning: result === "INCONCLUSIVE" ? "insufficient_learning" : result === "LOSS" ? "negative_evidence" : result === "NEUTRAL" ? "neutral_evidence" : "positive_evidence" } };
  const existingSource = await getSource(db, tenantId, sourceId); if (!existingSource) await createSource(db, source); const claims: Array<[string, string]> = [["result", `Experiment result was ${result}.`], ["metric", `${String(base.variantValue ?? "n/a")} vs ${String(base.controlValue ?? "n/a")} for ${String(base.primaryMetric || "primary metric")}; relative difference ${String(base.relativeDifference ?? "n/a")}%.`], ["sample", `Sample size was ${String(base.sampleSize ?? "n/a")}; confidence ${String(base.confidence ?? "n/a")}; guardrail status ${String(base.guardrailStatus)}.`]];
  const existingClaims = await listClaimsBySource(db, tenantId, sourceId); for (const [type, statement] of claims) if (!existingClaims.some((claim) => claim.claimType === type)) { const claim: EvidenceClaim = { claimId: `${sourceId}-${type}`.slice(0, 120), sourceId, tenantId, guildId: s.guildId, market: s.market, country: s.country, locale: s.locale, claimType: type, statement, relevanceScore: 0.9, confidence: Number(base.confidence) || null, metadata: base }; await createClaim(db, claim); }
  const feedbackId = crypto.randomUUID(); await db.prepare("INSERT INTO growth_experiment_feedback (feedback_id, tenant_id, experiment_id, evaluation_id, evidence_source_id, result, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(feedbackId, tenantId, experiment.experiment_id, evaluationId, sourceId, result, json(base)).run(); await audit(db, tenantId, experiment.experiment_id, clean(input.actor, 120), "experiment.feedback.registered", { feedbackId, evaluationId, sourceId, result });
  return { duplicate: false, feedbackId, evidenceSourceId: sourceId, claims: await listClaimsBySource(db, tenantId, sourceId), payload: base };
}
export async function listExperimentFeedback(db: D1, experimentId: string, tenantId = GROWTH_ENGINE_TENANT_ID) { const rows = await db.prepare("SELECT * FROM growth_experiment_feedback WHERE tenant_id = ? AND experiment_id = ? ORDER BY datetime(created_at) DESC").bind(tenantId, experimentId).all(); return rows.results || []; }
