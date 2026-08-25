import { GROWTH_ENGINE_TENANT_ID } from "./growth-engine.ts";
import { listRecommendations } from "./growth-recommendations.ts";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }>; first<T = unknown>(): Promise<T | null>; run(): Promise<unknown> } } };
type Recommendation = Record<string, unknown> & { patternKey: string; recommendationType: string; primaryGoal: string; reason: string; scope: Record<string, string>; stateFingerprint: string; recommendationId: string | null; status: string; traceability: { supportingEvidence: Array<{ sourceId: string; claimIds: string[] }>; missingEvidence: string[]; experimentCount: number; sampleSize: number; confidence: number; maturity: string; lastTestedAt: string | null; decayScore: number } };
type Idea = Record<string, unknown> & { idea_candidate_id: string; tenant_id: string; source_recommendation_id: string; source_pattern_key: string; state_fingerprint: string; status: string };
const json = (value: unknown) => JSON.stringify(value ?? {});
const recommendationId = (item: Recommendation) => item.recommendationId || `recommendation:${item.patternKey}:${item.stateFingerprint}`;

function variation(item: Recommendation) {
  const scope = item.scope;
  if (item.recommendationType === "PROVEN_REUSE") return { changed: ["hook_style"], reason: "勝ちPatternを複製せずHookを変えて派生検証" };
  if (item.recommendationType === "IMPROVEMENT_TEST") return { changed: ["hook_style"], reason: "弱かった要素を1つだけ変更" };
  if (item.recommendationType === "RETEST_DECAYING") return { changed: ["posting_time"], reason: "古いPatternを現在の投稿時間で再検証" };
  if (item.recommendationType === "EMERGING_TEST") return { changed: ["cta"], reason: "Emerging PatternをCTA変更で追加検証" };
  return { changed: ["topic"], reason: `Evidence不足を埋めるため${scope.metric || "対象metric"}を観測` };
}

export function buildIdeaCandidate(item: Recommendation) {
  const v = variation(item); const scope = item.scope; const avoid = item.recommendationType === "AVOID_FOR_NOW";
  const title = `${scope.topic === "__unknown__" ? "次の検証テーマ" : scope.topic}｜${item.recommendationType}`;
  return { sourceRecommendationId: recommendationId(item), sourcePatternKey: item.patternKey, stateFingerprint: item.stateFingerprint, primaryGoal: item.primaryGoal, category: scope.topicCategory, topic: scope.topic, hookStyle: scope.hookStyle, cta: scope.cta, template: scope.template, tenant: scope.tenantId, guild: scope.guildId, character: scope.characterId, market: scope.market, country: scope.country, locale: scope.locale, platform: scope.platform, title, recommendationType: item.recommendationType, novelty: avoid ? 0 : v.changed.length ? 0.7 : 0.4, confidence: item.traceability.confidence, maturity: item.traceability.maturity, reason: item.reason, supportingEvidence: item.traceability.supportingEvidence, missingEvidence: item.traceability.missingEvidence, variation: v, experimentability: { whatToTest: v.changed, targetMetric: scope.metric, recommendationType: item.recommendationType }, avoidForNow: avoid };
}

export async function listIdeaCandidates(db: D1, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const recommendations = await listRecommendations(db, tenantId) as Recommendation[]; const results: Array<Record<string, unknown>> = [];
  for (const item of recommendations) {
    if (item.recommendationType === "AVOID_FOR_NOW") continue;
    const candidate = buildIdeaCandidate(item); const stored = await db.prepare("SELECT * FROM growth_sns_idea_candidates WHERE tenant_id = ? AND source_recommendation_id = ? AND state_fingerprint = ? LIMIT 1").bind(tenantId, candidate.sourceRecommendationId, candidate.stateFingerprint).first<Idea>();
    results.push({ ...candidate, ideaCandidateId: stored?.idea_candidate_id || null, status: stored?.status || "SUGGESTED", createdAt: stored?.created_at || null, updatedAt: stored?.updated_at || null });
  }
  return results;
}

export async function reviewIdeaCandidate(db: D1, sourcePatternKey: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID, status: "SAVED" | "DISMISSED" = "SAVED") {
  const recommendations = await listRecommendations(db, tenantId) as Recommendation[]; const item = recommendations.find((candidate) => candidate.patternKey === sourcePatternKey);
  if (!item) throw new Error("Recommendation pattern not found for this tenant.");
  if (item.recommendationType === "AVOID_FOR_NOW") throw new Error("AVOID_FOR_NOW is not promoted to a normal Idea Candidate.");
  const candidate = buildIdeaCandidate(item); const id = crypto.randomUUID();
  await db.prepare("INSERT INTO growth_sns_idea_candidates (idea_candidate_id, tenant_id, source_recommendation_id, source_pattern_key, state_fingerprint, status, primary_goal, category, topic, hook_style, cta, template, variation_json, experimentability_json, novelty, confidence, maturity, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, source_recommendation_id, state_fingerprint) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP, payload_json = excluded.payload_json").bind(id, tenantId, candidate.sourceRecommendationId, candidate.sourcePatternKey, candidate.stateFingerprint, status, candidate.primaryGoal, candidate.category, candidate.topic, candidate.hookStyle, candidate.cta, candidate.template, json(candidate.variation), json(candidate.experimentability), candidate.novelty, candidate.confidence, candidate.maturity, json({ ...candidate, actor: String(input.actor || "admin") })).run();
  return db.prepare("SELECT * FROM growth_sns_idea_candidates WHERE tenant_id = ? AND source_pattern_key = ? AND state_fingerprint = ? LIMIT 1").bind(tenantId, sourcePatternKey, candidate.stateFingerprint).first();
}
