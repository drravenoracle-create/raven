import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { EvidenceAssessmentService } from "../app/lib/growth-evidence-assessment.ts";
import { GrowthHypothesisService, HypothesisRepository } from "../app/lib/growth-hypothesis.ts";

const asOf = "2026-08-24T00:00:00.000Z";

function source(id, type) {
  return { sourceId: id, tenantId: "raven-oracle", sourceType: type, sourceName: id, status: "active", market: "jp", country: "JP", locale: "ja-JP", observedAt: "2026-08-23T00:00:00.000Z", retrievedAt: "2026-08-23T00:00:00.000Z", sourceUrl: `https://example.test/${id}` };
}

function claim(id, sourceId, scope) {
  return { claimId: id, tenantId: "raven-oracle", sourceId, evidenceScope: scope, claimType: "metric", statement: id, metricName: "conversion_rate", metricValue: 10, market: "jp", country: "JP", locale: "ja-JP", confidence: null };
}

function input(sources, claims, riskClass = "MEDIUM") {
  return {
    hypothesisId: `hyp-${Math.random().toString(16).slice(2)}`,
    observation: "複数の観測で同じ傾向が確認された",
    hypothesis: "対象導線の改善により指標が改善する可能性がある",
    expectedOutcome: "conversion_rateが改善する",
    targetMetric: "conversion_rate",
    sources,
    claims,
    context: { tenantId: "raven-oracle", market: "jp", country: "JP", locale: "ja-JP", asOf },
    riskClass,
  };
}

function dbAdapter(db) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          const statement = db.prepare(sql);
          return {
            async all() { return { results: statement.all(...values) }; },
            async first() { return statement.get(...values) || null; },
            async run() { return statement.run(...values); },
          };
        },
      };
    },
  };
}

function repository() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../drizzle/0029_growth_hypotheses.sql", import.meta.url), "utf8"));
  return new HypothesisRepository(dbAdapter(db));
}

test("INSUFFICIENT blocks hypothesis creation and returns missing evidence", async () => {
  const service = new GrowthHypothesisService({ create: async () => { throw new Error("must not write"); } });
  const result = await service.createDraft(input([], []));
  assert.equal(result.created, false);
  assert.equal(result.reason, "insufficient_evidence");
  assert.ok(result.missingEvidence.length > 0);
});

test("WEAK evidence does not create a strong hypothesis", async () => {
  const repo = { create: async () => { throw new Error("must not write"); } };
  const service = new GrowthHypothesisService(repo);
  const result = await service.createDraft(input([source("one", "first_party_actual")], [claim("one-claim", "one", "internal_observation")]));
  assert.equal(result.created, false);
  assert.equal(result.reason, "insufficient_evidence");
});

test("MODERATE evidence creates a draft hypothesis with bounded confidence", async () => {
  const repo = repository();
  const service = new GrowthHypothesisService(repo);
  const sources = [source("internal", "first_party_actual"), source("experiment", "experiment_result")];
  const result = await service.createDraft(input(sources, [claim("internal-claim", "internal", "internal_observation"), claim("experiment-claim", "experiment", "experiment_result")]));
  assert.equal(result.created, true);
  assert.equal(result.hypothesis.evidenceSufficiency, "MODERATE");
  assert.equal(result.hypothesis.status, "draft");
  assert.ok(result.hypothesis.confidence <= 60);
});

test("STRONG evidence creates a stronger draft without experiment creation", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../drizzle/0029_growth_hypotheses.sql", import.meta.url), "utf8"));
  const repo = new HypothesisRepository(dbAdapter(db));
  const service = new GrowthHypothesisService(repo);
  const sources = [source("internal", "first_party_actual"), source("experiment", "experiment_result"), source("external", "primary_research")];
  const result = await service.createDraft(input(sources, [claim("c1", "internal", "internal_observation"), claim("c2", "experiment", "experiment_result"), claim("c3", "external", "external_primary")], "HIGH"));
  assert.equal(result.created, true);
  assert.equal(result.hypothesis.evidenceSufficiency, "STRONG");
  assert.equal(result.hypothesis.status, "draft");
  assert.equal(result.assessment.humanApprovalRequired, true);
  assert.equal(result.assessment.executionAllowed, false);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'growth_experiments'").get().count, 0);
});

test("hypothesis stores evidence ids and market/locale boundary", async () => {
  const repo = repository();
  const service = new GrowthHypothesisService(repo);
  const sources = [source("internal", "first_party_actual"), source("experiment", "experiment_result")];
  const result = await service.createDraft({ ...input(sources, [claim("c1", "internal", "internal_observation"), claim("c2", "experiment", "experiment_result")]), hypothesisId: "hyp-market" });
  const stored = await repo.get("raven-oracle", "hyp-market");
  assert.equal(result.created, true);
  assert.deepEqual(stored.evidenceIds.sort(), ["c1", "c2"]);
  assert.equal(stored.market, "jp");
  assert.equal(stored.locale, "ja-JP");
});

test("unknown tenant is rejected and never falls back to Raven", async () => {
  const repo = repository();
  await assert.rejects(() => repo.list("unknown-tenant"), /Unknown tenant/);
  const service = new GrowthHypothesisService(repo);
  await assert.rejects(() => service.createDraft({ ...input([], []), context: { tenantId: "unknown-tenant", asOf } }), /Unknown tenant/);
});

test("hypothesis repository isolates tenant reads", async () => {
  const repo = repository();
  await repo.create({ hypothesisId: "raven-hyp", tenantId: "raven-oracle", observation: "obs", hypothesis: "hyp", expectedOutcome: "outcome", targetMetric: "metric", evidenceIds: [], confidence: 40, evidenceSufficiency: "MODERATE", riskClass: "LOW", missingEvidence: [], status: "draft" });
  assert.ok(await repo.get("raven-oracle", "raven-hyp"));
  await assert.rejects(() => repo.get("unknown-tenant", "raven-hyp"), /Unknown tenant/);
});

test("assessment remains assessment-only for CRITICAL decisions", async () => {
  const repo = repository();
  const service = new GrowthHypothesisService(repo);
  const sources = [source("internal", "first_party_actual"), source("experiment", "experiment_result")];
  const result = await service.createDraft({ ...input(sources, [claim("c1", "internal", "internal_observation"), claim("c2", "experiment", "experiment_result")], "CRITICAL"), hypothesisId: "critical-hyp" });
  assert.equal(result.created, true);
  assert.equal(result.assessment.meetsRiskRequirement, false);
  assert.equal(result.assessment.executionAllowed, false);
});

test("migration is additive and idempotent", () => {
  const db = new DatabaseSync(":memory:");
  const sql = readFileSync(new URL("../drizzle/0029_growth_hypotheses.sql", import.meta.url), "utf8");
  db.exec("CREATE TABLE growth_experiments (experiment_id TEXT PRIMARY KEY);");
  db.exec(sql);
  db.exec(sql);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='growth_hypotheses'").get().name, "growth_hypotheses");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='index' AND name LIKE 'idx_growth_hypotheses_%'").get().count, 2);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='growth_experiments'").get().name, "growth_experiments");
});
