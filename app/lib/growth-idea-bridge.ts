import { GROWTH_ENGINE_TENANT_ID } from "./growth-engine.ts";
import { listRecommendations } from "./growth-recommendations.ts";
import { getCharacterConfig } from "./character-config.ts";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }>; first<T = unknown>(): Promise<T | null>; run(): Promise<unknown> } } };
type Recommendation = Record<string, unknown> & { patternKey: string; recommendationType: string; primaryGoal: string; reason: string; scope: Record<string, string>; stateFingerprint: string; recommendationId: string | null; status: string; traceability: { supportingEvidence: Array<{ sourceId: string; claimIds: string[] }>; missingEvidence: string[]; experimentCount: number; sampleSize: number; confidence: number; maturity: string; lastTestedAt: string | null; decayScore: number } };
type Idea = Record<string, unknown> & { idea_candidate_id: string; tenant_id: string; source_recommendation_id: string; source_pattern_key: string; state_fingerprint: string; status: string; payload_json?: string };
const json = (value: unknown) => JSON.stringify(value ?? {});
const parse = (value: unknown): Record<string, unknown> => { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } };
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
    results.push({ ...candidate, ...parse(stored?.payload_json), ideaCandidateId: stored?.idea_candidate_id || null, status: stored?.status || "SUGGESTED", createdAt: stored?.created_at || null, updatedAt: stored?.updated_at || null });
  }
  const persisted = await db.prepare("SELECT * FROM growth_sns_idea_candidates WHERE tenant_id = ? ORDER BY datetime(updated_at) DESC LIMIT 100").bind(tenantId).all<Idea>();
  const seen = new Set(results.map((item) => `${item.sourcePatternKey}|${item.stateFingerprint}`));
  for (const item of persisted.results || []) { const key = `${item.source_pattern_key}|${item.state_fingerprint}`; if (!seen.has(key)) results.push({ ...parse(item.payload_json), ideaCandidateId: item.idea_candidate_id, sourcePatternKey: item.source_pattern_key, sourceRecommendationId: item.source_recommendation_id, stateFingerprint: item.state_fingerprint, status: item.status }); }
  return results;
}

const INITIAL_IDEA_PATTERNS = [
  ["今、あなたを密かに想っている人", "秘密型", "恋愛", "Pick a Card", "コメント参加"],
  ["72時間以内に起きること", "未来予告型", "近未来", "3択", "保存"],
  ["あの人が言えない本音", "質問型", "恋愛", "1枚引き", "コメント参加"],
  ["1枚だけ警告のカード", "警告型", "総合", "1枚引き", "保存"],
  ["未来を漢字一文字で", "好奇心型", "近未来", "1枚引き", "シェア"],
  ["カードを選ばない占い", "直接型", "自己成長", "Screenshot", "保存"],
  ["あなたの味方になるギルドメンバー", "物語型", "ギルド", "Story", "コメント参加"],
  ["スクショで止める運命のカード", "停止型", "総合", "Screenshot", "保存"],
  ["未来のあなたから届いた手紙", "感情型", "自己成長", "Story", "シェア"],
  ["ギルド世界観 × カード", "世界観型", "ギルド", "Story", "プロフィール"],
] as const;
const PLATFORMS = new Set(["instagram", "tiktok", "youtube"]);
const MODES = new Set(["BALANCED", "VIRAL", "CONVERSION", "EXPERIMENTAL", "BRAND"]);
const PRIMARY_GOALS = new Set(["VIRAL", "CONVERSION", "REVENUE", "LEARNING"]);
const CATEGORIES = new Set(["恋愛", "仕事", "金運", "総合", "近未来", "自己成長", "ギルド"]);

function normalizePlannerInput(input: Record<string, unknown>) {
  const characterId = String(input.characterId ?? input.character_id ?? "AUTO"); const character = characterId === "AUTO" ? getCharacterConfig() : getCharacterConfig(characterId);
  if (!character) throw new Error("指定されたCharacterはCharacter Configに存在しません。");
  const requestedPlatform = String(input.platform || "AUTO").toLowerCase(); const platform = requestedPlatform === "auto" ? "instagram" : requestedPlatform;
  if (!PLATFORMS.has(platform)) throw new Error("Unsupported platform.");
  const locale = String(input.locale || "ja"); if (!new Set(["ja", "en"]).has(locale)) throw new Error("Unsupported locale.");
  const category = String(input.category || "AUTO"); if (category !== "AUTO" && !CATEGORIES.has(category)) throw new Error("Unsupported category.");
  const mode = String(input.ideaMode || input.mode || "BALANCED").toUpperCase(); if (!MODES.has(mode)) throw new Error("Unsupported idea mode.");
  const requestedGoal = String(input.primaryGoal || input.primary_goal || "").toUpperCase();
  if (requestedGoal && !PRIMARY_GOALS.has(requestedGoal)) throw new Error("Unsupported primary goal.");
  const goal = requestedGoal || (mode === "VIRAL" ? "VIRAL" : mode === "CONVERSION" ? "CONVERSION" : "LEARNING");
  return { character, platform, locale, category, mode, goal };
}

function plannerFingerprint(input: ReturnType<typeof normalizePlannerInput>) { return `planner:${input.character.id}:${input.platform}:${input.locale}:${input.category}:${input.mode}`; }

export async function generateIdeaCandidates(db: D1, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const settings = normalizePlannerInput(input); const base = plannerFingerprint(settings); const recommendations = await listRecommendations(db, tenantId) as Recommendation[];
  const selected = [...INITIAL_IDEA_PATTERNS].filter((item) => settings.category === "AUTO" || item[2] === settings.category);
  const pool = selected.length ? selected : [...INITIAL_IDEA_PATTERNS];
  const ideas: Array<Record<string, unknown>> = [];
  for (let index = 0; index < 10; index += 1) {
    const item = pool[index % pool.length]; const rec = recommendations.find((candidate) => candidate.scope.locale === settings.locale && candidate.scope.platform === settings.platform && (settings.category === "AUTO" || candidate.scope.topicCategory === settings.category));
    const topic = settings.locale === "en" ? `A message about ${item[0]}` : item[0]; const modeGoal = settings.goal || rec?.primaryGoal || "LEARNING";
    const sourcePatternKey = rec?.patternKey || `${base}:pattern:${index}`; const sourceRecommendationId = rec?.recommendationId || `${base}:recommendation:${index}`; const stateFingerprint = `${base}:${index}:${rec?.stateFingerprint || "insufficient"}`;
    const candidate = { sourceRecommendationId, sourcePatternKey, stateFingerprint, primaryGoal: modeGoal, category: settings.category === "AUTO" ? item[2] : settings.category, topic, hookStyle: item[1], cta: item[4], template: item[3], tenant: tenantId, guild: rec?.scope.guildId || "__unknown__", character: settings.character.id, market: settings.locale === "ja" ? "JP" : "US", country: settings.locale === "ja" ? "JP" : "US", locale: settings.locale, platform: settings.platform, title: `${topic}｜${settings.character.displayName}`, contentType: item[3], interactionStyle: item[4], recommendedDuration: settings.platform === "youtube" ? 30 : 20, recommendationType: rec?.recommendationType || "COLLECT_MORE_EVIDENCE", novelty: rec ? 0.65 : 0.9, confidence: rec?.traceability.confidence || 0, maturity: rec?.traceability.maturity || "PROVISIONAL", reason: rec?.reason || "この条件に一致する十分なEvidence-backed Patternがないため、検証用の新規候補として提示します。", supportingEvidence: rec?.traceability.supportingEvidence || [], missingEvidence: rec?.traceability.missingEvidence || ["need_larger_sample"], variation: { changed: ["topic", "hook_style"], reason: "初期企画ライブラリから派生" }, experimentability: { whatToTest: ["hook_style", "cta"], targetMetric: rec?.scope.metric || "__unknown__", ideaMode: settings.mode }, characterName: settings.character.displayName };
    await db.prepare("INSERT INTO growth_sns_idea_candidates (idea_candidate_id, tenant_id, source_recommendation_id, source_pattern_key, state_fingerprint, status, primary_goal, category, topic, hook_style, cta, template, variation_json, experimentability_json, novelty, confidence, maturity, payload_json) VALUES (?, ?, ?, ?, ?, 'SUGGESTED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, source_recommendation_id, state_fingerprint) DO UPDATE SET updated_at = CURRENT_TIMESTAMP, payload_json = excluded.payload_json").bind(crypto.randomUUID(), tenantId, sourceRecommendationId, sourcePatternKey, stateFingerprint, modeGoal, candidate.category, topic, candidate.hookStyle, candidate.cta, candidate.template, json(candidate.variation), json(candidate.experimentability), candidate.novelty, candidate.confidence, candidate.maturity, json(candidate)).run();
    const persisted = await db.prepare("SELECT idea_candidate_id FROM growth_sns_idea_candidates WHERE tenant_id = ? AND source_recommendation_id = ? AND state_fingerprint = ? LIMIT 1").bind(tenantId, sourceRecommendationId, stateFingerprint).first<{ idea_candidate_id: string }>();
    ideas.push({ ...candidate, ideaCandidateId: persisted?.idea_candidate_id || null });
  }
  return { ideas, settings: { character: settings.character.id, platform: settings.platform, category: settings.category, primaryGoal: settings.goal, locale: settings.locale, ideaMode: settings.mode } };
}

export async function reviewIdeaCandidate(db: D1, sourcePatternKey: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID, status: "SAVED" | "DISMISSED" = "SAVED") {
  const persisted = await db.prepare("SELECT * FROM growth_sns_idea_candidates WHERE tenant_id = ? AND source_pattern_key = ? ORDER BY datetime(updated_at) DESC LIMIT 1").bind(tenantId, sourcePatternKey).first<Idea>();
  if (persisted) { await db.prepare("UPDATE growth_sns_idea_candidates SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND idea_candidate_id = ?").bind(status, tenantId, persisted.idea_candidate_id).run(); return db.prepare("SELECT * FROM growth_sns_idea_candidates WHERE tenant_id = ? AND idea_candidate_id = ?").bind(tenantId, persisted.idea_candidate_id).first(); }
  const recommendations = await listRecommendations(db, tenantId) as Recommendation[]; const item = recommendations.find((candidate) => candidate.patternKey === sourcePatternKey);
  if (!item) throw new Error("Recommendation pattern not found for this tenant.");
  if (item.recommendationType === "AVOID_FOR_NOW") throw new Error("AVOID_FOR_NOW is not promoted to a normal Idea Candidate.");
  const candidate = buildIdeaCandidate(item); const id = crypto.randomUUID();
  await db.prepare("INSERT INTO growth_sns_idea_candidates (idea_candidate_id, tenant_id, source_recommendation_id, source_pattern_key, state_fingerprint, status, primary_goal, category, topic, hook_style, cta, template, variation_json, experimentability_json, novelty, confidence, maturity, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, source_recommendation_id, state_fingerprint) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP, payload_json = excluded.payload_json").bind(id, tenantId, candidate.sourceRecommendationId, candidate.sourcePatternKey, candidate.stateFingerprint, status, candidate.primaryGoal, candidate.category, candidate.topic, candidate.hookStyle, candidate.cta, candidate.template, json(candidate.variation), json(candidate.experimentability), candidate.novelty, candidate.confidence, candidate.maturity, json({ ...candidate, actor: String(input.actor || "admin") })).run();
  return db.prepare("SELECT * FROM growth_sns_idea_candidates WHERE tenant_id = ? AND source_pattern_key = ? AND state_fingerprint = ? LIMIT 1").bind(tenantId, sourcePatternKey, candidate.stateFingerprint).first();
}
