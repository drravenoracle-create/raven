import {
  EvidenceAssessmentService,
  type DecisionRiskClass,
  type EvidenceDecisionContext,
  type EvidenceAssessment,
} from "./growth-evidence-assessment.ts";
import type { EvidenceClaim, EvidenceSource } from "./growth-evidence.ts";
import type { GrowthHypothesis } from "./growth-hypothesis.ts";
import { getTenantConfig } from "./tenant-config-resolver.ts";

export const PROPOSAL_STATUSES = ["draft", "review_required", "approved", "rejected", "deferred"] as const;
export type GrowthProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_REVIEW_ACTIONS = ["approve", "reject", "defer"] as const;
export type ProposalReviewAction = (typeof PROPOSAL_REVIEW_ACTIONS)[number];

export type GrowthProposal = {
  proposalId: string;
  tenantId: string;
  hypothesisId: string;
  proposalType: string;
  title: string;
  summary: string;
  rationale: string;
  expectedOutcome?: string | null;
  targetMetric?: string | null;
  confidence: number;
  riskClass: DecisionRiskClass;
  evidenceIds: string[];
  missingEvidence: string[];
  market?: string | null;
  country?: string | null;
  locale?: string | null;
  status: GrowthProposalStatus;
  executionAllowed: false;
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
};

export type ProposalCandidateResult = {
  created: boolean;
  proposal?: GrowthProposal;
  assessment: EvidenceAssessment;
  reason?: "insufficient_evidence" | "hypothesis_not_eligible" | "duplicate_proposal";
  missingEvidence: string[];
};

type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

type AuditSink = (input: { tenantId: string; actor: string; action: string; proposalId: string; before?: unknown; after?: unknown; reason?: string }) => Promise<void>;

function clean(value: unknown, maxLength = 4000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function optional(value: unknown, maxLength = 500) {
  const result = clean(value, maxLength);
  return result || null;
}

function parseArray(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function assertTenant(tenantId: string) {
  const id = clean(tenantId, 120);
  if (!id || !getTenantConfig(id)) throw new Error(`Unknown tenant: ${id || "missing"}`);
  return id;
}

function mapProposal(row: Record<string, unknown>): GrowthProposal {
  return {
    proposalId: String(row.proposal_id), tenantId: String(row.tenant_id), hypothesisId: String(row.hypothesis_id),
    proposalType: String(row.proposal_type || "hypothesis_candidate"), title: String(row.title), summary: String(row.summary), rationale: String(row.rationale),
    expectedOutcome: (row.expected_outcome as string) || null, targetMetric: (row.target_metric as string) || null,
    confidence: Number(row.confidence || 0), riskClass: String(row.risk_class) as DecisionRiskClass,
    evidenceIds: parseArray(row.evidence_ids_json), missingEvidence: parseArray(row.missing_evidence_json),
    market: (row.market as string) || null, country: (row.country as string) || null, locale: (row.locale as string) || null,
    status: String(row.status) as GrowthProposalStatus, executionAllowed: false,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
    reviewedAt: (row.reviewed_at as string) || null, reviewedBy: (row.reviewed_by as string) || null, reviewNote: (row.review_note as string) || null,
  };
}

export async function auditGrowthProposal(db: D1, input: { tenantId: string; actor: string; action: string; proposalId: string; before?: unknown; after?: unknown; reason?: string }) {
  await db.prepare(`INSERT INTO growth_audit_log
    (id, tenant_id, actor, action, subject_type, subject_id, before_json, after_json)
    VALUES (?, ?, ?, ?, 'proposal', ?, ?, ?)`)
    .bind(crypto.randomUUID(), assertTenant(input.tenantId), clean(input.actor, 160) || "admin", clean(input.action, 120), clean(input.proposalId, 160),
      input.before === undefined ? "{}" : JSON.stringify(input.before), input.after === undefined ? "{}" : JSON.stringify({ ...(input.after as Record<string, unknown>), reason: input.reason || undefined }))
    .run();
}

export class GrowthProposalRepository {
  private readonly db: D1;
  private readonly audit: AuditSink;

  constructor(db: D1, audit: AuditSink = (input) => auditGrowthProposal(db, input)) {
    this.db = db;
    this.audit = audit;
  }

  async create(input: Omit<GrowthProposal, "createdAt" | "updatedAt" | "executionAllowed"> & { actor?: string }) {
    const tenantId = assertTenant(input.tenantId);
    if (!PROPOSAL_STATUSES.includes(input.status) || !["draft", "review_required"].includes(input.status)) throw new Error("Proposal must start in draft or review_required.");
    const proposalId = clean(input.proposalId, 160) || crypto.randomUUID();
    await this.db.prepare(`INSERT INTO growth_proposals
      (proposal_id, tenant_id, hypothesis_id, proposal_type, title, summary, rationale, expected_outcome, target_metric, confidence,
       risk_class, evidence_ids_json, missing_evidence_json, market, country, locale, status, execution_allowed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`)
      .bind(proposalId, tenantId, clean(input.hypothesisId, 160), clean(input.proposalType, 120) || "hypothesis_candidate", clean(input.title, 500), clean(input.summary), clean(input.rationale),
        optional(input.expectedOutcome), optional(input.targetMetric), Math.max(0, Math.min(100, Number(input.confidence || 0))), input.riskClass,
        JSON.stringify([...new Set(input.evidenceIds)]), JSON.stringify([...new Set(input.missingEvidence)]), optional(input.market), optional(input.country), optional(input.locale), input.status)
      .run();
    const proposal = await this.get(tenantId, proposalId);
    if (!proposal) throw new Error("Proposal was not persisted.");
    await this.audit({ tenantId, actor: clean(input.actor, 160) || "growth_engine", action: "proposal_created", proposalId, after: proposal });
    return proposal;
  }

  async get(tenantId: string, proposalId: string) {
    const id = assertTenant(tenantId);
    const row = await this.db.prepare("SELECT * FROM growth_proposals WHERE tenant_id = ? AND proposal_id = ? LIMIT 1").bind(id, clean(proposalId, 160)).first<Record<string, unknown>>();
    return row ? mapProposal(row) : undefined;
  }

  async listProposals(tenantId: string, options: { status?: GrowthProposalStatus; riskClass?: DecisionRiskClass; hypothesisId?: string; limit?: number } = {}) {
    const id = assertTenant(tenantId);
    const limit = Math.min(Math.max(Number(options.limit || 50), 1), 100);
    const status = clean(options.status, 40);
    const risk = clean(options.riskClass, 40);
    const hypothesisId = clean(options.hypothesisId, 160);
    const rows = await this.db.prepare(`SELECT * FROM growth_proposals
      WHERE tenant_id = ? AND (? = '' OR status = ?) AND (? = '' OR risk_class = ?) AND (? = '' OR hypothesis_id = ?)
      ORDER BY datetime(created_at) DESC LIMIT ?`)
      .bind(id, status, status, risk, risk, hypothesisId, hypothesisId, limit).all<Record<string, unknown>>();
    return (rows.results || []).map(mapProposal);
  }

  async updateReviewStatus(tenantId: string, proposalId: string, action: ProposalReviewAction, reviewedBy: string, reviewNote?: string) {
    const id = assertTenant(tenantId);
    const actor = clean(reviewedBy, 160);
    if (!actor) throw new Error("Human reviewer is required.");
    if (!PROPOSAL_REVIEW_ACTIONS.includes(action)) throw new Error(`Invalid proposal review action: ${action}`);
    const current = await this.get(id, proposalId);
    if (!current) throw new Error("Proposal not found.");
    const target: Record<ProposalReviewAction, GrowthProposalStatus> = { approve: "approved", reject: "rejected", defer: "deferred" };
    if (current.status !== "review_required" && !(action === "defer" && current.status === "draft")) throw new Error(`Cannot ${action} proposal from ${current.status}.`);
    await this.db.prepare(`UPDATE growth_proposals SET status = ?, execution_allowed = 0, reviewed_at = CURRENT_TIMESTAMP,
      reviewed_by = ?, review_note = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND proposal_id = ?`)
      .bind(target[action], actor, optional(reviewNote, 2000), id, clean(proposalId, 160)).run();
    const updated = await this.get(id, proposalId);
    if (!updated) throw new Error("Reviewed proposal was not persisted.");
    await this.audit({ tenantId: id, actor, action: `proposal_${action === "approve" ? "approved" : action === "reject" ? "rejected" : "deferred"}`, proposalId, before: current, after: updated, reason: reviewNote });
    return updated;
  }
}

function containsCriticalAction(input: { title: string; summary: string; rationale: string }) {
  return /price|trial|billing|campaign|character|menu|advertis|external\s*(message|send)|sns\s*publish|広告|価格|課金|キャンペーン|キャラクター|メニュー|外部送信|投稿/i.test(`${input.title} ${input.summary} ${input.rationale}`);
}

export class GrowthProposalService {
  private readonly repository: GrowthProposalRepository;
  private readonly assessmentService: EvidenceAssessmentService;

  constructor(repository: GrowthProposalRepository, assessmentService = new EvidenceAssessmentService()) {
    this.repository = repository;
    this.assessmentService = assessmentService;
  }

  async createCandidate(input: {
    proposalId: string;
    hypothesis: GrowthHypothesis;
    sources: readonly EvidenceSource[];
    claims: readonly EvidenceClaim[];
    context: EvidenceDecisionContext;
    title: string;
    summary: string;
    rationale: string;
    expectedOutcome?: string | null;
    targetMetric?: string | null;
    proposalType?: string;
    actor?: string;
  }): Promise<ProposalCandidateResult> {
    if (input.hypothesis.tenantId !== input.context.tenantId) throw new Error("Hypothesis tenant does not match proposal context.");
    if (input.hypothesis.status !== "draft") throw new Error("Only draft hypotheses can become proposal candidates.");
    const riskClass = containsCriticalAction({ title: input.title, summary: input.summary, rationale: input.rationale }) ? "HIGH" : input.hypothesis.riskClass;
    const assessment = this.assessmentService.assess({ sources: input.sources, claims: input.claims, context: input.context, riskClass });
    if (assessment.sufficiency === "INSUFFICIENT" || assessment.sufficiency === "WEAK" || !assessment.meetsRiskRequirement) {
      return { created: false, assessment, reason: "insufficient_evidence", missingEvidence: assessment.missingEvidence };
    }
    const active = await this.repository.listProposals(input.context.tenantId, { hypothesisId: input.hypothesis.hypothesisId, limit: 10 });
    if (active.some((proposal) => ["draft", "review_required", "approved", "deferred"].includes(proposal.status) && proposal.proposalType === (input.proposalType || "hypothesis_candidate"))) {
      return { created: false, assessment, reason: "duplicate_proposal", missingEvidence: assessment.missingEvidence };
    }
    const proposal = await this.repository.create({
      proposalId: input.proposalId, tenantId: input.context.tenantId, hypothesisId: input.hypothesis.hypothesisId, proposalType: input.proposalType || "hypothesis_candidate",
      title: clean(input.title, 500), summary: clean(input.summary), rationale: clean(input.rationale), expectedOutcome: optional(input.expectedOutcome), targetMetric: optional(input.targetMetric),
      confidence: Math.min(input.hypothesis.confidence ?? assessment.sufficiencyScore, assessment.sufficiencyScore), riskClass, evidenceIds: input.hypothesis.evidenceIds,
      missingEvidence: [...new Set([...input.hypothesis.missingEvidence, ...assessment.missingEvidence])], market: input.context.market, country: input.context.country, locale: input.context.locale,
      status: "review_required", actor: input.actor,
    });
    return { created: true, proposal, assessment, missingEvidence: proposal.missingEvidence };
  }
}
