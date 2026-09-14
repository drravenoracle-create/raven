import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { assertEvidenceTenant, buildEvidenceDecision, evaluateEvidence, isEvidenceApplicable } = await import("../app/lib/evidence-layer.ts");

const NOW = new Date("2026-08-24T00:00:00.000Z");
const TARGET = { tenantId: "raven-oracle", guildId: "raven-guild", market: "JP", country: "JP", locale: "ja-JP" };

function record(sourceType, id, overrides = {}, relevanceScore = 0.9) {
  return {
    source: {
      sourceId: id, tenantId: TARGET.tenantId, guildId: TARGET.guildId, market: TARGET.market, country: TARGET.country, locale: TARGET.locale,
      sourceType, title: id, observedAt: "2026-08-20T00:00:00.000Z", retrievedAt: "2026-08-20T00:00:00.000Z", ...overrides,
    },
    claims: [{ claimId: `${id}-claim`, sourceId: id, tenantId: TARGET.tenantId, guildId: TARGET.guildId, market: TARGET.market, country: TARGET.country, locale: TARGET.locale, claimType: "observation", statement: "測定された事実", relevanceScore, confidence: 0.9 }],
  };
}

describe("Evidence Layer Phase 2", () => {
  it("defines source and claim tables with a 1:N relation", () => {
    const sql = readFileSync("drizzle/0026_evidence_layer.sql", "utf8");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS evidence_sources/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS evidence_claims/);
    assert.match(sql, /source_id TEXT NOT NULL/);
    assert.match(sql, /FOREIGN KEY \(source_id\) REFERENCES evidence_sources\(source_id\) ON DELETE CASCADE/);
    for (const file of [
      "app/api/evidence/sources/route.ts",
      "app/api/evidence/claims/route.ts",
      "app/api/evidence/evaluate/route.ts",
    ]) assert.match(readFileSync(file, "utf8"), /requireEvidenceAdmin/);
  });

  it("rejects unknown tenants and keeps scope applicability explicit", () => {
    assert.throws(() => assertEvidenceTenant("unknown", "raven-oracle"), /Unknown or invalid tenant/);
    assert.equal(isEvidenceApplicable(record("analytics", "jp").source, TARGET), true);
    assert.equal(isEvidenceApplicable(record("analytics", "us", { market: "US", country: "US", locale: "en-US" }).source, TARGET), false);
  });

  it("returns INSUFFICIENT without applicable evidence", () => {
    const result = evaluateEvidence([], TARGET, NOW);
    assert.equal(result.level, "INSUFFICIENT");
    assert.ok(result.missingEvidence.some((item) => item.type === "need_internal_observation"));
  });

  it("does not make model inference evidence STRONG", () => {
    const result = evaluateEvidence(["a", "b", "c", "d"].map((id) => record("model_inference", id)), TARGET, NOW);
    assert.notEqual(result.level, "STRONG");
    assert.ok(result.warnings.some((warning) => warning.includes("model_inference")));
    assert.ok(result.missingEvidence.some((item) => item.type === "need_non_model_evidence"));
  });

  it("detects stale and expired evidence", () => {
    const stale = evaluateEvidence([record("analytics", "stale", { observedAt: "2025-01-01T00:00:00.000Z" })], TARGET, NOW);
    assert.equal(stale.freshness.status, "stale");
    assert.notEqual(stale.level, "STRONG");
    const expired = evaluateEvidence([record("analytics", "expired", { validUntil: "2026-08-01T00:00:00.000Z" })], TARGET, NOW);
    assert.equal(expired.freshness.status, "expired");
    assert.ok(expired.warnings.length > 0);
  });

  it("raises sufficiency with diverse current non-model evidence", () => {
    const result = evaluateEvidence([
      record("internal_observation", "internal"),
      record("experiment_result", "experiment"),
      record("external_primary", "primary"),
    ], TARGET, NOW);
    assert.equal(result.level, "STRONG");
    assert.equal(result.diversity.nonModelCount, 3);
    assert.equal(result.freshness.status, "fresh");
  });

  it("reports market and locale mismatch instead of transferring strength", () => {
    const result = evaluateEvidence([record("external_primary", "us", { market: "US", country: "US", locale: "en-US" })], TARGET, NOW);
    assert.equal(result.level, "INSUFFICIENT");
    assert.ok(result.missingEvidence.some((item) => item.type === "need_target_market_evidence"));
    assert.ok(result.warnings.some((warning) => warning.includes("除外")));
  });

  it("separates sufficiency from risk and authorization", () => {
    const strong = [record("internal_observation", "internal"), record("experiment_result", "experiment"), record("external_primary", "primary")];
    const low = buildEvidenceDecision(strong, TARGET, "LOW", "NOT_REQUIRED", NOW);
    assert.equal(low.decision, "GO");
    assert.equal(low.canProceed, true);
    const high = buildEvidenceDecision(strong, TARGET, "HIGH", "NOT_REQUIRED", NOW);
    assert.equal(high.decision, "REQUIRE_APPROVAL");
    assert.equal(high.canProceed, false);
    const insufficient = buildEvidenceDecision([], TARGET, "LOW", "NOT_REQUIRED", NOW);
    assert.equal(insufficient.decision, "INSUFFICIENT_EVIDENCE");
    const approved = buildEvidenceDecision([record("internal_observation", "one"), record("experiment_result", "two")], TARGET, "HIGH", "APPROVED", NOW);
    assert.equal(approved.authorizationRequired, true);
    assert.equal(approved.canProceed, true);
  });
});
