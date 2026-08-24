import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { evaluateProposal } = await import("../app/lib/growth-hypothesis-proposal.ts");
const TARGET = { tenantId: "raven-oracle", guildId: "raven-guild", market: "JP", country: "JP", locale: "ja-JP" };
function record(type, id, scope = TARGET) { return { source: { sourceId: id, ...scope, sourceType: type, title: id, observedAt: "2026-08-20T00:00:00.000Z" }, claims: [{ claimId: `${id}-claim`, sourceId: id, ...scope, claimType: "observation", statement: "観測", relevanceScore: 0.9 }] }; }
const proposal = (overrides = {}) => ({ id: "p1", hypothesisId: "h1", ...TARGET, proposedAction: "CHANGE_HOOK", expectedImpact: "視聴完了率を高める", targetMetric: "completion_rate", expectedDirection: "INCREASE", reversible: true, implementationEffort: "LOW", ...overrides });
describe("Phase 3 Growth Hypothesis / Proposal Core", () => {
  it("defines the additive migration and tenant-scoped repository surface", () => {
    const sql = readFileSync("drizzle/0027_growth_hypothesis_proposals.sql", "utf8");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS growth_hypotheses/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS growth_hypothesis_evidence/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS growth_proposals/);
    assert.match(sql, /FOREIGN KEY \(hypothesis_id\) REFERENCES growth_hypotheses\(id\) ON DELETE CASCADE/);
    const source = readFileSync("app/lib/growth-hypothesis-proposal.ts", "utf8");
    for (const method of ["createHypothesis", "getHypothesis", "listHypotheses", "updateHypothesis", "attachEvidence", "listHypothesisEvidence", "createProposal", "getProposal", "listProposals", "updateProposal"]) assert.match(source, new RegExp(`async ${method}`));
    assert.match(source, /tenant_id = \?/);
  });
  it("keeps structured hypothesis/proposal fields and reuses Phase 2 Decision", () => { const result = evaluateProposal(proposal(), [record("internal_observation", "i"), record("experiment_result", "e"), record("external_primary", "x")]); assert.equal(result.sufficiency.level, "STRONG"); assert.equal(result.decision, "GO"); });
  it("does not allow insufficient evidence", () => { const result = evaluateProposal(proposal(), []); assert.equal(result.decision, "INSUFFICIENT_EVIDENCE"); assert.ok(result.missingEvidence.length > 0); });
  it("requires approval for high risk and irreversible proposals", () => { assert.equal(evaluateProposal(proposal({ proposedAction: "PRICE" }), [record("internal_observation", "i"), record("experiment_result", "e")]).decision, "REQUIRE_APPROVAL"); assert.equal(evaluateProposal(proposal({ reversible: false }), [record("internal_observation", "i"), record("experiment_result", "e")]).decision, "REQUIRE_APPROVAL"); });
  it("does not transfer JP evidence to a US proposal or mix locales", () => { const result = evaluateProposal(proposal({ market: "US", country: "US", locale: "en-US" }), [record("external_primary", "jp")]); assert.equal(result.decision, "INSUFFICIENT_EVIDENCE"); assert.ok(result.missingEvidence.some((item) => item.type === "need_target_market_evidence")); });
  it("keeps model-only evidence from becoming strong", () => { const result = evaluateProposal(proposal(), [record("model_inference", "m1"), record("model_inference", "m2"), record("model_inference", "m3")]); assert.notEqual(result.sufficiency.level, "STRONG"); });
});
