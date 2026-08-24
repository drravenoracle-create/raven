import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { generateHypothesisCandidate, generateProposalCandidate, validateHypothesisCandidate, validateProposalCandidate, buildProposalDecision } = await import("../app/lib/growth-intelligence-ai.ts");
const TARGET = { tenantId: "raven-oracle", guildId: "raven-guild", market: "JP", country: "JP", locale: "ja-JP" };
function record(type, id, scope = TARGET) { return { source: { sourceId: id, ...scope, sourceType: type, title: id, observedAt: "2026-08-20T00:00:00.000Z" }, claims: [{ claimId: `${id}-claim`, sourceId: id, ...scope, claimType: "observation", statement: "測定された事実", relevanceScore: 0.9, confidence: 0.9 }] }; }
function aiResponse(value) { return async () => new Response(JSON.stringify({ output_text: JSON.stringify(value) }), { status: 200, headers: { "content-type": "application/json" } }); }
const hypothesis = { statement: "質問型Hookは完視聴率を高める", targetSegment: "新規訪問者", targetMetric: "completion_rate", expectedDirection: "INCREASE", reasoning: "直近の測定結果から候補化した" };
const proposal = { proposedAction: "Hookを質問型へ変更", expectedImpact: "完視聴率の改善", targetMetric: "completion_rate", expectedDirection: "INCREASE", reversible: true, implementationEffort: "LOW", reasoning: "既存テンプレートで戻せる" };
const strongEvidence = [record("internal_observation", "i"), record("experiment_result", "e"), record("external_primary", "x")];

describe("Phase 3 Stage 2 AI candidate layer", () => {
  it("accepts valid structured Hypothesis and Proposal responses", async () => {
    const h = await generateHypothesisCandidate(TARGET, strongEvidence, "test-key", "test-model", aiResponse(hypothesis));
    assert.equal(h.ok, true); if (h.ok) { assert.equal(h.candidate.targetMetric, "completion_rate"); assert.equal(h.evidenceDecision.sufficiency.level, "STRONG"); }
    const p = await generateProposalCandidate(TARGET, strongEvidence, { statement: hypothesis.statement, targetMetric: hypothesis.targetMetric, expectedDirection: hypothesis.expectedDirection }, "test-key", "test-model", aiResponse(proposal));
    assert.equal(p.ok, true); if (p.ok) assert.equal(p.candidate.reversible, true);
  });

  it("rejects malformed, incomplete, and invalid enum responses", () => {
    assert.throws(() => validateHypothesisCandidate("free text"), /JSON object/);
    assert.throws(() => validateHypothesisCandidate({ ...hypothesis, expectedDirection: "MAYBE" }), /expectedDirection/);
    assert.throws(() => validateProposalCandidate({ ...proposal, reversible: "yes" }), /reversible/);
    assert.throws(() => validateProposalCandidate({ ...proposal, implementationEffort: "EXTREME" }), /implementationEffort/);
    assert.throws(() => validateProposalCandidate({ ...proposal, targetMetric: "" }), /targetMetric/);
    assert.throws(() => validateHypothesisCandidate({ ...hypothesis, statement: "x".repeat(2001) }), /maximum length/);
  });

  it("refuses insufficient, cross-market, and model-only evidence before AI generation", async () => {
    const insufficient = await generateHypothesisCandidate(TARGET, [], "test-key", "test-model", aiResponse(hypothesis));
    assert.equal(insufficient.ok, false); if (!insufficient.ok) assert.equal(insufficient.errorCode, "INSUFFICIENT_EVIDENCE");
    const crossMarket = await generateHypothesisCandidate({ ...TARGET, market: "US", country: "US", locale: "en-US" }, [record("external_primary", "jp")], "test-key", "test-model", aiResponse(hypothesis));
    assert.equal(crossMarket.ok, false); if (!crossMarket.ok) assert.ok(crossMarket.evidenceDecision.missingEvidence.some((item) => item.type === "need_target_market_evidence"));
    const modelOnly = await generateHypothesisCandidate(TARGET, [record("model_inference", "m1"), record("model_inference", "m2"), record("model_inference", "m3")], "test-key", "test-model", aiResponse(hypothesis));
    assert.equal(modelOnly.ok, false); if (!modelOnly.ok) assert.ok(["HOLD", "INSUFFICIENT_EVIDENCE"].includes(modelOnly.errorCode));
  });

  it("re-evaluates Proposal risk, approval, and decision through Core", () => {
    const decision = buildProposalDecision(TARGET, strongEvidence, { ...proposal, proposedAction: "PRICE" }, "h1");
    assert.equal(decision.riskClass, "HIGH"); assert.equal(decision.decision, "REQUIRE_APPROVAL"); assert.equal(decision.authorizationRequired, true);
    const insufficient = buildProposalDecision(TARGET, [], proposal, "h1");
    assert.equal(insufficient.decision, "INSUFFICIENT_EVIDENCE");
  });
});
