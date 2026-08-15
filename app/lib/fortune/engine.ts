import { getPersona, personaSystemPrompt } from "@/app/lib/personas";
import { checkFortuneSafety } from "@/app/lib/fortune/safety";
import { tarotCards, type TarotCard } from "@/app/lib/fortune/tarot";

export type FortuneTheme = "love" | "work" | "money" | "today" | "yijing";

export type FortuneRequest = {
  mode: "fortune";
  theme?: FortuneTheme;
  name?: string;
  concern?: string;
};

export type FortuneReading = {
  schemaVersion: "raven-fortune-v1";
  source: "ai" | "fallback" | "safety";
  theme: FortuneTheme;
  card: {
    id: string;
    name: string;
    nameJa: string;
    meaning: string;
  };
  title: string;
  summary: string;
  advice: string;
  caution: string;
  luckyAction: string;
};

const themeLabels: Record<FortuneTheme, string> = {
  love: "恋愛",
  work: "仕事",
  money: "金運",
  today: "今日",
  yijing: "易断",
};

const themeInstructions: Record<FortuneTheme, string> = {
  today: "Focus on the rhythm of the day, what to do first, what to postpone, and one small grounding action.",
  love: "Focus on emotional distance, communication temperature, timing of contact, and how to avoid pushing the other person.",
  work: "Focus on priorities, timing, where effort is leaking, negotiation posture, and the next concrete work action.",
  money: "Focus on spending, recovery of value, small financial decisions, avoiding impulsive purchases, and one practical money action.",
  yijing: "Focus on change, the current phase, what to preserve, what to release, and one small action that follows the flow without forcing it.",
};

const luckyActions = [
  "白い紙に、今日の判断材料を三つだけ書く",
  "温かい飲み物を用意してから返事を書く",
  "五分だけ予定を整理して、ひとつ減らす",
  "短いメモで、事実と気持ちを分ける",
  "朝か夜に窓を開けて、考えを入れ替える",
];

function hashText(text: string) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function normalizeTheme(theme: unknown): FortuneTheme {
  return theme === "love" || theme === "work" || theme === "money" || theme === "today" || theme === "yijing" ? theme : "today";
}

export function drawServerCard(input: { theme: FortuneTheme; name?: string; concern?: string }): TarotCard {
  const seed = `${input.theme}:${input.name?.trim() ?? ""}:${input.concern?.trim() ?? ""}:${new Date().toISOString().slice(0, 10)}`;
  return tarotCards[hashText(seed) % tarotCards.length];
}

export function buildFallbackReading(input: {
  theme: FortuneTheme;
  name?: string;
  concern?: string;
  card: TarotCard;
  source?: FortuneReading["source"];
  overrideSummary?: string;
}): FortuneReading {
  const nameLabel = input.name?.trim() || "あなた";
  const concern = input.concern?.trim();
  const luckyAction = luckyActions[hashText(`${input.card.id}:${input.theme}`) % luckyActions.length];

  return {
    schemaVersion: "raven-fortune-v1",
    source: input.source ?? "fallback",
    theme: input.theme,
    card: {
      id: input.card.id,
      name: input.card.name,
      nameJa: input.card.nameJa,
      meaning: input.card.upright,
    },
    title: `${input.card.nameJa} - ${themeLabels[input.theme]}の流れ`,
    summary:
      input.overrideSummary ??
      `${nameLabel}さんの${themeLabels[input.theme]}には、${input.card.nameJa}の示す「${input.card.upright}」が出ています。${concern ? "今の相談は、急いで結論を出すより、状況を一段だけ整理すると流れが見えやすくなります。" : "今日は大きく動かすより、整えることが運を開きます。"}`,
    advice: input.card.advice,
    caution: input.card.caution,
    luckyAction,
  };
}

export function buildSafetyReading(input: { theme: FortuneTheme; name?: string; concern: string; card: TarotCard }): FortuneReading | null {
  const safety = checkFortuneSafety(input.concern);
  if (!safety.isHighRisk) return null;

  return buildFallbackReading({
    theme: input.theme,
    name: input.name,
    concern: input.concern,
    card: input.card,
    source: "safety",
    overrideSummary: safety.message,
  });
}

export function buildFortunePrompt(input: { theme: FortuneTheme; name?: string; concern?: string; card: TarotCard }) {
  const persona = getPersona(process.env.RAVEN_PERSONA_ID);
  return [
    personaSystemPrompt(persona),
    "",
    "You are generating a free daily fortune result for Raven Blackwood.",
    "The card has already been drawn by the server. Do not change, replace, redraw, or add cards.",
    "Do not state the future, hidden facts, or another person's feelings as certainty.",
    "Do not create fear, dependency, urgency pressure, or spiritual threats.",
    "Reply in Japanese. Keep Raven Blackwood's voice calm, strategic, compassionate, and practical.",
    "Make the result clearly specific to the selected theme. Do not reuse generic wording across themes.",
    themeInstructions[input.theme],
    "Use these four meanings internally: 兆し, 読み, 注意点, 今日の一手.",
    "Return only valid JSON matching this shape:",
    '{"title":"string","summary":"string","advice":"string","caution":"string","luckyAction":"string"}',
    "",
    `Theme: ${themeLabels[input.theme]}`,
    `User name: ${input.name?.trim() || "未入力"}`,
    `Concern: ${input.concern?.trim() || "未入力"}`,
    `Confirmed card id: ${input.card.id}`,
    `Confirmed card: ${input.card.nameJa} (${input.card.name})`,
    `Card meaning: ${input.card.upright}`,
    `Card advice: ${input.card.advice}`,
    `Card caution: ${input.card.caution}`,
  ].join("\n");
}

export function parseAIReading(text: string, input: { theme: FortuneTheme; card: TarotCard }): FortuneReading | null {
  try {
    const parsed = JSON.parse(text) as Partial<Pick<FortuneReading, "title" | "summary" | "advice" | "caution" | "luckyAction">>;
    if (!parsed.title || !parsed.summary || !parsed.advice || !parsed.caution || !parsed.luckyAction) return null;
    return {
      schemaVersion: "raven-fortune-v1",
      source: "ai",
      theme: input.theme,
      card: {
        id: input.card.id,
        name: input.card.name,
        nameJa: input.card.nameJa,
        meaning: input.card.upright,
      },
      title: parsed.title,
      summary: parsed.summary,
      advice: parsed.advice,
      caution: parsed.caution,
      luckyAction: parsed.luckyAction,
    };
  } catch {
    return null;
  }
}
