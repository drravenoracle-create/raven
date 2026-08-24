import { evaluateProposal, type GrowthProposal } from "./growth-hypothesis-proposal.ts";
import type { EvidenceRecord } from "./evidence-layer.ts";

type HypothesisScope = { id: string; tenantId: string; guildId?: string | null; market?: string | null; country?: string | null; locale?: string | null };

export type DraftEligibilityInput = { proposal: GrowthProposal; hypothesis: HypothesisScope; evidence: EvidenceRecord[] };

function scopeValue(value: unknown) { return value === undefined || value === null || value === "" ? null : String(value); }

export function evaluateExperimentDraftEligibility(input: DraftEligibilityInput) {
  const { proposal, hypothesis, evidence } = input;
  if (proposal.status === "REJECTED") return { ok: false as const, reason: "Rejected Proposal cannot become an Experiment Draft." };
  if (proposal.hypothesisId !== hypothesis.id || proposal.tenantId !== hypothesis.tenantId) return { ok: false as const, reason: "Hypothesis linkage or tenant mismatch." };
  for (const key of ["guildId", "market", "country", "locale"] as const) {
    if (scopeValue(hypothesis[key]) !== scopeValue(proposal[key])) return { ok: false as const, reason: `${key} mismatch between hypothesis and proposal.` };
  }
  if (!proposal.reversible) return { ok: false as const, reason: "Missing rollback plan for irreversible Proposal." };
  if (proposal.approvalRequired && proposal.approvalStatus !== "APPROVED") return { ok: false as const, reason: "Human Approval is required before Draft creation." };
  if (!proposal.approvalRequired && proposal.status !== "DRAFT" && proposal.status !== "APPROVED") return { ok: false as const, reason: "Proposal is not in a draftable status." };
  const decision = evaluateProposal({ ...proposal, authorizationStatus: proposal.approvalStatus }, evidence);
  if (decision.decision !== "GO") return { ok: false as const, reason: `Proposal cannot become an Experiment Draft: ${decision.decision}.`, decision };
  return { ok: true as const, decision };
}

