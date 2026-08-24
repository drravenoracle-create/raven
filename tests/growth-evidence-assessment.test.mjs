import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceAssessmentService } from "../app/lib/growth-evidence-assessment.ts";

const service = new EvidenceAssessmentService();
const asOf = "2026-08-24T00:00:00.000Z";

function source(id, sourceType, options = {}) {
  return {
    sourceId: id,
    tenantId: options.tenantId || "raven-oracle",
    sourceType,
    sourceName: options.sourceName || id,
    status: options.status || "active",
    qualityScore: options.qualityScore ?? null,
    market: options.market || "jp",
    country: options.country || "JP",
    locale: options.locale || "ja-JP",
    observedAt: options.observedAt === undefined ? "2026-08-23T00:00:00.000Z" : options.observedAt,
    retrievedAt: options.retrievedAt === undefined ? "2026-08-23T00:00:00.000Z" : options.retrievedAt,
    validUntil: options.validUntil ?? null,
    sourceUrl: options.sourceUrl || `https://example.test/${id}`,
  };
}

function claim(id, sourceId, evidenceScope, options = {}) {
  return {
    claimId: id,
    tenantId: options.tenantId || "raven-oracle",
    sourceId,
    evidenceScope,
    claimType: "metric",
    statement: options.statement || id,
    metricName: "conversion_rate",
    metricValue: 10,
    market: options.market || "jp",
    country: options.country || "JP",
    locale: options.locale || "ja-JP",
    confidence: options.confidence ?? null,
  };
}

function assess(sources, claims, riskClass = "LOW", context = {}) {
  return service.assess({
    sources,
    claims,
    context: { tenantId: "raven-oracle", market: "jp", country: "JP", locale: "ja-JP", asOf, ...context },
    riskClass,
  });
}

test("no evidence is INSUFFICIENT and explains missing evidence", () => {
  const result = assess([], []);
  assert.equal(result.sufficiency, "INSUFFICIENT");
  assert.ok(result.missingEvidence.includes("need_internal_observation"));
  assert.ok(result.reasons.length > 0);
});

test("one model inference cannot be STRONG", () => {
  const result = assess([source("model-1", "model_inference")], [claim("claim-1", "model-1", "model_inference")]);
  assert.notEqual(result.sufficiency, "STRONG");
  assert.ok(result.missingEvidence.includes("need_internal_observation"));
});

test("multiple model inferences remain diversity-limited", () => {
  const sources = [source("model-1", "model_inference"), source("model-2", "model_inference"), source("model-3", "model_inference")];
  const result = assess(sources, sources.map((item, index) => claim(`claim-${index}`, item.sourceId, "model_inference")));
  assert.notEqual(result.sufficiency, "STRONG");
  assert.equal(result.diversity.scopeCount, 1);
  assert.ok(result.missingEvidence.includes("need_scope_diversity"));
});

test("stale evidence cannot be STRONG", () => {
  const sources = [
    source("old-internal", "first_party_actual", { observedAt: "2025-01-01T00:00:00.000Z", retrievedAt: null }),
    source("old-experiment", "experiment_result", { observedAt: "2025-01-01T00:00:00.000Z", retrievedAt: null }),
    source("old-external", "primary_research", { observedAt: "2025-01-01T00:00:00.000Z", retrievedAt: null }),
  ];
  const result = assess(sources, sources.map((item, index) => claim(`claim-${index}`, item.sourceId, ["internal_observation", "experiment_result", "external_primary"][index])));
  assert.notEqual(result.sufficiency, "STRONG");
  assert.ok(result.missingEvidence.includes("need_fresher_source"));
});

test("expired evidence is excluded and warned", () => {
  const result = assess([source("expired", "first_party_actual", { validUntil: "2026-08-23T00:00:00.000Z" })], [claim("expired-claim", "expired", "internal_observation")]);
  assert.equal(result.sufficiency, "INSUFFICIENT");
  assert.ok(result.warnings.some((warning) => warning.includes("expired")));
});

test("internal observation plus experiment result raises strength to MODERATE", () => {
  const sources = [source("internal", "first_party_actual"), source("experiment", "experiment_result")];
  const result = assess(sources, [claim("c-internal", "internal", "internal_observation"), claim("c-experiment", "experiment", "experiment_result")]);
  assert.equal(result.sufficiency, "MODERATE");
  assert.ok(result.diversity.scopeCount >= 2);
});

test("internal, experiment and external primary evidence is a STRONG candidate", () => {
  const sources = [source("internal", "first_party_actual"), source("experiment", "experiment_result"), source("external", "primary_research")];
  const result = assess(sources, [
    claim("c-internal", "internal", "internal_observation"),
    claim("c-experiment", "experiment", "experiment_result"),
    claim("c-external", "external", "external_primary"),
  ], "MEDIUM");
  assert.equal(result.sufficiency, "STRONG");
  assert.equal(result.meetsRiskRequirement, true);
});

test("market mismatch lowers relevance and requests target-market evidence", () => {
  const result = assess([source("us", "first_party_actual", { market: "us", country: "US", locale: "en-US" })], [claim("us-claim", "us", "internal_observation", { market: "us", country: "US", locale: "en-US" })]);
  assert.ok(result.relevance.score < 1);
  assert.ok(result.missingEvidence.includes("need_target_market_evidence"));
});

test("locale mismatch produces a relevance warning", () => {
  const result = assess([source("en", "first_party_actual", { locale: "en-US" })], [claim("en-claim", "en", "internal_observation", { locale: "en-US" })]);
  assert.ok(result.relevance.score < 1);
  assert.ok(result.relevance.warnings.includes("target locale evidence is missing"));
});

test("mixed tenants are rejected", () => {
  assert.throws(() => assess([source("other", "first_party_actual", { tenantId: "other-tenant" })], []), /tenant mixing/);
});

test("unknown tenant remains an explicit error at the repository boundary", () => {
  assert.throws(() => service.assess({ sources: [], claims: [], context: { tenantId: "unknown-tenant", asOf }, riskClass: "LOW" }), /does not|Unknown|tenant/i);
});

test("CRITICAL with MODERATE evidence is not executable", () => {
  const sources = [source("internal", "first_party_actual"), source("experiment", "experiment_result")];
  const result = assess(sources, [claim("c1", "internal", "internal_observation"), claim("c2", "experiment", "experiment_result")], "CRITICAL");
  assert.equal(result.sufficiency, "MODERATE");
  assert.equal(result.meetsRiskRequirement, false);
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.executionAllowed, false);
});

test("STRONG evidence still preserves human approval boundary for HIGH risk", () => {
  const sources = [source("internal", "first_party_actual"), source("experiment", "experiment_result"), source("external", "primary_research")];
  const result = assess(sources, [claim("c1", "internal", "internal_observation"), claim("c2", "experiment", "experiment_result"), claim("c3", "external", "external_primary")], "HIGH");
  assert.equal(result.sufficiency, "STRONG");
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.executionAllowed, false);
});

test("missing evidence is structured", () => {
  const result = assess([source("internal", "first_party_actual")], [claim("c1", "internal", "internal_observation")], "HIGH");
  assert.ok(Array.isArray(result.missingEvidence));
  assert.ok(result.missingEvidence.includes("need_experiment_result"));
  assert.ok(result.missingEvidence.includes("need_external_primary"));
});

test("null quality and confidence are safe and remain unevaluated inputs", () => {
  const result = assess([source("nulls", "first_party_actual", { qualityScore: null })], [claim("null-claim", "nulls", "internal_observation", { confidence: null })]);
  assert.equal(result.quality[0].sourceReliability, 90);
  assert.equal(result.quality[0].freshness, "fresh");
  assert.ok(result.sufficiency === "WEAK" || result.sufficiency === "INSUFFICIENT");
});
