import {
  buildEvidenceDecision,
  type EvidenceDecisionContext,
  type EvidenceRecord,
  type EvidenceRiskClass,
  type EvidenceScope,
  type MissingEvidence,
} from "./evidence-layer.ts";

export const EXPECTED_DIRECTIONS = ["INCREASE", "DECREASE", "MAINTAIN"] as const;
export const IMPLEMENTATION_EFFORTS = ["LOW", "MEDIUM", "HIGH"] as const;
export const HYPOTHESIS_STATUSES = ["DRAFT", "ACTIVE", "VALIDATED", "REJECTED", "ARCHIVED"] as const;
export const PROPOSAL_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ARCHIVED"] as const;

export type ExpectedDirection = (typeof EXPECTED_DIRECTIONS)[number];
export type ImplementationEffort = (typeof IMPLEMENTATION_EFFORTS)[number];
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type AuthorizationStatus = EvidenceDecisionContext["authorizationStatus"];

export type GrowthHypothesis = EvidenceScope & {
  id: string;
  characterId?: string | null;
  statement: string;
  targetSegment: string;
  targetMetric: string;
  expectedDirection: ExpectedDirection;
  evidenceSufficiency: EvidenceDecisionContext["sufficiency"]["level"];
  riskClass: EvidenceRiskClass;
  status: HypothesisStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type HypothesisEvidenceLink = {
  id: string;
  hypothesisId: string;
  tenantId: string;
  sourceId: string;
  claimId?: string | null;
  createdAt?: string;
};

export type GrowthProposal = EvidenceScope & {
  id: string;
  hypothesisId: string;
  characterId?: string | null;
  proposedAction: string;
  expectedImpact: string;
  targetMetric: string;
  expectedDirection: ExpectedDirection;
  reversible: boolean;
  implementationEffort: ImplementationEffort;
  evidenceSufficiency: EvidenceDecisionContext["sufficiency"]["level"];
  riskClass: EvidenceRiskClass;
  approvalRequired: boolean;
  approvalStatus: AuthorizationStatus;
  decision: EvidenceDecisionContext["decision"];
  missingEvidence: MissingEvidence[];
  status: ProposalStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateHypothesisInput = Omit<GrowthHypothesis, "evidenceSufficiency" | "status" | "createdAt" | "updatedAt"> & {
  evidenceSufficiency?: GrowthHypothesis["evidenceSufficiency"];
  status?: HypothesisStatus;
};

export type CreateProposalInput = Omit<GrowthProposal, "evidenceSufficiency" | "riskClass" | "approvalRequired" | "decision" | "missingEvidence" | "status" | "createdAt" | "updatedAt"> & {
  riskClass?: EvidenceRiskClass;
  authorizationStatus?: AuthorizationStatus;
  status?: ProposalStatus;
};

type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
    };
  };
};

const HIGH_RISK_ACTIONS = new Set([
  "PRICE", "BILLING", "TRIAL", "NEW_CHARACTER", "NEW_GUILD", "MARKET", "BRAND", "DESTRUCTIVE", "AUTO_PUBLISH", "EXTERNAL_PUBLIC_ACTION",
]);

function clean(value: unknown, max = 2000) { return String(value ?? "").trim().slice(0, max); }
function id(value: unknown, label: string) { const result = clean(value, 160); if (!result) throw new Error(`${label} is required.`); return result; }
function direction(value: unknown): ExpectedDirection {
  const result = clean(value, 20).toUpperCase() as ExpectedDirection;
  if (!EXPECTED_DIRECTIONS.includes(result)) throw new Error("expectedDirection must be INCREASE, DECREASE, or MAINTAIN.");
  return result;
}
function effort(value: unknown): ImplementationEffort {
  const result = clean(value, 20).toUpperCase() as ImplementationEffort;
  if (!IMPLEMENTATION_EFFORTS.includes(result)) throw new Error("implementationEffort must be LOW, MEDIUM, or HIGH.");
  return result;
}
function scope(input: EvidenceScope) {
  return { tenantId: id(input.tenantId, "tenantId"), guildId: input.guildId || null, market: input.market || null, country: input.country || null, locale: input.locale || null };
}
function json(value: unknown, fallback: unknown) { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
function bool(value: unknown) { return Boolean(value === true || value === 1 || value === "1"); }
function riskFor(input: { riskClass?: EvidenceRiskClass; proposedAction?: string; reversible: boolean }): EvidenceRiskClass {
  const action = clean(input.proposedAction, 80).toUpperCase().replace(/\s+/g, "_");
  if (HIGH_RISK_ACTIONS.has(action) || !input.reversible) return input.riskClass === "CRITICAL" || !input.reversible ? "CRITICAL" : "HIGH";
  return input.riskClass || "LOW";
}
function hypothesisFromRow(row: Record<string, unknown>): GrowthHypothesis {
  return { id: String(row.id), tenantId: String(row.tenant_id), guildId: row.guild_id ? String(row.guild_id) : null, characterId: row.character_id ? String(row.character_id) : null, market: row.market ? String(row.market) : null, country: row.country ? String(row.country) : null, locale: row.locale ? String(row.locale) : null, statement: String(row.statement), targetSegment: String(row.target_segment || ""), targetMetric: String(row.target_metric), expectedDirection: direction(row.expected_direction), evidenceSufficiency: String(row.evidence_sufficiency) as GrowthHypothesis["evidenceSufficiency"], riskClass: String(row.risk_class) as EvidenceRiskClass, status: String(row.status) as HypothesisStatus, createdAt: String(row.created_at || ""), updatedAt: String(row.updated_at || "") };
}
function linkFromRow(row: Record<string, unknown>): HypothesisEvidenceLink { return { id: String(row.id), hypothesisId: String(row.hypothesis_id), tenantId: String(row.tenant_id), sourceId: String(row.source_id), claimId: row.claim_id ? String(row.claim_id) : null, createdAt: String(row.created_at || "") }; }
function proposalFromRow(row: Record<string, unknown>): GrowthProposal {
  return { id: String(row.id), hypothesisId: String(row.hypothesis_id), tenantId: String(row.tenant_id), guildId: row.guild_id ? String(row.guild_id) : null, characterId: row.character_id ? String(row.character_id) : null, market: row.market ? String(row.market) : null, country: row.country ? String(row.country) : null, locale: row.locale ? String(row.locale) : null, proposedAction: String(row.proposed_action), expectedImpact: String(row.expected_impact || ""), targetMetric: String(row.target_metric), expectedDirection: direction(row.expected_direction), reversible: bool(row.reversible), implementationEffort: effort(row.implementation_effort), evidenceSufficiency: String(row.evidence_sufficiency) as GrowthProposal["evidenceSufficiency"], riskClass: String(row.risk_class) as EvidenceRiskClass, approvalRequired: bool(row.approval_required), approvalStatus: String(row.approval_status) as AuthorizationStatus, decision: String(row.decision) as GrowthProposal["decision"], missingEvidence: json(row.missing_evidence_json, []) as MissingEvidence[], status: String(row.status) as ProposalStatus, createdAt: String(row.created_at || ""), updatedAt: String(row.updated_at || "") };
}

export function evaluateProposal(input: CreateProposalInput, evidence: EvidenceRecord[], now = new Date()) {
  const riskClass = riskFor(input);
  const authorizationStatus = input.authorizationStatus || (riskClass === "LOW" ? "NOT_REQUIRED" : "PENDING");
  const decision = buildEvidenceDecision(evidence, scope(input), riskClass, authorizationStatus, now);
  if (!input.reversible && decision.decision === "GO") return { ...decision, decision: "REQUIRE_APPROVAL" as const, canProceed: false, authorizationRequired: true };
  return decision;
}

export class GrowthHypothesisProposalRepository {
  private readonly db: D1;
  constructor(db: D1) { this.db = db; }

  async createHypothesis(input: CreateHypothesisInput) {
    const s = scope(input); const statement = id(input.statement, "statement"); const targetMetric = id(input.targetMetric, "targetMetric"); const hypothesisId = id(input.id, "id");
    await this.db.prepare(`INSERT INTO growth_hypotheses (id, tenant_id, guild_id, character_id, market, country, locale, statement, target_segment, target_metric, expected_direction, evidence_sufficiency, risk_class, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(hypothesisId, s.tenantId, s.guildId, input.characterId || null, s.market, s.country, s.locale, statement, clean(input.targetSegment, 240), targetMetric, direction(input.expectedDirection), input.evidenceSufficiency || "INSUFFICIENT", input.riskClass || "HIGH", input.status || "DRAFT").run();
    return this.getHypothesis(s.tenantId, hypothesisId);
  }
  async getHypothesis(tenantId: string, hypothesisId: string) { const row = await this.db.prepare("SELECT * FROM growth_hypotheses WHERE tenant_id = ? AND id = ? LIMIT 1").bind(id(tenantId, "tenantId"), id(hypothesisId, "hypothesisId")).first<Record<string, unknown>>(); return row ? hypothesisFromRow(row) : null; }
  async listHypotheses(scopeInput: EvidenceScope, limit = 100) { const s = scope(scopeInput); const rows = await this.db.prepare("SELECT * FROM growth_hypotheses WHERE tenant_id = ? AND (? = '' OR guild_id = ?) AND (? = '' OR market = ?) AND (? = '' OR country = ?) AND (? = '' OR locale = ?) ORDER BY datetime(created_at) DESC LIMIT ?").bind(s.tenantId, s.guildId || "", s.guildId || "", s.market || "", s.market || "", s.country || "", s.country || "", s.locale || "", s.locale || "", Math.min(Math.max(limit, 1), 100)).all<Record<string, unknown>>(); return (rows.results || []).map(hypothesisFromRow); }
  async updateHypothesis(tenantId: string, hypothesisId: string, patch: Partial<Pick<GrowthHypothesis, "statement" | "targetSegment" | "targetMetric" | "expectedDirection" | "status" | "evidenceSufficiency">>) { const current = await this.getHypothesis(tenantId, hypothesisId); if (!current) return null; await this.db.prepare("UPDATE growth_hypotheses SET statement = ?, target_segment = ?, target_metric = ?, expected_direction = ?, status = ?, evidence_sufficiency = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?").bind(patch.statement === undefined ? current.statement : clean(patch.statement), patch.targetSegment === undefined ? current.targetSegment : clean(patch.targetSegment, 240), patch.targetMetric === undefined ? current.targetMetric : clean(patch.targetMetric), patch.expectedDirection === undefined ? current.expectedDirection : direction(patch.expectedDirection), patch.status || current.status, patch.evidenceSufficiency || current.evidenceSufficiency, tenantId, hypothesisId).run(); return this.getHypothesis(tenantId, hypothesisId); }
  async attachEvidence(input: HypothesisEvidenceLink) { const hypothesis = await this.getHypothesis(input.tenantId, input.hypothesisId); if (!hypothesis) throw new Error("Hypothesis not found for tenant."); const source = await this.db.prepare("SELECT source_id FROM evidence_sources WHERE tenant_id = ? AND source_id = ? LIMIT 1").bind(input.tenantId, input.sourceId).first(); if (!source) throw new Error("Evidence source not found for tenant."); if (input.claimId) { const claim = await this.db.prepare("SELECT claim_id FROM evidence_claims WHERE tenant_id = ? AND source_id = ? AND claim_id = ? LIMIT 1").bind(input.tenantId, input.sourceId, input.claimId).first(); if (!claim) throw new Error("Evidence claim not found for tenant."); } await this.db.prepare("INSERT INTO growth_hypothesis_evidence (id, hypothesis_id, tenant_id, source_id, claim_id) VALUES (?, ?, ?, ?, ?)").bind(id(input.id, "id"), input.hypothesisId, input.tenantId, input.sourceId, input.claimId || null).run(); return this.listHypothesisEvidence(input.tenantId, input.hypothesisId); }
  async listHypothesisEvidence(tenantId: string, hypothesisId: string) { const rows = await this.db.prepare("SELECT * FROM growth_hypothesis_evidence WHERE tenant_id = ? AND hypothesis_id = ? ORDER BY datetime(created_at) ASC").bind(tenantId, hypothesisId).all<Record<string, unknown>>(); return (rows.results || []).map(linkFromRow); }
  async createProposal(input: CreateProposalInput, evidence: EvidenceRecord[], now = new Date()) { const s = scope(input); const hypothesis = await this.getHypothesis(s.tenantId, input.hypothesisId); if (!hypothesis) throw new Error("Hypothesis is required and must belong to tenant."); const decision = evaluateProposal(input, evidence, now); const proposalId = id(input.id, "id"); const riskClass = decision.riskClass; const approvalStatus = input.authorizationStatus || (decision.authorizationRequired ? "PENDING" : "NOT_REQUIRED"); await this.db.prepare(`INSERT INTO growth_proposals (id, hypothesis_id, tenant_id, guild_id, character_id, market, country, locale, proposed_action, expected_impact, target_metric, expected_direction, reversible, implementation_effort, evidence_sufficiency, risk_class, approval_required, approval_status, decision, missing_evidence_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(proposalId, input.hypothesisId, s.tenantId, s.guildId, input.characterId || hypothesis.characterId || null, s.market, s.country, s.locale, id(input.proposedAction, "proposedAction"), clean(input.expectedImpact, 2000), id(input.targetMetric, "targetMetric"), direction(input.expectedDirection), input.reversible ? 1 : 0, effort(input.implementationEffort), decision.sufficiency.level, riskClass, decision.authorizationRequired ? 1 : 0, approvalStatus, decision.decision, JSON.stringify(decision.missingEvidence), input.status || "DRAFT").run(); return this.getProposal(s.tenantId, proposalId); }
  async getProposal(tenantId: string, proposalId: string) { const row = await this.db.prepare("SELECT * FROM growth_proposals WHERE tenant_id = ? AND id = ? LIMIT 1").bind(id(tenantId, "tenantId"), id(proposalId, "proposalId")).first<Record<string, unknown>>(); return row ? proposalFromRow(row) : null; }
  async listProposals(scopeInput: EvidenceScope, limit = 100) { const s = scope(scopeInput); const rows = await this.db.prepare("SELECT * FROM growth_proposals WHERE tenant_id = ? AND (? = '' OR guild_id = ?) AND (? = '' OR market = ?) AND (? = '' OR country = ?) AND (? = '' OR locale = ?) ORDER BY datetime(created_at) DESC LIMIT ?").bind(s.tenantId, s.guildId || "", s.guildId || "", s.market || "", s.market || "", s.country || "", s.country || "", s.locale || "", s.locale || "", Math.min(Math.max(limit, 1), 100)).all<Record<string, unknown>>(); return (rows.results || []).map(proposalFromRow); }
  async updateProposal(tenantId: string, proposalId: string, patch: Partial<Pick<GrowthProposal, "status" | "approvalStatus" | "decision" | "evidenceSufficiency" | "missingEvidence">>) { const current = await this.getProposal(tenantId, proposalId); if (!current) return null; await this.db.prepare("UPDATE growth_proposals SET status = ?, approval_status = ?, decision = ?, evidence_sufficiency = ?, missing_evidence_json = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?").bind(patch.status || current.status, patch.approvalStatus || current.approvalStatus, patch.decision || current.decision, patch.evidenceSufficiency || current.evidenceSufficiency, JSON.stringify(patch.missingEvidence || current.missingEvidence), tenantId, proposalId).run(); return this.getProposal(tenantId, proposalId); }
}
