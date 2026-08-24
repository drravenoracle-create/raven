import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { EvidenceRepository } from "../app/lib/growth-evidence.ts";
import { EvidenceAssessmentService } from "../app/lib/growth-evidence-assessment.ts";
import { GrowthHypothesisService, HypothesisRepository } from "../app/lib/growth-hypothesis.ts";
import { GrowthProposalRepository, GrowthProposalService } from "../app/lib/growth-proposal.ts";
import { GrowthProposalExperimentService } from "../app/lib/growth-proposal-experiment.ts";
import { GrowthMemoryRepository } from "../app/lib/growth-memory.ts";
import { GrowthPrecisionService } from "../app/lib/growth-precision.ts";

function adapter(db) { return { prepare(sql) { return { bind(...values) { const statement = db.prepare(sql); return { async all() { return { results: statement.all(...values) }; }, async first() { return statement.get(...values) || null; }, async run() { return statement.run(...values); } }; } }; } }; }
function fixture() { const db = new DatabaseSync(":memory:"); for (const file of ["0013_growth_experiment_manager.sql", "0005_growth_engine_v2_v3.sql", "0028_growth_evidence_registry.sql", "0029_growth_hypotheses.sql", "0030_growth_proposals.sql", "0031_growth_proposal_experiment_link.sql", "0032_growth_memory_precision.sql"]) db.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8")); return { db, adapter: adapter(db) }; }

async function evidence(state) {
  const repository = new EvidenceRepository(state.adapter); const common = { tenantId: "raven-oracle", market: "jp", country: "JP", locale: "ja-JP", retrievedAt: "2026-08-25T00:00:00.000Z", observedAt: "2026-08-25T00:00:00.000Z", qualityScore: 95, status: "active" };
  const sources = await Promise.all([
    repository.createSource({ ...common, sourceId: "source-internal", sourceType: "first_party_actual", sourceName: "Raven internal conversion", provider: "analytics" }),
    repository.createSource({ ...common, sourceId: "source-experiment", sourceType: "experiment_result", sourceName: "Completed experiment", provider: "growth" }),
    repository.createSource({ ...common, sourceId: "source-external", sourceType: "primary_research", sourceName: "Official market research", provider: "manual", sourceUrl: "https://example.test/research" }),
  ]);
  const claims = await Promise.all([
    repository.createClaim({ claimId: "claim-internal", tenantId: "raven-oracle", sourceId: sources[0].sourceId, evidenceScope: "internal_observation", claimType: "conversion", statement: "Internal conversion improved", metricName: "conversion_rate", metricValue: 0.12, market: "jp", country: "JP", locale: "ja-JP" }),
    repository.createClaim({ claimId: "claim-experiment", tenantId: "raven-oracle", sourceId: sources[1].sourceId, evidenceScope: "experiment_result", claimType: "result", statement: "Experiment increased conversion", metricName: "conversion_rate", metricValue: 0.1, market: "jp", country: "JP", locale: "ja-JP" }),
    repository.createClaim({ claimId: "claim-external", tenantId: "raven-oracle", sourceId: sources[2].sourceId, evidenceScope: "external_primary", claimType: "demand", statement: "Primary research indicates demand", metricName: "demand_index", metricValue: 80, market: "jp", country: "JP", locale: "ja-JP" }),
  ]);
  return { sources, claims };
}

test("Evidence to Precision is traceable and remains human-gated", async () => {
  const state = fixture(); const ev = await evidence(state); const context = { tenantId: "raven-oracle", market: "jp", country: "JP", locale: "ja-JP", asOf: "2026-08-25T00:00:00.000Z" }; const assessment = new EvidenceAssessmentService().assess({ sources: ev.sources, claims: ev.claims, context, riskClass: "MEDIUM" });
  assert.equal(assessment.sufficiency, "STRONG"); assert.equal(assessment.executionAllowed, false); assert.deepEqual(assessment.diversity.scopes.sort(), ["experiment_result", "external_primary", "internal_observation"]);
  const hypothesisResult = await new GrowthHypothesisService(new HypothesisRepository(state.adapter)).createDraft({ hypothesisId: "hyp-e2e", observation: "Demand and internal conversion align", hypothesis: "A focused content CTA can improve conversion", expectedOutcome: "Conversion rises", targetMetric: "conversion_rate", sources: ev.sources, claims: ev.claims, context, riskClass: "MEDIUM" });
  assert.equal(hypothesisResult.created, true); assert.equal(hypothesisResult.hypothesis.evidenceIds.length, 3); assert.equal(hypothesisResult.hypothesis.tenantId, "raven-oracle");
  const proposalResult = await new GrowthProposalService(new GrowthProposalRepository(state.adapter)).createCandidate({ proposalId: "proposal-e2e", hypothesis: hypothesisResult.hypothesis, sources: ev.sources, claims: ev.claims, context, title: "Review CTA content", summary: "Test a focused CTA", rationale: "Evidence supports a cautious content experiment", expectedOutcome: "Conversion rises", targetMetric: "conversion_rate", actor: "e2e-admin" });
  assert.equal(proposalResult.created, true); assert.equal(proposalResult.proposal.status, "review_required"); assert.equal(proposalResult.proposal.executionAllowed, false);
  const proposals = new GrowthProposalRepository(state.adapter); const approved = await proposals.updateReviewStatus("raven-oracle", "proposal-e2e", "approve", "e2e-admin", "approved for draft only"); assert.equal(approved.status, "approved"); assert.equal(approved.executionAllowed, false);
  const draft = await new GrowthProposalExperimentService(state.adapter).createDraftFromApprovedProposal("raven-oracle", "proposal-e2e", "e2e-admin"); assert.equal(draft.created, true); assert.equal(draft.executionStarted, false); assert.equal(draft.experiment.status, "DRAFT"); assert.equal(draft.experiment.requires_start_approval, 1);
  assert.equal(state.db.prepare("SELECT COUNT(*) AS count FROM growth_experiments WHERE status = 'RUNNING'").get().count, 0);
  state.db.prepare("UPDATE growth_experiments SET status = 'COMPLETED', result_status = 'WIN', baseline_value = 10, target_value = 15, measured_value = 14, primary_kpi_direction = 'increase' WHERE experiment_id = ?").run(draft.experiment.experiment_id);
  const memory = await new GrowthMemoryRepository(state.adapter).createFromExperiment("raven-oracle", draft.experiment.experiment_id, "e2e-admin"); assert.equal(memory.memory.proposalId, "proposal-e2e"); assert.equal(memory.memory.hypothesisId, "hyp-e2e"); assert.equal(memory.memory.successLevel, "success"); assert.equal(memory.memory.predictedValue, 15); assert.equal(memory.memory.actualValue, 14); assert.equal(memory.memory.absoluteError, 1); assert.equal(memory.memory.reusable, false);
  const precisionService = new GrowthPrecisionService(state.adapter); const precision = await precisionService.buildReport("raven-oracle"); assert.equal(precision.experimentSuccessRate, 1); assert.equal(precision.proposalAcceptanceRate, 1); assert.equal(precision.sampleSize, 1); assert.equal(precision.calibration.every((bucket) => bucket.reliable === false), true); await precisionService.createSnapshot("raven-oracle", { actor: "e2e-admin" });
  const actions = state.db.prepare("SELECT action FROM growth_audit_log WHERE tenant_id = ? ORDER BY created_at").all("raven-oracle").map((row) => row.action); assert.equal(actions.includes("evidence_source_registered"), true); assert.equal(actions.includes("evidence_claim_registered"), true); assert.equal(actions.includes("hypothesis_created"), true); assert.equal(actions.includes("proposal_approved"), true); assert.equal(actions.includes("experiment_draft_created"), true); assert.equal(actions.includes("growth_memory_created"), true); assert.equal(actions.includes("precision_snapshot_created"), true);
});

test("failure, reuse and superseded paths preserve history without automatic execution", async () => {
  const state = fixture(); const ev = await evidence(state); const context = { tenantId: "raven-oracle", market: "jp", country: "JP", locale: "ja-JP", asOf: "2026-08-25T00:00:00.000Z" }; const assessment = new EvidenceAssessmentService().assess({ sources: ev.sources, claims: ev.claims, context, riskClass: "LOW" }); assert.equal(assessment.sufficiency, "STRONG");
  state.db.prepare("INSERT INTO growth_experiments (experiment_id, tenant_id, title, hypothesis, primary_metric, target_type, primary_kpi, primary_kpi_direction, baseline_value, target_value, measured_value, result_status, status, confidence_score, sample_size) VALUES (?, 'raven-oracle', 'Failure', 'Failure fixture', 'conversion_rate', 'CONTENT', 'conversion_rate', 'increase', 10, 15, 5, 'LOSS', 'COMPLETED', 40, 20)").run("exp-failure-e2e");
  const repository = new GrowthMemoryRepository(state.adapter); const failed = await repository.createFromExperiment("raven-oracle", "exp-failure-e2e", "e2e-admin"); const candidate = await repository.suppressionCandidate("raven-oracle", failed.memory.actionSignature); assert.equal(candidate.candidate, true); assert.equal(failed.memory.suppressed, false);
  const reused = await repository.recordReuse("raven-oracle", failed.memory.id, "e2e-admin", "replacement-action"); assert.equal(reused.reuseCount, 1); const replacementId = crypto.randomUUID(); const superseded = await repository.markSuperseded("raven-oracle", failed.memory.id, replacementId, "e2e-admin", "replacement"); assert.equal(superseded.supersededBy, replacementId); assert.equal(state.db.prepare("SELECT COUNT(*) AS count FROM growth_memory_relations WHERE tenant_id = 'raven-oracle'").get().count, 2);
  await assert.rejects(() => repository.list("unknown-tenant"), /Unknown tenant/); assert.equal((await repository.list("raven-oracle")).length, 1);
});

test("legacy experiments and memories remain compatible and tenants cannot leak", async () => {
  const state = fixture(); state.db.prepare("INSERT INTO growth_experiments (experiment_id, tenant_id, hypothesis, primary_metric) VALUES (?, ?, ?, ?)").run("legacy-e2e", "raven-oracle", "legacy", "conversion_rate"); state.db.prepare("INSERT INTO growth_knowledge_items (id, tenant_id, item_type, title, content) VALUES (?, ?, ?, ?, ?)").run("legacy-memory-e2e", "raven-oracle", "manual", "Legacy", "Legacy content");
  const memory = await new GrowthMemoryRepository(state.adapter).get("raven-oracle", "legacy-memory-e2e"); assert.equal(memory.successLevel, "inconclusive"); assert.equal(state.db.prepare("SELECT proposal_id, hypothesis_id, risk_class FROM growth_experiments WHERE experiment_id = ?").get("legacy-e2e").proposal_id, null); await assert.rejects(() => new GrowthMemoryRepository(state.adapter).get("tenant-b", "legacy-memory-e2e"), /Unknown tenant/);
});
