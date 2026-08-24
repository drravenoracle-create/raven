import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EVIDENCE_SCOPES,
  EVIDENCE_SOURCE_STATUSES,
  EVIDENCE_SOURCE_TYPES,
  EvidenceRepository,
  sanitizeEvidenceMetadata,
  sanitizeEvidenceUrl,
} from "../app/lib/growth-evidence.ts";

function d1From(db) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() { return { results: db.prepare(sql).all(...values) }; },
            async first() { return db.prepare(sql).get(...values) || null; },
            async run() { return db.prepare(sql).run(...values); },
          };
        },
      };
    },
  };
}

async function createRepository() {
  const db = new DatabaseSync(":memory:");
  db.exec(await readFile(new URL("../drizzle/0028_growth_evidence_registry.sql", import.meta.url), "utf8"));
  return { db, repository: new EvidenceRepository(d1From(db)) };
}

test("Evidence contracts expose scopes, source types and statuses", () => {
  assert.deepEqual(EVIDENCE_SCOPES, ["internal_observation", "external_primary", "external_secondary", "experiment_result", "model_inference", "human_input"]);
  assert.ok(EVIDENCE_SOURCE_TYPES.includes("first_party_actual"));
  assert.ok(EVIDENCE_SOURCE_TYPES.includes("model_inference"));
  assert.deepEqual(EVIDENCE_SOURCE_STATUSES, ["active", "stale", "expired", "unavailable", "error"]);
});

test("Source and Claim are separated and one source can support multiple claims", async () => {
  const { db, repository } = await createRepository();
  const source = await repository.createSource({
    sourceId: "src-internal-1", tenantId: "raven-oracle", sourceType: "first_party_actual", provider: "analytics",
    sourceName: "Raven internal analytics", sourceUrl: "https://example.test/report?token=secret&range=30d",
    market: "jp", country: "JP", locale: "ja-JP", observedAt: "2026-08-24T00:00:00Z", qualityScore: null, status: "active",
    metadata: { access_token: "secret", range: "30d" },
  });
  assert.equal(source?.sourceId, "src-internal-1");
  assert.equal(source?.qualityScore, null);
  assert.doesNotMatch(source?.sourceUrl || "", /secret/);
  assert.equal(source?.metadata?.access_token, "[REDACTED]");
  await repository.createClaim({ claimId: "claim-1", tenantId: "raven-oracle", sourceId: "src-internal-1", evidenceScope: "internal_observation", claimType: "metric", statement: "Trial view was observed", metricName: "trial_view", metricValue: 2, unit: "count", market: "jp", locale: "ja-JP", confidence: null });
  await repository.createClaim({ claimId: "claim-2", tenantId: "raven-oracle", sourceId: "src-internal-1", evidenceScope: "internal_observation", claimType: "metric", statement: "CTA clicks were observed", metricName: "cta_click", metricValue: 3, unit: "count", market: "jp", locale: "ja-JP", confidence: 50 });
  assert.equal((await repository.listClaimsForSource("raven-oracle", "src-internal-1")).length, 2);
  db.close();
});

test("tenant isolation and unknown tenant handling are explicit", async () => {
  const { db, repository } = await createRepository();
  await assert.rejects(() => repository.listSources("unknown-tenant"), /Unknown tenant/);
  await repository.createSource({ sourceId: "src-raven", tenantId: "raven-oracle", sourceType: "official_statistics", sourceName: "External source", status: "active" });
  assert.deepEqual(await repository.listClaimsForTenant("raven-oracle"), []);
  assert.deepEqual(await repository.listSources("raven-oracle", { market: "us" }), []);
  db.close();
});

test("all evidence scopes remain distinguishable and freshness fields are retained", async () => {
  const { db, repository } = await createRepository();
  for (const [index, scope] of EVIDENCE_SCOPES.entries()) {
    const source = await repository.createSource({ sourceId: `src-${index}`, tenantId: "raven-oracle", sourceType: scope === "experiment_result" ? "experiment_result" : scope === "model_inference" ? "model_inference" : scope === "human_input" ? "human_input" : "first_party_actual", sourceName: scope, publishedAt: "2026-08-01T00:00:00Z", retrievedAt: "2026-08-02T00:00:00Z", observedAt: "2026-08-03T00:00:00Z", validUntil: "2026-09-01T00:00:00Z", status: index % 2 ? "stale" : "active" });
    await repository.createClaim({ claimId: `claim-${index}`, tenantId: "raven-oracle", sourceId: source.sourceId, evidenceScope: scope, claimType: "observation", statement: `${scope} claim` });
  }
  const claims = await repository.listClaimsForTenant("raven-oracle");
  assert.deepEqual(new Set(claims.map((claim) => claim.evidenceScope)), new Set(EVIDENCE_SCOPES));
  const sources = await repository.listSources("raven-oracle");
  assert.equal(sources[0].retrievedAt, "2026-08-02T00:00:00Z");
  assert.equal(sources.some((source) => source.status === "stale"), true);
  db.close();
});

test("secret sanitization removes token-like URL parameters and metadata values", () => {
  assert.equal(sanitizeEvidenceUrl("https://example.test/x?access_token=abc&market=jp"), "https://example.test/x?market=jp");
  assert.deepEqual(sanitizeEvidenceMetadata({ token: "abc", nested: { authorization: "Bearer abc", ok: true } }), { token: "[REDACTED]", nested: { authorization: "[REDACTED]", ok: true } });
});

test("migration is additive and idempotent", async () => {
  const db = new DatabaseSync(":memory:");
  const sql = await readFile(new URL("../drizzle/0028_growth_evidence_registry.sql", import.meta.url), "utf8");
  db.exec(sql);
  db.exec(sql);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name LIKE 'growth_evidence_%'").get().count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_growth_evidence_%'").get().count, 6);
  db.close();
});
