import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { evaluateExperimentDraftEligibility } = await import("../app/lib/growth-experiment-draft-policy.ts");
const TARGET = { tenantId: "raven-oracle", guildId: "raven-guild", market: "JP", country: "JP", locale: "ja-JP" };
function record(type, id) { return { source: { sourceId: id, ...TARGET, sourceType: type, title: id, observedAt: "2026-08-20T00:00:00.000Z" }, claims: [{ claimId: `${id}-claim`, sourceId: id, ...TARGET, claimType: "observation", statement: "観測", relevanceScore: 0.9 }] }; }
function proposal(overrides = {}) { return { id: "p1", hypothesisId: "h1", ...TARGET, proposedAction: "CHANGE_HOOK", expectedImpact: "完視聴率を改善", targetMetric: "completion_rate", expectedDirection: "INCREASE", reversible: true, implementationEffort: "LOW", evidenceSufficiency: "STRONG", riskClass: "LOW", approvalRequired: false, approvalStatus: "NOT_REQUIRED", decision: "GO", missingEvidence: [], status: "DRAFT", ...overrides }; }
const hypothesis = { id: "h1", ...TARGET };

describe("Phase 3 Stage 3 Experiment Draft", () => {
  it("allows a valid proposal and re-evaluates the server decision", () => {
    const result = evaluateExperimentDraftEligibility({ proposal: proposal(), hypothesis, evidence: [record("internal_observation", "i"), record("experiment_result", "e"), record("external_primary", "x")] });
    assert.equal(result.ok, true);
    assert.equal(result.decision.decision, "GO");
  });
  it("rejects unapproved high risk, rejected, insufficient and irreversible proposals", () => {
    const evidence = [record("internal_observation", "i"), record("experiment_result", "e")];
    assert.equal(evaluateExperimentDraftEligibility({ proposal: proposal({ riskClass: "HIGH", approvalRequired: true, approvalStatus: "PENDING" }), hypothesis, evidence }).ok, false);
    assert.equal(evaluateExperimentDraftEligibility({ proposal: proposal({ status: "REJECTED" }), hypothesis, evidence }).ok, false);
    assert.equal(evaluateExperimentDraftEligibility({ proposal: proposal({ reversible: false }), hypothesis, evidence }).ok, false);
    assert.equal(evaluateExperimentDraftEligibility({ proposal: proposal(), hypothesis, evidence: [] }).ok, false);
  });
  it("rejects tenant, market and locale boundary mismatches", () => {
    assert.equal(evaluateExperimentDraftEligibility({ proposal: proposal({ tenantId: "other" }), hypothesis, evidence: [] }).ok, false);
    assert.equal(evaluateExperimentDraftEligibility({ proposal: proposal({ market: "US", country: "US", locale: "en-US" }), hypothesis, evidence: [] }).ok, false);
  });
  it("keeps traceability in the existing source_json extension", () => {
    const manager = readFileSync("app/lib/growth-experiment-manager.ts", "utf8");
    const service = readFileSync("app/lib/growth-experiment-draft.ts", "utf8");
    assert.match(manager, /source_json/);
    assert.match(service, /hypothesisId/);
    assert.match(service, /proposalId/);
    assert.match(service, /origin === "growth_intelligence"/);
  });
  it("does not add an Experiment migration or execution transition", () => {
    const service = readFileSync("app/lib/growth-experiment-draft.ts", "utf8");
    assert.doesNotMatch(service, /transitionExperiment|RUNNING|ACTIVE|PUBLISHED|fetch\(/);
  });
});
