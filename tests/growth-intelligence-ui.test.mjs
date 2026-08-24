import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/admin/growth/intelligence/page.tsx", "utf8");
const route = readFileSync("app/api/growth-intelligence/route.ts", "utf8");
const growth = readFileSync("app/admin/growth/page.tsx", "utf8");

describe("Growth Intelligence Stage 1 UI", () => {
  it("adds a protected entry point and displays structured hypothesis/proposal fields", () => {
    assert.match(growth, /\/admin\/growth\/intelligence/);
    for (const label of ["Hypothesis一覧", "Hypothesis詳細", "Proposal一覧", "Proposal詳細", "Supporting Evidence", "Missing Evidence", "Evidence Sufficiency", "Risk \/ Approval \/ Decision", "Hypothesisを作成", "Proposalを作成"]) assert.match(page, new RegExp(label));
  });

  it("exposes the required manual operations without AI or experiment actions", () => {
    for (const action of ["create_hypothesis", "create_proposal", "approve_proposal", "reject_proposal"]) assert.match(route, new RegExp(action));
    assert.doesNotMatch(route, /generateHypothesis|generateProposal|createFromRecommendation|growth_experiments/);
    assert.match(route, /requireEvidenceAdmin/);
    assert.match(route, /tenantFrom/);
    assert.match(route, /market/);
    assert.match(route, /locale/);
  });

  it("keeps Decision evaluation on the server", () => {
    assert.match(route, /evaluateProposal/);
    assert.match(route, /INSUFFICIENT_EVIDENCE/);
    assert.match(route, /decision\.decision === "HOLD"/);
    assert.match(page, /disabled=\{busy \|\| !selectedProposal\.approvalRequired/);
  });
});
