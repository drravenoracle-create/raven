import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../app/lib/growth-idea-bridge.ts", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../app/api/sns/ideas/generate/route.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../app/admin/sns/ideas/page.tsx", import.meta.url), "utf8");
test("planner generates ten persisted candidates with initial patterns", () => { assert.match(bridge, /for \(let index = 0; index < 10; index \+= 1\)/); assert.match(bridge, /INITIAL_IDEA_PATTERNS/); assert.match(bridge, /growth_sns_idea_candidates/); });
test("planner supports modes, filters and locale boundaries", () => { for (const value of ["BALANCED", "VIRAL", "CONVERSION", "EXPERIMENTAL", "BRAND", "instagram", "tiktok", "youtube", "ja", "en"]) assert.match(`${bridge}\n${ui}`, new RegExp(value)); assert.match(bridge, /Character Config/); assert.match(bridge, /locale/); });
test("planner keeps evidence and insufficient-data state explicit", () => { assert.match(bridge, /supportingEvidence/); assert.match(bridge, /need_larger_sample/); assert.match(bridge, /confidence: rec\?\.traceability\.confidence \|\| 0/); assert.match(bridge, /maturity: rec\?\.traceability\.maturity \|\| "PROVISIONAL"/); });
test("planner exposes only candidate generation and review, never execution", () => { assert.match(api, /POST/); assert.match(ui, /Save/); assert.match(ui, /Dismiss/); assert.doesNotMatch(`${api}\n${bridge}\n${ui}`, /createExperiment|publish|schedule|autonomous|external API/i); });
test("planner reuses the Idea Candidate table and prevents duplicate snapshots", () => { assert.match(bridge, /stateFingerprint/); assert.match(bridge, /ON CONFLICT/); assert.match(bridge, /sourceRecommendationId/); });
