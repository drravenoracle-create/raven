import { getCharacterConfig } from "./character-config.ts";

type Draft = Record<string, unknown> & { tenant: string; character: string; locale: string; platform: string; contentType: string; title: string; hook: string; cta: string; caption: string; hashtags: string[]; recommendedDuration: number; platformContent: Record<string, Record<string, unknown>>; structure: Record<string, unknown>; scope: Record<string, string>; backgroundCandidate: string; bgmMood: string; traceability: Record<string, unknown> };
const PLATFORMS = new Set(["instagram", "tiktok", "youtube"]);
const DEFAULT_TIMELINE = [{ start: 0, end: 2, label: "Hook" }, { start: 2, end: 5, label: "Choice" }, { start: 5, end: 9, label: "Result A" }, { start: 9, end: 13, label: "Result B" }, { start: 13, end: 17, label: "Result C" }, { start: 17, end: 20, label: "CTA" }];
const THREE_CHOICE_TYPES = new Set(["THREE_CHOICE", "PICK_A_CARD"]);
const textLength = (value: unknown) => Array.from(String(value || "")).length;

function platformMetadata(draft: Draft, platform: string) { const metadata = draft.platformContent?.[platform]; return metadata || { caption: draft.caption, cta: draft.cta, hashtags: draft.hashtags, duration: draft.recommendedDuration, title: draft.title, description: draft.caption }; }
function overflowWarnings(draft: Draft) { const fields = [{ name: "title", value: draft.title, max: 34 }, { name: "hook", value: draft.hook, max: 58 }, { name: "cta", value: draft.cta, max: 46 }, { name: "caption", value: draft.caption, max: 220 }]; return fields.filter((field) => textLength(field.value) > field.max).map((field) => ({ field: field.name, estimatedLineCount: Math.ceil(textLength(field.value) / 18), message: `${field.name}がSafe Area内で長くなる可能性があります。短縮を検討してください。` })); }

export function buildDraftPreview(draft: Draft, requestedPlatform = draft.platform) {
  const platform = String(requestedPlatform).toLowerCase();
  const character = getCharacterConfig(draft.character);
  const warnings: Array<Record<string, unknown>> = [];
  if (!character) warnings.push({ code: "CHARACTER_MISSING", message: "Character Configが見つかりません。" });
  if (!PLATFORMS.has(platform)) warnings.push({ code: "PLATFORM_INVALID", message: "対応Platformを選択してください。" });
  if (!draft.locale) warnings.push({ code: "LOCALE_MISSING", message: "Localeがありません。" });
  if (!draft.hook) warnings.push({ code: "HOOK_MISSING", message: "Hookがありません。" });
  if (!draft.cta) warnings.push({ code: "CTA_MISSING", message: "CTAがありません。" });
  if (!draft.contentType || !draft.structure) warnings.push({ code: "STRUCTURE_MISSING", message: "Content構成がありません。" });
  const duration = Number(draft.recommendedDuration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 180) warnings.push({ code: "DURATION_INVALID", message: "推奨尺が不正です。" });
  const isThreeChoice = THREE_CHOICE_TYPES.has(draft.contentType);
  const structure = draft.structure || {};
  const timeline = Array.isArray(structure.timeline) ? structure.timeline : isThreeChoice ? DEFAULT_TIMELINE : [{ start: 0, end: duration, label: "Content" }];
  const scenes = isThreeChoice ? [{ key: "hook", label: "Hook", text: structure.openingHook || draft.hook }, { key: "choice", label: "Choice", text: structure.choicePrompt || "A / B / C" }, { key: "a", label: "A", text: structure.resultA || "Aの結果を記入" }, { key: "b", label: "B", text: structure.resultB || "Bの結果を記入" }, { key: "c", label: "C", text: structure.resultC || "Cの結果を記入" }, { key: "cta", label: "CTA", text: structure.closingCta || draft.cta }] : [{ key: "hook", label: "Hook", text: structure.openingHook || draft.hook }, { key: "body", label: "Content", text: structure.body || draft.concept }, { key: "cta", label: "CTA", text: structure.closingCta || draft.cta }];
  warnings.push(...overflowWarnings({ ...draft, title: String(draft.title || ""), hook: String(draft.hook || ""), cta: String(draft.cta || ""), caption: String(draft.caption || "") }));
  return { status: warnings.length ? "NEEDS_EDIT" : "READY", canvas: { width: 1080, height: 1920, aspectRatio: "9:16" }, platform, locale: draft.locale, character: character ? { id: character.id, displayName: character.displayName, persona: character.brand.tone, style: character.brand.style } : null, background: { kind: "placeholder", reference: draft.backgroundCandidate || "Background未選択" }, cards: { kind: isThreeChoice ? "placeholder" : "not_required", labels: isThreeChoice ? ["A", "B", "C"] : [] }, scenes, timeline, safeArea: { top: { visible: true, label: "top safe area" }, bottom: { visible: true, label: "bottom caption/control area" }, right: { visible: true, label: "right-side action area" } }, metadata: platformMetadata(draft, platform), caption: platformMetadata(draft, platform).caption || draft.caption, hashtags: platformMetadata(draft, platform).hashtags || draft.hashtags, recommendedDuration: platformMetadata(draft, platform).duration || draft.recommendedDuration, bgm: { selected: false, title: null, mood: draft.bgmMood || "none" }, traceability: draft.traceability, warnings };
}
