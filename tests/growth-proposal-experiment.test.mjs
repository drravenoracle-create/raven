import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { GrowthProposalRepository } from "../app/lib/growth-proposal.ts";
import { GrowthProposalExperimentService } from "../app/lib/growth-proposal-experiment.ts";

function dbAdapter(db) { return { prepare(sql) { return { bind(...values) { const statement = db.prepare(sql); return { async all() { return { results: statement.all(...values) }; }, async first() { return statement.get(...values) || null; }, async run() { return statement.run(...values); } }; } }; } }; }
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../drizzle/0013_growth_experiment_manager.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../drizzle/0029_growth_hypotheses.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../drizzle/0030_growth_proposals.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../drizzle/0031_growth_proposal_experiment_link.sql", import.meta.url), "utf8"));
  return { db, adapter: dbAdapter(db) };
}
async function proposal(status = "review_required", riskClass = "LOW", id = `proposal-${Math.random().toString(16).slice(2)}`) {
  const state = fixture(); const repository = new GrowthProposalRepository(state.adapter);
  await repository.create({ proposalId: id, tenantId: "raven-oracle", hypothesisId: `hyp-${id}`, proposalType: "hypothesis_candidate", title: "Content test", summary: "Test summary", rationale: "Test rationale", expectedOutcome: "Conversion improves", targetMetric: "conversion_rate", confidence: 60, riskClass, evidenceIds: ["claim-1"], missingEvidence: [], market: "jp", country: "JP", locale: "ja-JP", status: "review_required", actor: "test" });
  if (status === "approved") await repository.updateReviewStatus("raven-oracle", id, "approve", "reviewer@example.test", "approved");
  if (status === "rejected") await repository.updateReviewStatus("raven-oracle", id, "reject", "reviewer@example.test", "rejected");
  if (status === "deferred") await repository.updateReviewStatus("raven-oracle", id, "defer", "reviewer@example.test", "deferred");
  return { ...state, repository, proposalId: id };
}

test("approved Proposal creates a DRAFT experiment with traceability and no auto-start", async () => {
  const state = await proposal("approved", "LOW", "proposal-approved"); const result = await new GrowthProposalExperimentService(state.adapter).createDraftFromApprovedProposal("raven-oracle", state.proposalId, "reviewer@example.test");
  assert.equal(result.created, true); assert.equal(result.executionStarted, false); assert.equal(result.requiresStartApproval, true); assert.equal(result.experiment.status, "DRAFT");
  assert.equal(result.experiment.proposal_id, state.proposalId); assert.equal(result.experiment.hypothesis_id, "hyp-proposal-approved"); assert.equal(result.experiment.primary_kpi, "conversion_rate");
});

test("non-approved, rejected and deferred proposals cannot create experiments", async () => {
  for (const status of ["review_required", "rejected", "deferred"]) {
    const state = await proposal(status, "LOW", `proposal-${status}`); const result = await new GrowthProposalExperimentService(state.adapter).createDraftFromApprovedProposal("raven-oracle", state.proposalId);
    assert.equal(result.created, false); assert.equal(result.reason, "proposal_not_approved"); assert.equal(state.db.prepare("SELECT COUNT(*) AS count FROM growth_experiments").get().count, 0);
  }
});

test("duplicate creation is idempotent and does not create a second active experiment", async () => {
  const state = await proposal("approved", "MEDIUM", "proposal-duplicate"); const service = new GrowthProposalExperimentService(state.adapter);
  const first = await service.createDraftFromApprovedProposal("raven-oracle", state.proposalId); const second = await service.createDraftFromApprovedProposal("raven-oracle", state.proposalId);
  assert.equal(first.created, true); assert.equal(second.created, false); assert.equal(second.duplicate, true); assert.equal(state.db.prepare("SELECT COUNT(*) AS count FROM growth_experiments WHERE proposal_id = ?").get(state.proposalId).count, 1);
});

test("HIGH and CRITICAL drafts always require human start approval", async () => {
  for (const risk of ["HIGH", "CRITICAL"]) {
    const state = await proposal("approved", risk, `proposal-${risk}`); const result = await new GrowthProposalExperimentService(state.adapter).createDraftFromApprovedProposal("raven-oracle", state.proposalId);
    assert.equal(result.created, true); assert.equal(result.experiment.status, "DRAFT"); assert.equal(result.experiment.requires_start_approval, 1); assert.equal(result.experiment.approval_required, 1);
  }
});

test("tenant isolation prevents another tenant from using a Raven Proposal", async () => {
  const state = await proposal("approved", "LOW", "proposal-tenant");
  await assert.rejects(() => new GrowthProposalExperimentService(state.adapter).createDraftFromApprovedProposal("unknown-tenant", state.proposalId), /Unknown tenant/);
  assert.equal(state.db.prepare("SELECT COUNT(*) AS count FROM growth_experiments").get().count, 0);
});

test("existing experiment rows remain compatible without proposal relation", async () => {
  const state = fixture(); state.db.prepare("INSERT INTO growth_experiments (experiment_id, tenant_id, hypothesis, primary_metric) VALUES (?, ?, ?, ?)").run("legacy-exp", "raven-oracle", "legacy hypothesis", "conversion_rate");
  const row = state.db.prepare("SELECT proposal_id, hypothesis_id, requires_start_approval FROM growth_experiments WHERE experiment_id = ?").get("legacy-exp");
  assert.equal(row.proposal_id, null); assert.equal(row.hypothesis_id, null); assert.equal(row.requires_start_approval, 1);
});
