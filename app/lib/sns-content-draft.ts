import { GROWTH_ENGINE_TENANT_ID } from "./growth-engine.ts";
import { getCharacterConfig } from "./character-config.ts";
import { listIdeaCandidates } from "./growth-idea-bridge.ts";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }>; first<T = unknown>(): Promise<T | null>; run(): Promise<unknown> } } };
type Idea = Record<string, unknown> & { ideaCandidateId?: string; sourcePatternKey: string; stateFingerprint: string; tenant: string; character: string; platform: string; category: string; primaryGoal: string; title: string; topic: string; hookStyle: string; cta: string; template: string; contentType?: string; recommendedDuration?: number; recommendationType: string; supportingEvidence?: Array<{ sourceId: string; claimIds: string[] }>; sourceRecommendationId?: string; reason: string; experimentability?: { whatToTest?: string[] } };
type DraftRow = Record<string, unknown> & { draft_id: string; tenant_id: string; idea_candidate_id: string; version: number; status: string };
const CONTENT_TYPES = new Set(["THREE_CHOICE", "PICK_A_CARD", "SCREENSHOT", "STORY", "SINGLE_CARD", "RANKING", "CHARACTER", "OTHER"]);
const PLATFORMS = new Set(["instagram", "tiktok", "youtube"]);
const STATUSES = new Set(["DRAFT", "READY_FOR_PREVIEW", "DISCARDED"]);
const json = (value: unknown) => JSON.stringify(value ?? {});
const parse = (value: unknown, fallback: unknown = {}) => { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed ?? fallback; } catch { return fallback; } };
const clean = (value: unknown, max: number, fallback = "") => String(value ?? fallback).trim().slice(0, max);

function contentTypeFor(idea: Idea) {
  const raw = String(idea.contentType || idea.template || "").toLowerCase();
  if (raw.includes("3択") || raw.includes("three") || raw.includes("choice")) return "THREE_CHOICE";
  if (raw.includes("pick")) return "PICK_A_CARD";
  if (raw.includes("screenshot")) return "SCREENSHOT";
  if (raw.includes("story")) return "STORY";
  if (raw.includes("single") || raw.includes("1枚")) return "SINGLE_CARD";
  return CONTENT_TYPES.has(String(idea.contentType)) ? String(idea.contentType) : "OTHER";
}

function buildDraft(idea: Idea, tenantId: string) {
  if (idea.tenant !== tenantId) throw new Error("Idea Candidate tenant mismatch.");
  if (!idea.ideaCandidateId) throw new Error("Idea Candidate must be persisted before creating a Draft.");
  const character = getCharacterConfig(idea.character);
  if (!character) throw new Error("Idea Candidate character is not available in Character Config.");
  const platform = String(idea.platform || "instagram");
  if (!PLATFORMS.has(platform)) throw new Error("Unsupported draft platform.");
  const contentType = contentTypeFor(idea);
  const isThreeChoice = contentType === "THREE_CHOICE" || contentType === "PICK_A_CARD";
  const hook = `もし、${clean(idea.topic, 120, "今のあなた") }にメッセージが届くなら……`;
  const caption = `${clean(idea.title, 160)}\n${clean(idea.reason, 500)}\n\n${character.defaultCta}`;
  const hashtags = [...new Set([...(character.sns?.hashtags || []), `#${clean(idea.category, 30)}`, platform === "instagram" ? "#リール" : platform === "tiktok" ? "#TikTok占い" : "#Shorts"])];
  const duration = Number(idea.recommendedDuration) > 0 ? Number(idea.recommendedDuration) : platform === "youtube" ? 30 : 20;
  const structure = isThreeChoice ? { openingHook: hook, choicePrompt: "A・B・Cから、気になる選択肢を選んでください。", resultA: "Aの結果を記入", resultB: "Bの結果を記入", resultC: "Cの結果を記入", closingCta: character.threeChoiceCta } : { openingHook: hook, body: "鑑定本文を記入", closingCta: character.defaultCta };
  const platformContent = { instagram: { caption, cta: character.reelCta, hashtags, duration, title: clean(idea.title, 100), description: caption }, tiktok: { caption: `${clean(idea.title, 100)}\n${hook}`, cta: character.threeChoiceCta, hashtags, duration: Math.min(duration, 60), title: clean(idea.title, 100), description: caption }, youtube: { caption, cta: character.reelCta, hashtags, duration, title: clean(idea.title, 100), description: `${clean(idea.concept || idea.reason, 500)}\n${character.reelCta}` } };
  return { tenant: tenantId, guild: String(idea.guild || "__unknown__"), character: character.id, characterName: character.displayName, market: String(idea.market || "__unknown__"), country: String(idea.country || "__unknown__"), locale: String(idea.locale || "ja"), platform, category: clean(idea.category, 60, "総合"), primaryGoal: String(idea.primaryGoal), title: clean(idea.title, 160), hook, concept: clean(idea.reason, 800), contentType, caption, cta: character.defaultCta, hashtags, recommendedDuration: duration, recommendedTemplate: clean(idea.template, 120, "custom"), deckCandidate: "Character Config / Deck Managerから選択", cardSelectionStrategy: isThreeChoice ? "3択候補をA/B/Cへ割り当て（未選出）" : "Draft作成後に選出", backgroundCandidate: "Media Libraryから選択", bgmMood: "calm_or_mysterious", whatToTest: idea.experimentability?.whatToTest || ["hook_style", "cta"], platformContent, structure, traceability: { ideaCandidateId: idea.ideaCandidateId, sourceRecommendationId: idea.sourceRecommendationId || null, sourcePatternId: idea.sourcePatternKey, supportingEvidenceIds: (idea.supportingEvidence || []).flatMap((item) => [item.sourceId, ...item.claimIds]), experimentIds: [] }, scope: { tenant: tenantId, guild: String(idea.guild || "__unknown__"), character: character.id, market: String(idea.market || "__unknown__"), country: String(idea.country || "__unknown__"), locale: String(idea.locale || "ja") } };
}

function validatePatch(input: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const key of ["title", "hook", "concept", "caption", "cta", "recommendedTemplate"]) if (input[key] !== undefined) patch[key] = clean(input[key], key === "concept" || key === "caption" ? 4000 : 500);
  if (input.hashtags !== undefined) { if (!Array.isArray(input.hashtags) || input.hashtags.some((item) => typeof item !== "string" || item.length > 80)) throw new Error("hashtags must be an array of short strings."); patch.hashtags = input.hashtags.slice(0, 30).map((item) => clean(item, 80)); }
  if (input.recommendedDuration !== undefined) { const duration = Number(input.recommendedDuration); if (!Number.isInteger(duration) || duration < 5 || duration > 180) throw new Error("recommendedDuration must be an integer from 5 to 180."); patch.recommendedDuration = duration; }
  if (input.status !== undefined) { const status = String(input.status); if (!STATUSES.has(status)) throw new Error("Invalid Draft status."); patch.status = status; }
  return patch;
}

function rowToDraft(row: DraftRow) { return { draftId: row.draft_id, tenant: row.tenant_id, ideaCandidateId: row.idea_candidate_id, version: row.version, status: row.status, title: row.title, hook: row.hook, concept: row.concept, contentType: row.content_type, caption: row.caption, cta: row.cta, hashtags: parse(row.hashtags_json, []), recommendedDuration: row.recommended_duration, recommendedTemplate: row.recommended_template, deckCandidate: row.deck_candidate, cardSelectionStrategy: row.card_selection_strategy, backgroundCandidate: row.background_candidate, bgmMood: row.bgm_mood, whatToTest: parse(row.what_to_test_json, []), platformContent: parse(row.platform_content_json), structure: parse(row.structure_json), traceability: parse(row.traceability_json), scope: parse(row.scope_json), createdAt: row.created_at, updatedAt: row.updated_at }; }

export async function createContentDraft(db: D1, ideaCandidateId: string, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const ideas = await listIdeaCandidates(db, tenantId) as Idea[];
  const idea = ideas.find((item) => item.ideaCandidateId === ideaCandidateId);
  if (!idea) throw new Error("Idea Candidate not found for this tenant.");
  const draft = buildDraft(idea, tenantId);
  const existing = await db.prepare("SELECT * FROM growth_sns_content_drafts WHERE tenant_id = ? AND idea_candidate_id = ? AND version = 1 LIMIT 1").bind(tenantId, ideaCandidateId).first<DraftRow>();
  if (existing) return rowToDraft(existing);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO growth_sns_content_drafts (draft_id, tenant_id, idea_candidate_id, version, status, platform, category, primary_goal, title, hook, concept, content_type, caption, cta, hashtags_json, recommended_duration, recommended_template, deck_candidate, card_selection_strategy, background_candidate, bgm_mood, what_to_test_json, platform_content_json, structure_json, traceability_json, scope_json) VALUES (?, ?, ?, 1, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, tenantId, ideaCandidateId, draft.platform, draft.category, draft.primaryGoal, draft.title, draft.hook, draft.concept, draft.contentType, draft.caption, draft.cta, json(draft.hashtags), draft.recommendedDuration, draft.recommendedTemplate, draft.deckCandidate, draft.cardSelectionStrategy, draft.backgroundCandidate, draft.bgmMood, json(draft.whatToTest), json(draft.platformContent), json(draft.structure), json(draft.traceability), json(draft.scope)).run();
  const row = await db.prepare("SELECT * FROM growth_sns_content_drafts WHERE tenant_id = ? AND draft_id = ? LIMIT 1").bind(tenantId, id).first<DraftRow>();
  if (!row) throw new Error("Draft was not persisted.");
  return rowToDraft(row);
}

export async function listContentDrafts(db: D1, tenantId = GROWTH_ENGINE_TENANT_ID) { const rows = await db.prepare("SELECT * FROM growth_sns_content_drafts WHERE tenant_id = ? ORDER BY datetime(updated_at) DESC LIMIT 100").bind(tenantId).all<DraftRow>(); return (rows.results || []).map(rowToDraft); }
export async function getContentDraft(db: D1, draftId: string, tenantId = GROWTH_ENGINE_TENANT_ID) { const row = await db.prepare("SELECT * FROM growth_sns_content_drafts WHERE tenant_id = ? AND draft_id = ? LIMIT 1").bind(tenantId, draftId).first<DraftRow>(); return row ? rowToDraft(row) : null; }
export async function updateContentDraft(db: D1, draftId: string, input: Record<string, unknown>, tenantId = GROWTH_ENGINE_TENANT_ID) { const patch = validatePatch(input); const current = await db.prepare("SELECT * FROM growth_sns_content_drafts WHERE tenant_id = ? AND draft_id = ? LIMIT 1").bind(tenantId, draftId).first<DraftRow>(); if (!current) throw new Error("Draft not found for this tenant."); const next = { ...rowToDraft(current), ...patch }; await db.prepare("UPDATE growth_sns_content_drafts SET status = ?, title = ?, hook = ?, concept = ?, caption = ?, cta = ?, hashtags_json = ?, recommended_duration = ?, recommended_template = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND draft_id = ?").bind(next.status, next.title, next.hook, next.concept, next.caption, next.cta, json(next.hashtags), next.recommendedDuration, next.recommendedTemplate, tenantId, draftId).run(); return getContentDraft(db, draftId, tenantId); }
