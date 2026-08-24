import { buildEvidenceDecision, findEvidence, type EvidenceScope } from "./evidence-layer.ts";
import { GrowthHypothesisProposalRepository, type GrowthProposal } from "./growth-hypothesis-proposal.ts";
import { createExperiment } from "./growth-experiment-manager.ts";
import { evaluateExperimentDraftEligibility } from "./growth-experiment-draft-policy.ts";

type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
    };
  };
};

type RequestedScope = Partial<Omit<EvidenceScope, "tenantId">> & { tenantId: string };

export type ExperimentDraftResult =
  | { created: true; experiment: Record<string, unknown>; decision: ReturnType<typeof buildEvidenceDecision>; evidenceIds: string[] }
  | { created: false; existingExperimentId: string; reason: string };

function scopeValue(value: unknown) {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function assertRequestedScope(requested: RequestedScope | undefined, proposal: GrowthProposal) {
  if (!requested) return;
  if (requested.tenantId !== proposal.tenantId) throw new Error("Tenant mismatch.");
  for (const key of ["guildId", "market", "country", "locale"] as const) {
    if (requested[key] !== undefined && scopeValue(requested[key]) !== scopeValue(proposal[key])) throw new Error(`${key} mismatch.`);
  }
}

function targetType(action: string) {
  const normalized = action.trim().toUpperCase().replace(/\s+/g, "_");
  return ["PRICE", "BILLING", "TRIAL", "NEW_CHARACTER", "NEW_GUILD", "MARKET", "BRAND", "DESTRUCTIVE", "AUTO_PUBLISH", "EXTERNAL_PUBLIC_ACTION"].includes(normalized)
    ? normalized === "BILLING" ? "MEMBERSHIP" : normalized === "TRIAL" ? "FREE_TRIAL" : normalized
    : "CONTENT";
}

function confidenceFor(level: string) {
  return level === "STRONG" ? 85 : level === "MODERATE" ? 65 : level === "WEAK" ? 40 : 0;
}

async function linkedEvidence(db: D1, repo: GrowthHypothesisProposalRepository, proposal: GrowthProposal) {
  const links = await repo.listHypothesisEvidence(proposal.tenantId, proposal.hypothesisId);
  const applicable = await findEvidence(db, {
    tenantId: proposal.tenantId,
    guildId: proposal.guildId,
    market: proposal.market,
    country: proposal.country,
    locale: proposal.locale,
  });
  const sourceIds = new Set(links.map((link) => link.sourceId));
  return applicable.filter((record) => sourceIds.has(record.source.sourceId));
}

async function existingDraft(db: D1, tenantId: string, proposalId: string) {
  const row = await db.prepare(
    "SELECT experiment_id FROM growth_experiments WHERE tenant_id = ? AND status NOT IN ('REJECTED','CANCELLED','ARCHIVED') AND source_json LIKE ? ORDER BY datetime(created_at) DESC LIMIT 1",
  ).bind(tenantId, `%\"proposalId\":\"${proposalId.replace(/[%_]/g, "") }\"%`).first<{ experiment_id: string }>();
  return row?.experiment_id || null;
}

export async function getExperimentDraftStatus(db: D1, proposalId: string, tenantId: string) {
  const repo = new GrowthHypothesisProposalRepository(db);
  const proposal = await repo.getProposal(tenantId, proposalId);
  if (!proposal) return { eligible: false, reason: "Proposal not found for tenant." };
  const hypothesis = await repo.getHypothesis(tenantId, proposal.hypothesisId);
  if (!hypothesis) return { eligible: false, reason: "Related hypothesis not found for tenant." };
  const evidence = await linkedEvidence(db, repo, proposal);
  const eligibility = evaluateExperimentDraftEligibility({ proposal, hypothesis, evidence });
  if (!eligibility.ok) return { eligible: false, reason: eligibility.reason, decision: eligibility.decision?.decision };
  const existingId = await existingDraft(db, tenantId, proposal.id);
  if (existingId) return { eligible: false, reason: "An active Experiment Draft already exists for this Proposal.", existingExperimentId: existingId, decision: eligibility.decision.decision };
  return { eligible: true, reason: "Draft作成可能です。", decision: eligibility.decision.decision };
}

export async function createExperimentDraftFromProposal(db: D1, proposalId: string, requested?: RequestedScope, actor = "admin"): Promise<ExperimentDraftResult> {
  const repo = new GrowthHypothesisProposalRepository(db);
  const tenantId = requested?.tenantId || "";
  if (!tenantId) throw new Error("tenantId is required.");
  const proposal = await repo.getProposal(tenantId, proposalId);
  if (!proposal) throw new Error("Proposal not found for tenant.");
  const hypothesis = await repo.getHypothesis(tenantId, proposal.hypothesisId);
  if (!hypothesis) throw new Error("Related hypothesis not found for tenant.");
  assertRequestedScope(requested, proposal);
  for (const key of ["guildId", "market", "country", "locale"] as const) {
    if (scopeValue(hypothesis[key]) !== scopeValue(proposal[key])) throw new Error(`${key} mismatch between hypothesis and proposal.`);
  }
  const evidence = await linkedEvidence(db, repo, proposal);
  const eligibility = evaluateExperimentDraftEligibility({ proposal, hypothesis, evidence });
  if (!eligibility.ok) throw new Error(eligibility.reason);
  const decision = eligibility.decision;

  const existingId = await existingDraft(db, tenantId, proposal.id);
  if (existingId) return { created: false, existingExperimentId: existingId, reason: "An active Experiment Draft already exists for this Proposal." };

  const evidenceIds = evidence.map((record) => record.source.sourceId);
  const evidenceSummary = evidence.map((record) => ({ sourceId: record.source.sourceId, sourceType: record.source.sourceType, title: record.source.title, claimIds: record.claims.map((claim) => claim.claimId) }));
  const source = {
    origin: "growth_intelligence",
    phase: "phase_3_stage_3",
    hypothesisId: hypothesis.id,
    proposalId: proposal.id,
    evidenceIds,
    evidenceSummary,
    targetSegment: hypothesis.targetSegment,
    market: proposal.market,
    country: proposal.country,
    locale: proposal.locale,
    riskClass: decision.riskClass,
    reversible: proposal.reversible,
    rollbackPlan: "変更前の設定へ戻す。",
    implementationEffort: proposal.implementationEffort,
  };
  const experiment = await (async () => {
    const created = await createExperiment(db, {
      actor,
      title: `Proposal Draft: ${proposal.proposedAction.slice(0, 120)}`,
      characterId: proposal.characterId,
      hypothesis: hypothesis.statement,
      description: proposal.expectedImpact,
      changeSummary: proposal.proposedAction,
      targetType: targetType(proposal.proposedAction),
      targetId: proposal.id,
      primaryMetric: proposal.targetMetric,
      primaryKpiDirection: proposal.expectedDirection.toLowerCase(),
      status: "DRAFT",
      approvalRequired: decision.authorizationRequired,
      impactScore: confidenceFor(decision.sufficiency.level),
      confidenceScore: confidenceFor(decision.sufficiency.level),
      easeScore: proposal.implementationEffort === "LOW" ? 80 : proposal.implementationEffort === "MEDIUM" ? 55 : 30,
      source,
    }, tenantId);
    return created as Record<string, unknown>;
  })();
  return { created: true, experiment, decision, evidenceIds };
}

export function draftTraceability(sourceJson: unknown) {
  try {
    const source = typeof sourceJson === "string" ? JSON.parse(sourceJson) : sourceJson;
    return source && typeof source === "object" && (source as Record<string, unknown>).origin === "growth_intelligence" ? source as Record<string, unknown> : null;
  } catch { return null; }
}
