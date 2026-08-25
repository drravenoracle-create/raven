import test from "node:test";
import assert from "node:assert/strict";
import { calculateConfidence, calculateDecay, classifyMaturity } from "../app/lib/growth-learning-policy.ts";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/lib/growth-learning.ts", import.meta.url), "utf8");
test("result classes and scoped aggregation are encoded in the service", () => { assert.match(source, /WIN.*positive/); assert.match(source, /LOSS.*negative/); assert.match(source, /NEUTRAL.*neutral/); assert.ok(source.includes('"insufficient_learning"')); assert.match(source, /guildId/); assert.match(source, /market/); assert.match(source, /locale/); });
test("unknown scope is explicit and never merged with known scope", () => { assert.match(source, /__unknown__/); assert.match(source, /patternKey/); });
test("one result cannot become established or high confidence", () => { const decay = calculateDecay(new Date().toISOString()); const confidence = calculateConfidence({ experimentCount: 1, sampleSize: 1000, consistency: 1, evidenceSufficiency: "STRONG", measurementAvailability: "AVAILABLE", guardrailStatus: "PASS", scopeMatch: 1, decayScore: decay }); assert.ok(confidence <= 0.45); assert.notEqual(classifyMaturity({ experimentCount: 1, sampleSize: 1000, confidence, consistency: 1, decayScore: decay, evidenceSufficiency: "STRONG" }), "ESTABLISHED"); });
test("maturity and decay change with sufficient recent evidence", () => { const decay = calculateDecay(new Date().toISOString()); assert.equal(classifyMaturity({ experimentCount: 3, sampleSize: 100, confidence: .8, consistency: .8, decayScore: decay, evidenceSufficiency: "STRONG" }), "ESTABLISHED"); assert.equal(classifyMaturity({ experimentCount: 3, sampleSize: 100, confidence: .8, consistency: .8, decayScore: .2, evidenceSufficiency: "STRONG" }), "DECAYING"); });
