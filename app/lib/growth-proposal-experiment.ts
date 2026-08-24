import { createExperiment, getExperiment } from "./growth-experiment-manager.ts";
import { auditGrowthProposal, GrowthProposalRepository, type GrowthProposal } from "./growth-proposal.ts";

type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

export type ExperimentDraftResult = {
  created: boolean;
  duplicate: boolean;
  experiment?: Record<string, unknown> | null;
  proposal: GrowthProposal;
  reason?: "proposal_not_approved" | "duplicate_experiment";
  requiresStartApproval: true;
  executionStarted: false;
};

function clean(value: unknown, maxLength = 2000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export class GrowthProposalExperimentService {
  private readonly db: D1;
  private readonly proposals: GrowthProposalRepository;

  constructor(db: D1, proposals = new GrowthProposalRepository(db)) {
    this.db = db;
    this.proposals = proposals;
  }

  async createDraftFromApprovedProposal(tenantId: string, proposalId: string, actor = "admin"): Promise<ExperimentDraftResult> {
    const proposal = await this.proposals.get(tenantId, proposalId);
    if (!proposal) throw new Error("Proposal not found.");
    if (proposal.status !== "approved") {
      return { created: false, duplicate: false, proposal, reason: "proposal_not_approved", requiresStartApproval: true, executionStarted: false };
    }

    const existing = await this.db.prepare(`SELECT * FROM growth_experiments
      WHERE tenant_id = ? AND proposal_id = ?
        AND status IN ('DRAFT', 'PROPOSED', 'WAITING_APPROVAL', 'APPROVED', 'RUNNING', 'PAUSED', 'MEASURING')
      ORDER BY datetime(created_at) DESC LIMIT 1`).bind(tenantId, proposalId).first<Record<string, unknown>>();
    if (existing) {
      await auditGrowthProposal(this.db, { tenantId, actor, action: "experiment_draft_duplicate_blocked", proposalId, after: { experimentId: existing.experiment_id } });
      return { created: false, duplicate: true, experiment: existing, proposal, reason: "duplicate_experiment", requiresStartApproval: true, executionStarted: false };
    }

    const experiment = await createExperiment(this.db, {
      status: "DRAFT",
      title: proposal.title,
      description: proposal.summary,
      hypothesis: proposal.rationale || proposal.summary,
      change_summary: proposal.rationale,
      target_type: "OTHER",
      primary_kpi: proposal.targetMetric || "Conversion Rate",
      confidence_score: proposal.confidence,
      confidence: proposal.confidence / 100,
      approval_required: 1,
      owner: actor,
      source: { type: "growth_proposal", proposal_id: proposal.proposalId, hypothesis_id: proposal.hypothesisId, evidence_ids: proposal.evidenceIds },
      actor,
    }, tenantId);
    if (!experiment) throw new Error("Experiment draft was not persisted.");
    const experimentId = String(experiment.experiment_id);
    await this.db.prepare(`UPDATE growth_experiments
      SET proposal_id = ?, hypothesis_id = ?, risk_class = ?, market = ?, country = ?, locale = ?, requires_start_approval = 1,
          approval_required = 1, status = 'DRAFT', updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND experiment_id = ?`).bind(proposal.proposalId, proposal.hypothesisId, proposal.riskClass, proposal.market || null, proposal.country || null, proposal.locale || null, tenantId, experimentId).run();
    const updated = await getExperiment(this.db, experimentId, tenantId);
    await auditGrowthProposal(this.db, { tenantId, actor, action: "experiment_draft_created", proposalId, after: { experimentId, hypothesisId: proposal.hypothesisId, status: "DRAFT", requiresStartApproval: true } });
    await auditGrowthProposal(this.db, { tenantId, actor, action: "experiment_start_approval_required", proposalId, after: { experimentId, riskClass: proposal.riskClass } });
    return { created: true, duplicate: false, experiment: updated, proposal, requiresStartApproval: true, executionStarted: false };
  }
}

export function experimentDraftSummary(experiment: Record<string, unknown> | null | undefined) {
  if (!experiment) return null;
  return {
    experimentId: clean(experiment.experiment_id, 160), experimentCode: clean(experiment.experiment_code, 80), status: clean(experiment.status, 40),
    proposalId: clean(experiment.proposal_id, 160), hypothesisId: clean(experiment.hypothesis_id, 160), riskClass: clean(experiment.risk_class, 40),
    targetMetric: clean(experiment.primary_kpi || experiment.primary_metric, 160), requiresStartApproval: true,
  };
}
