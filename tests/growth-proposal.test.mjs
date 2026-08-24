import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { GrowthHypothesisService, HypothesisRepository } from "../app/lib/growth-hypothesis.ts";
import { GrowthProposalRepository, GrowthProposalService } from "../app/lib/growth-proposal.ts";

const asOf = "2026-08-24T00:00:00.000Z";
function source(id, type) { return { sourceId: id, tenantId: "raven-oracle", sourceType: type, sourceName: id, status: "active", market: "jp", country: "JP", locale: "ja-JP", observedAt: "2026-08-23T00:00:00.000Z", retrievedAt: "2026-08-23T00:00:00.000Z", sourceUrl: `https://example.test/${id}` }; }
function claim(id, sourceId, scope) { return { claimId: id, tenantId: "raven-oracle", sourceId, evidenceScope: scope, claimType: "metric", statement: id, metricName: "conversion_rate", metricValue: 10, market: "jp", country: "JP", locale: "ja-JP" }; }
function dbAdapter(db) { return { prepare(sql) { return { bind(...values) { const statement = db.prepare(sql); return { async all() { return { results: statement.all(...values) }; }, async first() { return statement.get(...values) || null; }, async run() { return statement.run(...values); } }; } }; } }; }
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../drizzle/0029_growth_hypotheses.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../drizzle/0030_growth_proposals.sql", import.meta.url), "utf8"));
  db.exec("CREATE TABLE growth_audit_log (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, before_json TEXT, after_json TEXT);");
  return dbAdapter(db);
}
async function setup(evidenceLevel = "moderate") {
  const db = fixture(); const hypothesisRepo = new HypothesisRepository(db); const proposalRepo = new GrowthProposalRepository(db);
  const sources = evidenceLevel === "strong" ? [source("internal", "first_party_actual"), source("experiment", "experiment_result"), source("external", "primary_research")] : [source("internal", "first_party_actual"), source("experiment", "experiment_result")];
  const claims = evidenceLevel === "strong" ? [claim("c1", "internal", "internal_observation"), claim("c2", "experiment", "experiment_result"), claim("c3", "external", "external_primary")] : [claim("c1", "internal", "internal_observation"), claim("c2", "experiment", "experiment_result")];
  const hypothesisResult = await new GrowthHypothesisService(hypothesisRepo).createDraft({ hypothesisId: `hyp-${evidenceLevel}`, observation: "observation", hypothesis: "hypothesis", expectedOutcome: "outcome", targetMetric: "conversion_rate", sources, claims, context: { tenantId: "raven-oracle", market: "jp", country: "JP", locale: "ja-JP", asOf }, riskClass: "LOW" });
  return { db, proposalRepo, hypothesis: hypothesisResult.hypothesis, sources, claims };
}
function candidate(data, overrides = {}) { return { proposalId: `proposal-${Math.random().toString(16).slice(2)}`, hypothesis: data.hypothesis, sources: data.sources, claims: data.claims, context: { tenantId: "raven-oracle", market: "jp", country: "JP", locale: "ja-JP", asOf }, title: "改善候補", summary: "根拠に基づく候補", rationale: "観測と実験結果に基づく", expectedOutcome: "conversion_rate改善", targetMetric: "conversion_rate", ...overrides }; }

test("MODERATE hypothesis becomes review_required proposal and stays locked", async () => {
  const data = await setup(); const result = await new GrowthProposalService(data.proposalRepo).createCandidate(candidate(data));
  assert.equal(result.created, true); assert.equal(result.proposal.status, "review_required"); assert.equal(result.proposal.executionAllowed, false); assert.equal(result.proposal.evidenceIds.length, 2);
});

test("STRONG hypothesis still requires human review", async () => {
  const data = await setup("strong"); const result = await new GrowthProposalService(data.proposalRepo).createCandidate(candidate(data, { proposalId: "proposal-strong" }));
  assert.equal(result.created, true); assert.equal(result.proposal.status, "review_required"); assert.equal(result.proposal.executionAllowed, false);
});

test("insufficient proposal candidate is rejected without persistence", async () => {
  const data = await setup(); const result = await new GrowthProposalService(data.proposalRepo).createCandidate(candidate({ ...data, hypothesis: { ...data.hypothesis, evidenceSufficiency: "MODERATE" } }, { sources: [], claims: [], proposalId: "proposal-weak" }));
  assert.equal(result.created, false); assert.equal(result.reason, "insufficient_evidence"); assert.equal((await data.proposalRepo.listProposals("raven-oracle")).length, 0);
});

test("approve, reject and defer persist reviewer metadata and never unlock execution", async () => {
  const data = await setup(); const result = await new GrowthProposalService(data.proposalRepo).createCandidate(candidate(data, { proposalId: "proposal-review" }));
  const approved = await data.proposalRepo.updateReviewStatus("raven-oracle", result.proposal.proposalId, "approve", "admin@example.test", "approved for Phase 5 review");
  assert.equal(approved.status, "approved"); assert.equal(approved.executionAllowed, false); assert.equal(approved.reviewedBy, "admin@example.test");
  await assert.rejects(() => data.proposalRepo.updateReviewStatus("raven-oracle", approved.proposalId, "reject", "admin@example.test"), /Cannot reject/);
  const deferredData = await setup();
  const deferred = await new GrowthProposalService(deferredData.proposalRepo).createCandidate(candidate(deferredData, { proposalId: "proposal-defer" }));
  const deferredResult = await deferredData.proposalRepo.updateReviewStatus("raven-oracle", deferred.proposal.proposalId, "defer", "admin@example.test", "need more data");
  assert.equal(deferredResult.status, "deferred"); assert.equal(deferredResult.executionAllowed, false);
});

test("duplicate active proposal and unknown tenant are blocked", async () => {
  const data = await setup(); const first = await new GrowthProposalService(data.proposalRepo).createCandidate(candidate(data, { proposalId: "proposal-duplicate-1" }));
  const duplicate = await new GrowthProposalService(data.proposalRepo).createCandidate(candidate(data, { proposalId: "proposal-duplicate-2" }));
  assert.equal(first.created, true); assert.equal(duplicate.created, false); assert.equal(duplicate.reason, "duplicate_proposal");
  await assert.rejects(() => data.proposalRepo.listProposals("unknown-tenant"), /Unknown tenant/);
});

test("critical action cannot bypass strong evidence review boundary", async () => {
  const data = await setup("strong"); const result = await new GrowthProposalService(data.proposalRepo).createCandidate(candidate(data, { proposalId: "proposal-critical", title: "価格変更を検討" }));
  assert.equal(result.created, true); assert.equal(result.proposal.riskClass, "HIGH"); assert.equal(result.proposal.status, "review_required"); assert.equal(result.proposal.executionAllowed, false);
});
