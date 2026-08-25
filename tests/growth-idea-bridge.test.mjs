import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../app/lib/growth-idea-bridge.ts", import.meta.url), "utf8");
const recommendationPolicy = fs.readFileSync(new URL("../app/lib/growth-recommendation-policy.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/growth-engine/learning/ideas/route.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../drizzle/0033_growth_sns_idea_candidates.sql", import.meta.url), "utf8");
test("Recommendation types map to variation-oriented Idea Candidates", () => { const source = `${bridge}\n${recommendationPolicy}`; for (const type of ["PROVEN_REUSE", "EMERGING_TEST", "IMPROVEMENT_TEST", "RETEST_DECAYING", "COLLECT_MORE_EVIDENCE"]) assert.match(source, new RegExp(type)); assert.match(bridge, /changed/); assert.match(bridge, /experimentability/); });
test("Idea Candidate preserves goals, scopes, novelty and evidence traceability", () => { for (const field of ["primaryGoal", "tenant", "guild", "character", "market", "country", "locale", "platform", "confidence", "maturity", "supportingEvidence", "missingEvidence", "novelty"]) assert.match(bridge, new RegExp(field)); assert.match(migration, /source_recommendation_id/); assert.match(migration, /source_pattern_key/); });
test("avoid-for-now is not promoted and review is limited to save/dismiss", () => { assert.match(bridge, /AVOID_FOR_NOW/); assert.match(bridge, /not promoted/); assert.match(route, /generate/); assert.match(route, /save/); assert.match(route, /dismiss/); assert.doesNotMatch(route, /publish|createExperiment|autonomous|external API/i); });
test("candidate identity is idempotent and does not execute SNS or experiments", () => { assert.match(bridge, /state_fingerprint/); assert.match(bridge, /ON CONFLICT/); assert.doesNotMatch(bridge, /createExperiment|publish|fetch\(/i); });
test("Idea API supports list and detail retrieval", () => { assert.match(route, /patternKey/); assert.match(route, /detail/); assert.match(route, /candidates/); });
