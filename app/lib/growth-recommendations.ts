import { GROWTH_ENGINE_TENANT_ID } from "./growth-engine.ts";
import { getLearningPatterns, getLearningSummary } from "./growth-learning.ts";
import { primaryGoal, recommendationPriority, recommendationType, stateFingerprint } from "./growth-recommendation-policy.ts";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }>; first<T = unknown>(): Promise<T | null>; run(): Promise<unknown> } } };
type Pattern = Record<string, unknown> & { patternKey: string; scope: Record<string, string>; resultClass: string; maturity: string; confidence: number; evidenceSufficiency: string; experimentCount: number; sampleSize: number; consistency: number; decayScore: number; metricAvailability: string; revenueKinds: string[]; lastTestedAt: string | null; missingEvidence: string[]; supportingEvidence: Array<{ sourceId: string; claimIds: string[] }>; resultDistribution: Record<string, number> };
const json = (value: unknown) => JSON.stringify(value ?? {});

function reason(pattern: Pattern, type: string) { const reasons: string[] = [`${pattern.maturity} / ${pattern.resultClass} pattern`, `confidence ${pattern.confidence}`, `experiment ${pattern.experimentCount}, sample ${pattern.sampleSize}`, `consistency ${pattern.consistency}, decay ${pattern.decayScore}`]; if (type === "COLLECT_MORE_EVIDENCE") reasons.push("Evidence sufficiencyまたは測定可能性が不足しています。"); if (type === "IMPROVEMENT_TEST") reasons.push("負の結果が優勢、または最近の反復使用が多いため改善テストを優先します。"); return reasons.join("。 "); }

export function buildRecommendation(pattern: Pattern, now = new Date()) { const type = recommendationType(pattern, now); return { patternKey: pattern.patternKey, recommendationType: type, priority: recommendationPriority(pattern, now), primaryGoal: primaryGoal(pattern), reason: reason(pattern, type), scope: pattern.scope, traceability: { supportingEvidence: pattern.supportingEvidence, missingEvidence: pattern.missingEvidence, experimentCount: pattern.experimentCount, sampleSize: pattern.sampleSize, confidence: pattern.confidence, maturity: pattern.maturity, lastTestedAt: pattern.lastTestedAt, decayScore: pattern.decayScore }, stateFingerprint: stateFingerprint(pattern), pattern };
}

export async function listRecommendations(db: D1, tenantId = GROWTH_ENGINE_TENANT_ID, filters: Record<string, string | null> = {}) {
  const patterns = await getLearningPatterns(db, tenantId, filters);
  const results = [];
  for (const pattern of patterns as Pattern[]) {
    const candidate = buildRecommendation(pattern);
    const stored = await db.prepare("SELECT recommendation_id, status, created_at, updated_at FROM growth_learning_recommendations WHERE tenant_id = ? AND pattern_key = ? AND state_fingerprint = ? LIMIT 1").bind(tenantId, candidate.patternKey, candidate.stateFingerprint).first<Record<string, unknown>>();
    results.push({ ...candidate, recommendationId: stored?.recommendation_id || null, status: stored?.status || "SUGGESTED", createdAt: stored?.created_at || null, updatedAt: stored?.updated_at || null });
  }
  return results.sort((a, b) => b.priority - a.priority);
}

export async function saveRecommendation(db: D1, patternKey: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID, status: "SAVED" | "DISMISSED" = "SAVED") {
  const patterns = await getLearningPatterns(db, tenantId, { });
  const pattern = (patterns as Pattern[]).find((item) => item.patternKey === patternKey);
  if (!pattern) throw new Error("Pattern not found for this tenant.");
  const candidate = buildRecommendation(pattern);
  if (candidate.patternKey !== patternKey) throw new Error("Pattern scope mismatch.");
  const existing = await db.prepare("SELECT recommendation_id FROM growth_learning_recommendations WHERE tenant_id = ? AND pattern_key = ? AND state_fingerprint = ? LIMIT 1").bind(tenantId, patternKey, candidate.stateFingerprint).first<{ recommendation_id: string }>();
  const id = existing?.recommendation_id || crypto.randomUUID();
  await db.prepare("INSERT INTO growth_learning_recommendations (recommendation_id, tenant_id, pattern_key, recommendation_type, priority, primary_goal, status, state_fingerprint, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, pattern_key, state_fingerprint) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP, payload_json = excluded.payload_json").bind(id, tenantId, patternKey, candidate.recommendationType, candidate.priority, candidate.primaryGoal, status, candidate.stateFingerprint, json({ ...candidate, actor: String(input.actor || "admin") })).run();
  return db.prepare("SELECT * FROM growth_learning_recommendations WHERE tenant_id = ? AND recommendation_id = ?").bind(tenantId, id).first();
}

export async function getRecommendationSummary(db: D1, tenantId = GROWTH_ENGINE_TENANT_ID) { const recommendations = await listRecommendations(db, tenantId); return { ...(await getLearningSummary(db, tenantId)), recommendationCount: recommendations.length, statusDistribution: recommendations.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {}) }; }
