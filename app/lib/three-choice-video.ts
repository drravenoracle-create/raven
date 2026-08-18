import { recordCardUsage, selectCards, type SelectedCard } from "@/app/lib/card-library";

export const THREE_CHOICE_TENANT_ID = "raven-oracle";
export const THREE_CHOICE_TEMPLATE_ID = "raven_three_choice_v1";
export const THREE_CHOICE_VERSION = "three-choice-video-v1.0";

export type ThreeChoiceCard = {
  slot: "A" | "B" | "C";
  cardId: string;
  deckId: string;
  name: string;
  image: string;
  reading: string;
};

export type ThreeChoiceVideoJobPayload = {
  type: "three_choice_reading";
  duration: 20;
  width: 1080;
  height: 1920;
  fps: 30;
  theme: string;
  category: string;
  hook: string;
  character: string;
  deckId: string;
  cards: ThreeChoiceCard[];
  background: string;
  music: string;
  cta: string;
  experimentId?: string;
  variantId?: string;
  backgroundId?: string;
  bgmId?: string;
  safeArea: { top: number; bottom: number; left: number; right: number };
  templateId: "raven_three_choice_v1";
  timeline: Array<{ id: string; start: number; end: number; label: string }>;
};

type D1 = Parameters<typeof selectCards>[0];

export function cleanVideoText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function timeline20s() {
  return [
    { id: "hook", start: 0, end: 2, label: "HOOK" },
    { id: "choice", start: 2, end: 5, label: "3択選択画面" },
    { id: "result-a", start: 5, end: 9, label: "Aの結果" },
    { id: "result-b", start: 9, end: 13, label: "Bの結果" },
    { id: "result-c", start: 13, end: 17, label: "Cの結果" },
    { id: "cta", start: 17, end: 20, label: "CTA" },
  ];
}

export function validateVideoJobPayload(payload: ThreeChoiceVideoJobPayload) {
  const errors: string[] = [];
  if (payload.type !== "three_choice_reading") errors.push("invalid_type");
  if (payload.duration !== 20) errors.push("duration_must_be_20");
  if (payload.width !== 1080 || payload.height !== 1920) errors.push("resolution_must_be_1080x1920");
  if (payload.fps !== 30) errors.push("fps_must_be_30");
  if (payload.templateId !== THREE_CHOICE_TEMPLATE_ID) errors.push("invalid_template");
  if (!payload.theme || payload.theme.length > 180) errors.push("invalid_theme");
  if (!payload.hook || payload.hook.length > 80) errors.push("invalid_hook");
  if (hasUnsafeFortuneClaim(payload.theme) || hasUnsafeFortuneClaim(payload.hook) || hasUnsafeFortuneClaim(payload.cta)) errors.push("unsafe_claim");
  if (!payload.deckId) errors.push("deck_required");
  if (!Array.isArray(payload.cards) || payload.cards.length !== 3) errors.push("three_cards_required");
  const slots = new Set(payload.cards.map((card) => card.slot));
  if (!slots.has("A") || !slots.has("B") || !slots.has("C")) errors.push("slots_required");
  const cardIds = new Set(payload.cards.map((card) => card.cardId));
  if (cardIds.size !== payload.cards.length) errors.push("duplicate_cards");
  for (const card of payload.cards || []) {
    if (!card.cardId || !card.name || !card.reading) errors.push("invalid_card");
    if (card.reading.length > 90) errors.push("reading_too_long");
    if (hasUnsafeFortuneClaim(card.reading)) errors.push("unsafe_reading");
    if (card.image && !isSafeMediaReference(card.image)) errors.push("unsafe_card_image");
  }
  if (payload.background && !isSafeMediaReference(payload.background)) errors.push("unsafe_background");
  if (payload.music && !isSafeMediaReference(payload.music)) errors.push("unsafe_music");
  const timeline = payload.timeline || [];
  if (timeline.length !== 6 || timeline[0]?.start !== 0 || timeline[timeline.length - 1]?.end !== 20) errors.push("invalid_timeline");
  return { valid: errors.length === 0, errors: Array.from(new Set(errors)) };
}

const unsafeClaimPatterns = [
  /死ぬ|死亡|余命|病気になる|妊娠する|逮捕|犯罪|必ず儲かる|投資しろ|訴訟|診断/,
  /絶対に(復縁|結婚|成功|失敗|当たる)/,
];

export function hasUnsafeFortuneClaim(value: unknown) {
  const text = String(value ?? "");
  return unsafeClaimPatterns.some((pattern) => pattern.test(text));
}

export function generateHookCandidates(theme: string, category: string) {
  const base = cleanVideoText(theme, 54) || "今日あなたに必要なメッセージ";
  const secret = category === "love" || category === "relationship";
  return [
    secret ? `${base}を3枚で読み解きます` : `${base}を今、確認します`,
    secret ? `言葉になっていない本音を見ていきます` : `近いうちの流れを3択で見ます`,
    `直感で選んだ1枚が、次の一手を示します`,
  ].map((item) => cleanVideoText(item, 80));
}

export function generateCtaCandidates(category: string) {
  if (category === "love" || category === "relationship") {
    return ["もっと詳しく占う", "プロフィールから無料鑑定", "あなた専用の結果はこちら"];
  }
  if (category === "work") return ["次の一手を詳しく整理する", "仕事の流れを詳しく占う", "迷いをプロフィールから相談"];
  return ["続きはRaven Oracleへ", "プロフィールから無料鑑定", "あなた専用の結果はこちら"];
}

export function characterTone(character: string) {
  const key = cleanVideoText(character, 40).toLowerCase();
  if (key.includes("luna")) return "優しく静かで寄り添う";
  if (key.includes("scarlet")) return "力強く前向き";
  if (key.includes("atlas")) return "論理的で現実的";
  if (key.includes("sol")) return "明るく希望を示す";
  return "落ち着いた軍師的表現。断定せず、選択肢と可能性を示す";
}

function isSafeMediaReference(value: string) {
  if (!value) return true;
  if (value.startsWith("/api/reel-engine/assets?assetId=")) return true;
  if (value.startsWith("media://")) return true;
  if (value.startsWith("r2://")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["raven.fortunestudios.jp", "imagedelivery.net"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function shortMeaning(card: SelectedCard, category: string) {
  const raw =
    category === "love" || category === "relationship"
      ? card.love_meaning || card.sns_summary || card.upright_meaning
      : category === "work"
        ? card.work_meaning || card.sns_summary || card.upright_meaning
        : category === "money"
          ? card.money_meaning || card.sns_summary || card.upright_meaning
          : card.sns_summary || card.upright_meaning || card.love_meaning || card.work_meaning || card.money_meaning;
  return cleanVideoText(raw || "焦らず、今できる小さな一手を選ぶ時です。", 70);
}

export function composeThreeChoicePayload(input: {
  theme: string;
  category: string;
  deckId: string;
  cards: SelectedCard[];
  hook?: string;
  character?: string;
  background?: string;
  music?: string;
  cta?: string;
  experimentId?: string;
  variantId?: string;
  backgroundId?: string;
  bgmId?: string;
  readings?: string[];
}): ThreeChoiceVideoJobPayload {
  const slots = ["A", "B", "C"] as const;
  const cards = input.cards.slice(0, 3).map((card, index) => ({
    slot: slots[index],
    cardId: card.id,
    deckId: card.deck_id,
    name: card.name_ja || card.name,
    image: card.image_url || (card.storage_key ? `r2://${card.storage_key}` : ""),
    reading: cleanVideoText(input.readings?.[index] || shortMeaning(card, input.category), 90),
  }));
  return {
    type: "three_choice_reading",
    duration: 20,
    width: 1080,
    height: 1920,
    fps: 30,
    theme: cleanVideoText(input.theme, 180) || "近いうちに起こる嬉しいこと",
    category: cleanVideoText(input.category, 80) || "near_future",
    hook: cleanVideoText(input.hook, 80) || generateHookCandidates(input.theme, input.category)[0],
    character: cleanVideoText(input.character, 80) || "raven",
    deckId: input.deckId,
    cards,
    background: cleanVideoText(input.background, 1000) || "media://raven/default-background",
    music: cleanVideoText(input.music, 1000) || "media://raven/default-bgm",
    cta: cleanVideoText(input.cta, 160) || "詳しい鑑定はプロフィールへ",
    experimentId: cleanVideoText(input.experimentId, 120) || undefined,
    variantId: cleanVideoText(input.variantId, 120) || undefined,
    backgroundId: cleanVideoText(input.backgroundId, 120) || undefined,
    bgmId: cleanVideoText(input.bgmId, 120) || undefined,
    safeArea: { top: 180, bottom: 260, left: 72, right: 72 },
    templateId: THREE_CHOICE_TEMPLATE_ID,
    timeline: timeline20s(),
  };
}

export async function buildThreeChoicePreview(db: D1, input: Record<string, unknown>) {
  const deckId = cleanVideoText(input.deck_id ?? input.deckId, 120);
  if (!deckId) throw new Error("deck_id is required.");
  const selection = await selectCards(db, {
    deck_id: deckId,
    count: 3,
    selection_mode: cleanVideoText(input.selection_mode ?? input.selectionMode, 40) || "least_used",
    tag: cleanVideoText(input.card_tag ?? input.cardTag, 80),
    exclude_recent_days: Number(input.exclude_recent_days ?? input.excludeRecentDays ?? 0) || 0,
  }, THREE_CHOICE_TENANT_ID);
  if (selection.cards.length !== 3) throw new Error("3択動画にはSNS利用可能なカードが3枚必要です。Deck Managerで有効カードを確認してください。");
  const payload = composeThreeChoicePayload({
    theme: cleanVideoText(input.theme, 180),
    category: cleanVideoText(input.category, 80),
    deckId,
    cards: selection.cards,
    hook: cleanVideoText(input.hook, 80),
    character: cleanVideoText(input.character, 80),
    background: cleanVideoText(input.background, 1000),
    music: cleanVideoText(input.music, 1000),
    cta: cleanVideoText(input.cta, 160),
    experimentId: cleanVideoText(input.experiment_id ?? input.experimentId, 120),
    variantId: cleanVideoText(input.variant_id ?? input.variantId, 120),
    backgroundId: cleanVideoText(input.background_id ?? input.backgroundId, 120),
    bgmId: cleanVideoText(input.bgm_id ?? input.bgmId, 120),
  });
  const validation = validateVideoJobPayload(payload);
  if (!validation.valid) throw new Error(`Invalid video job: ${validation.errors.join(", ")}`);
  return { payload, cards: selection.cards };
}

export async function recordThreeChoiceUsage(db: D1, payload: ThreeChoiceVideoJobPayload, jobId: string) {
  await recordCardUsage(db, {
    cards: payload.cards.map((card) => ({ id: card.cardId, deck_id: card.deckId })),
    contentType: "three_choice_video",
    snsPlatform: "instagram",
    contentId: jobId,
    selectionMode: "three_choice",
  }, THREE_CHOICE_TENANT_ID);
}

export function captionFromThreeChoice(payload: ThreeChoiceVideoJobPayload) {
  return [
    payload.hook || payload.theme,
    "",
    "A / B / C から直感で1枚選んでください。",
    "",
    ...payload.cards.map((card) => `${card.slot}. ${card.name}: ${card.reading}`),
    "",
    payload.cta,
    "",
    "#レイヴンブラックウッド #3択占い #オラクルカード #今日のメッセージ",
  ].join("\n");
}
