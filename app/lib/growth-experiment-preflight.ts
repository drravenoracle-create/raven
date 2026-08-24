import { buildEvidenceDecision, findEvidence, type EvidenceScope } from "./evidence-layer.ts";
import { GrowthHypothesisProposalRepository, evaluateProposal } from "./growth-hypothesis-proposal.ts";
import { evaluateAutonomousAction, GROWTH_ENGINE_TENANT_ID } from "./growth-engine.ts";
import { evaluatePreflightPolicy, type PreflightDecision } from "./growth-experiment-preflight-policy.ts";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { first<T = unknown>(): Promise<T | null>; all<T = unknown>(): Promise<{ results?: T[] }>; run(): Promise<unknown> } } };
type Experiment = Record<string, unknown> & { experiment_id: string; tenant_id: string; status: string };
type RequestedScope = { tenantId: string; guildId?: string | null; market?: string | null; country?: string | null; locale?: string | null; characterId?: string | null };

export type ExperimentPreflightResult = {
  experimentId: string;
  allowed: boolean;
  decision: PreflightDecision;
  approvalStatus: string;
  evidenceDecision: Record<string, unknown>;
  riskClass: string;
  guardrails: Array<{ type: string; result: "PASS" | "FAIL"; reason: string }>;
  blockers: string[];
  warnings: string[];
  evaluatedAt: string;
};

function parseJson(value: unknown): Record<string, unknown> {
  try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}
function text(value: unknown) { return String(value ?? "").trim(); }
function scopeValue(value: unknown) { return value === undefined || value === null || value === "" ? null : String(value); }
function scopeFrom(experiment: Experiment, source: Record<string, unknown>): EvidenceScope {
  return { tenantId: experiment.tenant_id, guildId: scopeValue(source.guildId ?? source.guild_id), market: scopeValue(source.market), country: scopeValue(source.country), locale: scopeValue(source.locale) };
}
function requestedMatches(requested: RequestedScope | undefined, source: Record<string, unknown>, experiment: Experiment) {
  if (!requested) return true;
  if (requested.tenantId !== experiment.tenant_id) return false;
  const checks: Array<[keyof RequestedScope, string]> = [["guildId", "guildId"], ["market", "market"], ["country", "country"], ["locale", "locale"], ["characterId", "characterId"]];
  return checks.every(([requestedKey, sourceKey]) => requested[requestedKey] === undefined || scopeValue(requested[requestedKey]) === scopeValue(source[sourceKey] ?? source[sourceKey.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)] ?? (sourceKey === "characterId" ? experiment.character_id : null)));
}
function evidenceIds(source: Record<string, unknown>) { return Array.isArray(source.evidenceIds) ? source.evidenceIds.map(String) : []; }

async function getExperiment(db: D1, id: string, tenantId: string) {
  return db.prepare("SELECT * FROM growth_experiments WHERE tenant_id = ? AND (experiment_id = ? OR experiment_code = ?) LIMIT 1").bind(tenantId, id, id).first<Experiment>();
}

async function linkedEvidence(db: D1, repo: GrowthHypothesisProposalRepository, experiment: Experiment, source: Record<string, unknown>, proposalId?: string) {
  const target = scopeFrom(experiment, source);
  const records = await findEvidence(db, target);
  const ids = new Set(evidenceIds(source));
  if (proposalId) {
    const proposal = await repo.getProposal(experiment.tenant_id, proposalId);
    if (proposal) {
      const links = await repo.listHypothesisEvidence(experiment.tenant_id, proposal.hypothesisId);
      const linked = new Set(links.map((item) => item.sourceId));
      return records.filter((record) => linked.has(record.source.sourceId) && (!ids.size || ids.has(record.source.sourceId)));
    }
  }
  return records.filter((record) => ids.has(record.source.sourceId));
}

async function persistResult(db: D1, result: ExperimentPreflightResult, actor: string) {
  const guardrailResult = result.allowed ? "PASS" : "FAIL";
  await db.prepare("INSERT INTO growth_guardrail_results (id, tenant_id, subject_type, subject_id, result, reasons_json, policy_snapshot_json) VALUES (?, ?, 'experiment', ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), result.evidenceDecision.tenantId || GROWTH_ENGINE_TENANT_ID, result.experimentId, guardrailResult, JSON.stringify(result.blockers), JSON.stringify({ guardrails: result.guardrails, decision: result.decision, evaluatedAt: result.evaluatedAt })).run();
  await db.prepare("INSERT INTO growth_audit_log (id, tenant_id, actor, action, subject_type, subject_id, before_json, after_json) VALUES (?, ?, ?, 'experiment.preflight', 'experiment', ?, '{}', ?)")
    .bind(crypto.randomUUID(), result.evidenceDecision.tenantId || GROWTH_ENGINE_TENANT_ID, actor || "admin", result.experimentId, JSON.stringify(result)).run();
}

export async function runExperimentPreflight(db: D1, idOrCode: string, requested?: RequestedScope, actor = "admin", requireStartState = false): Promise<ExperimentPreflightResult> {
  const tenantId = requested?.tenantId || GROWTH_ENGINE_TENANT_ID;
  const experiment = await getExperiment(db, idOrCode, tenantId);
  if (!experiment) throw new Error("Experiment not found.");
  const source = parseJson(experiment.source_json);
  const proposalId = text(source.proposalId) || undefined;
  const repo = new GrowthHypothesisProposalRepository(db);
  const evidence = await linkedEvidence(db, repo, experiment, source, proposalId);
  const target = scopeFrom(experiment, source);
  const proposal = proposalId ? await repo.getProposal(tenantId, proposalId) : null;
  const riskClass = text(source.riskClass) || (Number(experiment.approval_required) ? "HIGH" : "LOW");
  const approvalStatus = proposal?.approvalStatus || (Number(experiment.approval_required) ? (text(experiment.approved_by) ? "APPROVED" : "PENDING") : "NOT_REQUIRED");
  const evidenceDecision = proposal ? evaluateProposal({ ...proposal, authorizationStatus: approvalStatus as "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" }, evidence) : buildEvidenceDecision(evidence, target, riskClass, approvalStatus as "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED");
  const killSwitch = await db.prepare("SELECT enabled FROM growth_kill_switches WHERE tenant_id = ? AND scope_type = 'tenant' AND scope_id = '*' LIMIT 1").bind(tenantId).first<{ enabled: number }>();
  const approved = approvalStatus === "APPROVED" || (approvalStatus === "NOT_REQUIRED" && !Number(experiment.approval_required));
  const runtime = evaluateAutonomousAction({ riskLevel: riskClass, emergencyStopped: Boolean(killSwitch?.enabled), externalAction: false });
  const guardrails = [
    { type: "scope", result: requestedMatches(requested, source, experiment) ? "PASS" as const : "FAIL" as const, reason: requestedMatches(requested, source, experiment) ? "Scope matches." : "Tenant, guild, market, country, locale, or character mismatch." },
    { type: "approval", result: approved ? "PASS" as const : "FAIL" as const, reason: approved ? "Human approval boundary satisfied." : "Human Approval is required." },
    { type: "evidence", result: evidenceDecision.decision === "GO" ? "PASS" as const : "FAIL" as const, reason: `Evidence decision: ${evidenceDecision.decision}.` },
    { type: "kill_switch", result: killSwitch?.enabled ? "FAIL" as const : "PASS" as const, reason: killSwitch?.enabled ? "Kill switch is enabled." : "Kill switch is OFF." },
    { type: "runtime_safety", result: runtime.result === "deny" || (runtime.requiresApproval && !approved) ? "FAIL" as const : "PASS" as const, reason: runtime.reason },
    { type: "rollback", result: source.reversible !== false || Boolean(source.rollbackPlan) ? "PASS" as const : "FAIL" as const, reason: source.reversible !== false || source.rollbackPlan ? "Rollback condition satisfied." : "Rollback plan is required." },
  ];
  const policy = evaluatePreflightPolicy({ status: experiment.status, approvalRequired: Boolean(Number(experiment.approval_required)), approved, evidenceDecision: evidenceDecision.decision, evidenceSufficiency: evidenceDecision.sufficiency.level, scopeMatch: guardrails[0].result === "PASS", characterMatch: guardrails[0].result === "PASS", killSwitchEnabled: Boolean(killSwitch?.enabled), guardrailEvaluated: true, guardrailPassed: guardrails.every((item) => item.result === "PASS"), reversible: source.reversible !== false, rollbackPlan: Boolean(source.rollbackPlan), requireStartState });
  const evaluatedAt = new Date().toISOString();
  const result: ExperimentPreflightResult = { experimentId: experiment.experiment_id, allowed: policy.allowed, decision: policy.decision, approvalStatus, evidenceDecision: { ...evidenceDecision, tenantId }, riskClass, guardrails, blockers: policy.blockers, warnings: policy.warnings, evaluatedAt };
  await persistResult(db, result, actor);
  return result;
}
