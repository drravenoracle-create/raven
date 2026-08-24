import { getExperiment } from "./growth-experiment-manager.ts";
import { GrowthProposalRepository } from "./growth-proposal.ts";
import { getTenantConfig } from "./tenant-config-resolver.ts";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }>; first<T = unknown>(): Promise<T | null>; run(): Promise<unknown> } } };
type Row = Record<string, unknown>;

export const MEMORY_RESULTS = ["success", "partial_success", "neutral", "failure", "inconclusive"] as const;
export type MemoryResult = (typeof MEMORY_RESULTS)[number];

export type GrowthMemoryItem = {
  id: string; tenantId: string; title: string; content: string; source: string; status: string;
  proposalId?: string | null; experimentId?: string | null; hypothesisId?: string | null;
  actionType?: string | null; actionSignature?: string | null; resultStatus?: string | null; successLevel: MemoryResult;
  predictedOutcome?: string | null; predictedValue?: number | null; actualValue?: number | null;
  predictionError?: number | null; absoluteError?: number | null; relativeError?: number | null;
  directionPredicted?: string | null; directionActual?: string | null; directionCorrect?: boolean | null;
  confidenceAtProposal?: number | null; confidenceAfterResult?: number | null;
  market?: string | null; country?: string | null; locale?: string | null;
  reusable: boolean; suppressed: boolean; suppressionReason?: string | null; supersededBy?: string | null;
  reusedFrom?: string | null; reusedAt?: string | null; reuseCount: number; createdAt?: string; updatedAt?: string;
};

function clean(value: unknown, max = 2000) { return String(value ?? "").trim().slice(0, max); }
function num(value: unknown) { if (value === null || value === undefined || value === "") return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function tenantId(value: string) { const id = clean(value, 120); if (!id || !getTenantConfig(id)) throw new Error(`Unknown tenant: ${id || "missing"}`); return id; }
function direction(value: unknown) { const d = clean(value, 40).toLowerCase(); return d === "increase" || d === "decrease" || d === "neutral" ? d : null; }
function result(value: unknown): MemoryResult { const s = clean(value, 40).toUpperCase(); return s === "WIN" ? "success" : s === "LOSS" ? "failure" : s === "NEUTRAL" ? "neutral" : "inconclusive"; }
function signature(experiment: Row, market?: unknown, locale?: unknown) {
  return [experiment.target_type, experiment.primary_kpi || experiment.primary_metric, market, locale].map((v) => clean(v, 120).toLowerCase().replace(/\s+/g, " ")).join("|");
}
function mapRow(row: Row): GrowthMemoryItem {
  return {
    id: String(row.id), tenantId: String(row.tenant_id), title: String(row.title || ""), content: String(row.content || ""), source: String(row.source || ""), status: String(row.status || "active"),
    proposalId: (row.proposal_id as string) || null, experimentId: (row.experiment_id as string) || null, hypothesisId: (row.hypothesis_id as string) || null,
    actionType: (row.action_type as string) || null, actionSignature: (row.action_signature as string) || null, resultStatus: (row.result_status as string) || null, successLevel: (row.success_level as MemoryResult) || "inconclusive",
    predictedOutcome: (row.predicted_outcome as string) || null, predictedValue: num(row.predicted_value), actualValue: num(row.actual_value), predictionError: num(row.prediction_error), absoluteError: num(row.absolute_error), relativeError: num(row.relative_error),
    directionPredicted: (row.direction_predicted as string) || null, directionActual: (row.direction_actual as string) || null, directionCorrect: row.direction_correct === null || row.direction_correct === undefined ? null : Boolean(Number(row.direction_correct)),
    confidenceAtProposal: num(row.confidence_at_proposal), confidenceAfterResult: num(row.confidence_after_result), market: (row.market as string) || null, country: (row.country as string) || null, locale: (row.locale as string) || null,
    reusable: Boolean(Number(row.reusable || 0)), suppressed: Boolean(Number(row.suppressed || 0)), suppressionReason: (row.suppression_reason as string) || null, supersededBy: (row.superseded_by as string) || null, reusedFrom: (row.reused_from as string) || null, reusedAt: (row.reused_at as string) || null, reuseCount: Number(row.reuse_count || 0), createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  };
}
async function audit(db: D1, tenant: string, actor: string, action: string, id: string, after: unknown, reason = "") {
  await db.prepare("INSERT INTO growth_audit_log (id, tenant_id, actor, action, subject_type, subject_id, before_json, after_json) VALUES (?, ?, ?, ?, 'growth_memory', ?, ?, ?)").bind(crypto.randomUUID(), tenant, clean(actor, 160) || "admin", action, id, "{}", JSON.stringify({ ...(after as Row || {}), reason })).run();
}

export class GrowthMemoryRepository {
  private readonly db: D1;
  constructor(db: D1) { this.db = db; }
  async get(tenant: string, id: string) { const t = tenantId(tenant); const row = await this.db.prepare("SELECT * FROM growth_knowledge_items WHERE tenant_id = ? AND id = ? LIMIT 1").bind(t, clean(id, 160)).first<Row>(); return row ? mapRow(row) : undefined; }
  async list(tenant: string, options: { limit?: number; actionSignature?: string; resultStatus?: string; market?: string; locale?: string } = {}) {
    const t = tenantId(tenant); const limit = Math.min(Math.max(Number(options.limit || 50), 1), 100); const sig = clean(options.actionSignature, 300); const status = clean(options.resultStatus, 40); const market = clean(options.market, 80); const locale = clean(options.locale, 40);
    const rows = await this.db.prepare("SELECT * FROM growth_knowledge_items WHERE tenant_id = ? AND (? = '' OR action_signature = ?) AND (? = '' OR result_status = ?) AND (? = '' OR market = ?) AND (? = '' OR locale = ?) ORDER BY datetime(created_at) DESC LIMIT ?").bind(t, sig, sig, status, status, market, market, locale, locale, limit).all<Row>(); return (rows.results || []).map(mapRow);
  }
  async findSimilar(tenant: string, actionSignature: string, limit = 20) { return this.list(tenant, { actionSignature, limit }); }
  async createFromExperiment(tenant: string, experimentId: string, actor = "admin") {
    const t = tenantId(tenant); const existing = await this.db.prepare("SELECT * FROM growth_knowledge_items WHERE tenant_id = ? AND experiment_id = ? LIMIT 1").bind(t, clean(experimentId, 160)).first<Row>(); if (existing) return { created: false, memory: mapRow(existing) };
    const experiment = await getExperiment(this.db, experimentId, t); if (!experiment) throw new Error("Experiment not found.");
    const resultStatus = clean(experiment.result_status, 40).toUpperCase(); if (!["WIN", "LOSS", "NEUTRAL", "INCONCLUSIVE"].includes(resultStatus)) throw new Error("Experiment has no measurable result.");
    const proposalId = clean(experiment.proposal_id, 160) || null; const proposal = proposalId ? await new GrowthProposalRepository(this.db).get(t, proposalId) : undefined;
    const predicted = num(experiment.target_value) ?? num(experiment.estimated_revenue_impact); const actual = num(experiment.measured_value); const error = predicted !== null && actual !== null ? actual - predicted : null; const abs = error === null ? null : Math.abs(error); const relative = abs !== null && predicted !== null && predicted !== 0 ? abs / Math.abs(predicted) : null;
    const predictedDirection = direction(experiment.primary_kpi_direction); const baseline = num(experiment.baseline_value); const actualDirection = baseline !== null && actual !== null ? direction(actual > baseline ? "increase" : actual < baseline ? "decrease" : "neutral") : null; const correct = predictedDirection && actualDirection ? (predictedDirection === actualDirection ? 1 : 0) : null;
    const sig = signature(experiment, proposal?.market || experiment.market, proposal?.locale || experiment.locale); const id = crypto.randomUUID(); const level = result(resultStatus); const title = clean(proposal?.title || experiment.title || experiment.hypothesis, 500); const content = clean(`${experiment.result_summary || experiment.learning || "Experiment result recorded."} ${experiment.next_action || ""}`, 4000);
    await this.db.prepare(`INSERT INTO growth_knowledge_items (id, tenant_id, item_type, title, content, source, status, proposal_id, experiment_id, hypothesis_id, action_type, action_signature, result_status, success_level, predicted_value, actual_value, prediction_error, absolute_error, relative_error, direction_predicted, direction_actual, direction_correct, confidence_at_proposal, market, country, locale, reusable, suppressed, updated_at) VALUES (?, ?, 'experiment_learning', ?, ?, 'experiment_result', 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP)`).bind(id, t, title, content, proposalId, clean(experiment.experiment_id, 160), clean(experiment.hypothesis_id, 160) || null, clean(experiment.target_type, 80) || null, sig, resultStatus, level, predicted, actual, error, abs, relative, predictedDirection, actualDirection, correct, proposal?.confidence ?? num(experiment.confidence_score), proposal?.market || experiment.market || null, proposal?.country || experiment.country || null, proposal?.locale || experiment.locale || null).run();
    const memory = await this.get(t, id); if (!memory) throw new Error("Growth memory was not persisted."); await audit(this.db, t, actor, "growth_memory_created", id, memory); return { created: true, memory };
  }
  async recordReuse(tenant: string, id: string, actor = "admin", reusedFrom?: string) { const t = tenantId(tenant); const current = await this.get(t, id); if (!current) throw new Error("Growth memory not found."); await this.db.prepare("UPDATE growth_knowledge_items SET reuse_count = reuse_count + 1, reused_from = ?, reused_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?").bind(reusedFrom || null, t, id).run(); await this.db.prepare("INSERT INTO growth_memory_relations (relation_id, tenant_id, source_knowledge_id, target_knowledge_id, relation_type, reason) VALUES (?, ?, ?, ?, 'reused', ?)").bind(crypto.randomUUID(), t, id, reusedFrom || null, "manual reuse").run(); const updated = await this.get(t, id); await audit(this.db, t, actor, "growth_memory_reused", id, updated); return updated; }
  async markSuperseded(tenant: string, id: string, supersededBy: string, actor = "admin", reason = "") { const t = tenantId(tenant); const current = await this.get(t, id); if (!current) throw new Error("Growth memory not found."); await this.db.prepare("UPDATE growth_knowledge_items SET superseded_by = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?").bind(clean(supersededBy, 160), t, id).run(); await this.db.prepare("INSERT INTO growth_memory_relations (relation_id, tenant_id, source_knowledge_id, target_knowledge_id, relation_type, reason) VALUES (?, ?, ?, ?, 'superseded', ?)").bind(crypto.randomUUID(), t, id, clean(supersededBy, 160), reason).run(); const updated = await this.get(t, id); await audit(this.db, t, actor, "growth_memory_superseded", id, updated, reason); return updated; }
  async suppressionCandidate(tenant: string, actionSignature: string) { const similar = await this.findSimilar(tenant, actionSignature, 100); const failures = similar.filter((item) => item.successLevel === "failure"); return { candidate: failures.length > 0, reason: failures.length ? "prior_failure" : null, priorFailures: failures.length, memories: similar }; }
  async createSnapshot(tenant: string, metrics: unknown, actor = "admin") { const t = tenantId(tenant); const id = crypto.randomUUID(); await this.db.prepare("INSERT INTO growth_precision_snapshots (snapshot_id, tenant_id, metrics_json) VALUES (?, ?, ?)").bind(id, t, JSON.stringify(metrics || {})).run(); await audit(this.db, t, actor, "precision_snapshot_created", id, metrics); return id; }
}
