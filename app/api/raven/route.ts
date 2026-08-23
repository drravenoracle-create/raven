import { env } from "cloudflare:workers";
import { getPersona, personaSystemPrompt } from "@/app/lib/personas";
import {
  buildFallbackReading,
  buildFortunePrompt,
  buildSafetyReading,
  drawServerCard,
  normalizeTheme,
  selectYijingHexagram,
  parseAIReading,
} from "@/app/lib/fortune/engine";
import {
  commitReadingEntitlement,
  getMemberSession,
  guildMemberErrorResponse,
  isGuildMemberSystemActive,
  memberReturnTo,
  menuIdForRavenReading,
  recordMemberEvent,
  releaseReadingEntitlement,
  reserveReadingEntitlement,
  type TrialReservation,
} from "@/app/lib/guild-member-client";
import type { YijingHexagram } from "@/app/divination-dictionary/yijing-64-hexagrams/data";

type RavenRequest = {
  locale?: "ja" | "en";
  mode?: "fortune" | "reading" | "chat";
  readingMode?: "message" | "reply" | "consultation";
  readingModeLabel?: string;
  divination?: "integrated" | "qimen" | "liuren" | "taiyi" | "yijing";
  divinationLabel?: string;
  theme?: unknown;
  name?: string;
  concern?: string;
  sourceText?: string;
  birthDate?: string;
  message?: string;
  history?: Array<{
    role: "user" | "raven";
    text: string;
  }>;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";

const divinationInstructions: Record<string, string> = {
  integrated:
    "Use an integrated Raven Blackwood reading. Combine tone, intent, emotional pressure, relationship dynamics, timing, and practical next action. Output sections: 意図, 温度, 注意点, 次の一手. Do not overfit to one classical method.",
  qimen:
    "Read through the lens of Qimen Dunjia. Focus on timing, whether to act or wait, direction of action, order of contact, and how to avoid wasting force. Output sections: 時機, 動く方針, 避ける動き, 一手. Do not invent literal compass directions unless the user provides location and timing.",
  liuren:
    "Read through the lens of Liu Ren Shen Ke. Focus on relationship dynamics, the other party's likely stance, hidden blockers, third-party influence, and how the situation may unfold. Output sections: 相手の姿勢, 障害, 流れ, 接し方. Avoid pretending to know private thoughts with certainty.",
  taiyi:
    "Read through the lens of Taiyi Shenshu. Focus on the larger cycle, environment, long-term pressure, turning points, and whether the user should expand, hold, or restructure. Output sections: 大局, 環境圧, 転機, 戦略. Keep the advice strategic rather than immediate-only.",
  yijing:
    "Read through the lens of the Yijing. Focus on change, the present phase, the attitude to take, what to preserve, what to release, and how to move without forcing the situation. Output sections: 今の卦意, 変化, 守るもの, 手放すもの. Do not claim a specific hexagram unless clearly framed as symbolic.",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function ravenAuthLinks(request: Request, menuId: string) {
  const base = String(env.GUILD_MEMBER_API_BASE_URL || "").replace(/\/+$/, "");
  if (!base) return {};
  const origin = "https://raven.fortunestudios.jp";
  const returnTo = new URL(memberReturnTo(request), origin).toString();
  const make = (mode: "login" | "register") => {
    const target = new URL("/api/auth/google/start", base);
    target.searchParams.set("mode", mode);
    target.searchParams.set("return_to", returnTo);
    target.searchParams.set("menu_id", menuId);
    target.searchParams.set("tenant_id", "raven-oracle");
    target.searchParams.set("character_id", "raven");
    return target.toString();
  };
  return { auth_url: make("login"), register_url: make("register") };
}

function formatYijingReading(text: string, hexagram: YijingHexagram) {
  const heading = `今回出た卦: ${hexagram.name}（${hexagram.reading}）`;
  return text.startsWith("今回出た卦:") ? text : `${heading}\n\n${text}`;
}

function buildPrompt(payload: RavenRequest) {
  const persona = getPersona(process.env.RAVEN_PERSONA_ID);
  const personaPrompt = personaSystemPrompt(persona);
  const sourceText = payload.sourceText?.trim() || "(no source text provided)";

  if (payload.mode === "chat") {
    const recentHistory = (payload.history ?? [])
      .slice(-8)
      .map((item) => `${item.role === "raven" ? "Raven" : "User"}: ${item.text}`)
      .join("\n");

    return [
      personaPrompt,
      "",
      "Focus on tone, intent, risk, next action, and wording improvements.",
      persona.chatInstruction,
      "",
      "Source text under review:",
      sourceText,
      "",
      "Recent chat:",
      recentHistory || "(none)",
      "",
      "User message:",
      payload.message?.trim() || "(empty)",
      "",
      "Reply in 3 to 6 short sentences.",
    ].join("\n");
  }

  const yijingHexagram = payload.divination === "yijing" ? selectYijingHexagram({ concern: sourceText }) : null;

  const isEnglish = payload.locale === "en";
  return [
    personaPrompt,
    "",
    isEnglish
      ? "Analyze the user's text as an English AI divination reading for Raven Blackwood. The user may provide Japanese text; understand it, but write the complete answer in natural English."
      : "Analyze the user's text as a Japanese AI text divination reading for Raven Blackwood.",
    `Reading mode: ${payload.readingModeLabel || payload.readingMode || "unspecified"}.`,
    `Selected divination method: ${payload.divinationLabel || payload.divination || "integrated"}.`,
    payload.birthDate ? "Member birth date is available as a private profile context; use it only when relevant to the selected divination and never repeat it in the answer." : "",
    payload.birthDate ? `Member birth date: ${payload.birthDate}` : "",
    isEnglish
      ? "Use the selected classical method as a reflective framework. Use clear sections: Intention, Tone, Cautions, and Next step. Do not claim certainty or private knowledge."
      : divinationInstructions[payload.divination || "integrated"] || divinationInstructions.integrated,
    yijingHexagram
      ? `最初に必ず「今回出た卦: ${yijingHexagram.name}（${yijingHexagram.reading}）」と1行目に書いてください。この卦を本卦として、その後に今の卦意、変化、守るもの、手放すものの順で解説してください。卦名や読みを別のものに置き換えないでください。`
      : "",
    isEnglish
      ? "Return clear, warm English prose. Use concise section headings and finish with one practical action."
      : "Return clear Japanese prose. Use the section labels requested by the selected divination method above, not generic labels.",
    `If useful, you may also include Raven's standard labels as subpoints: ${persona.readingLabels.join(", ")}.`,
    "Make each selected divination method feel meaningfully different in viewpoint, vocabulary, and recommendation structure.",
    "Keep the result practical: each section should be 2 to 4 sentences, and the final section must contain an immediately usable action.",
    "Do not overstate certainty. Do not invent facts outside the text.",
    "Do not give medical, legal, financial, or guaranteed-result advice. Keep it as reflective divination and practical wording support.",
    "",
    "Text:",
    sourceText,
  ].join("\n");
}

function extractText(data: OpenAIResponse) {
  if (data.output_text?.trim()) return data.output_text.trim();

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((part) => part.text)
      .filter(Boolean)
      .join("\n")
      .trim() || ""
  );
}

function consultationSummary(payload: RavenRequest) {
  return String(payload.concern || payload.sourceText || payload.message || "").replace(/\s+/g, " ").trim().slice(0, 260);
}

function divinationMethods(payload: RavenRequest) {
  if (payload.mode === "fortune") return [String(payload.theme || "today")];
  if (payload.mode === "reading") return [String(payload.divination || "integrated")];
  return [];
}

function buildTextFallback(payload: RavenRequest) {
  const subject = String(payload.sourceText || payload.message || "相談内容").replace(/\s+/g, " ").trim().slice(0, 80) || "相談内容";
  const sections: Record<string, [string, string, string, string]> = {
    qimen: ["時機", "今は状況を急に動かすより、情報と順番を整える段階です。", "勢いだけで連絡や決断を重ねると、選択肢が狭くなりやすい時です。", "今日できる確認を一つ終えてから、次の連絡または判断を一度だけ行ってください。"],
    liuren: ["相手の姿勢", "相手の反応だけで結論を急がず、言葉と行動の両方を見ていく必要があります。", "伝達不足やタイミングのずれが、実際以上に距離を感じさせている可能性があります。", "相手に確認したいことを一つに絞り、短く穏やかに尋ねてください。"],
    taiyi: ["大局", "目の前の答えだけでなく、今後の負担と続けやすさを基準に整理する時です。", "環境の変化に合わせて、方法や関わり方を組み替える余地があります。", "三か月後にも続けられるかを基準に、残すものと減らすものを書き出してください。"],
    yijing: ["今の卦意", "状況は固定されておらず、無理に結論を出すより変化の兆しを見極める段階です。", "守るべき軸を一つ残し、それ以外は柔軟に見直すことで流れが整います。", "今日の判断を一つだけ保留し、代わりに確認できる事実を一つ集めてください."],
    integrated: ["意図", "相談の中心には、答えを急ぐことより状況を整理して納得したい気持ちがあります。", "不安から複数の選択肢を同時に動かすと、判断の基準がぼやけやすくなります。", "今いちばん守りたい条件を一つ決め、その条件に沿う小さな一手から始めてください。"],
  };
  const [label, first, caution, action] = sections[payload.divination || "integrated"] || sections.integrated;
  return `AI接続が一時的に不安定なため、簡易鑑定を表示します。\n\n${label}\n${first}\n\n注意点\n${caution}\n\n次の一手\n${action}\n\n入力内容「${subject}」をもとにした暫定結果です。時間を置いて再鑑定すると、より詳しい読みを確認できます。`;
}

async function reserveMemberReading(request: Request, payload: RavenRequest, options: { requireAuthenticated?: boolean } = {}) {
  if (!isGuildMemberSystemActive(env)) return null;
  const requireAuthenticated = options.requireAuthenticated !== false;
  if (!requireAuthenticated) {
    const sessionPayload = await getMemberSession(env, request).catch(() => null);
    if (!sessionPayload?.session?.authenticated) return null;
  }
  const menuId = menuIdForRavenReading({ mode: payload.mode, theme: payload.theme, divination: payload.divination });
  try {
    await recordMemberEvent(env, request, "reading_started", { menu_id: menuId, mode: payload.mode });
    const reservation = await reserveReadingEntitlement(env, request, {
      menuId,
      readingMode: payload.mode || "reading",
      consultationSummary: consultationSummary(payload),
      returnTo: memberReturnTo(request),
    });
    await recordMemberEvent(env, request, reservation.is_trial ? "trial_started" : "reading_started", { menu_id: menuId, mode: payload.mode });
    return { menuId, reservation };
  } catch (error) {
    if (error instanceof Error && ("authUrl" in error || "registerUrl" in error || (error as { code?: string }).code === "member_login_required")) {
      return Response.json(
        { ok: false, error: error.message, code: (error as { code?: string }).code || "member_login_required", ...ravenAuthLinks(request, menuId) },
        { status: (error as { status?: number }).status || 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    return guildMemberErrorResponse(error);
  }
}

async function commitMemberReading(
  request: Request,
  payload: RavenRequest,
  context: { menuId: string; reservation: TrialReservation } | null,
  resultSnapshot: unknown,
  modelIdentifier?: string,
) {
  if (!context) return {};
  try {
    const commit = await commitReadingEntitlement(env, request, {
      reservationId: context.reservation.reservation_id,
      menuId: context.menuId,
      consultationSummary: consultationSummary(payload),
      inputSnapshot: {
        mode: payload.mode,
        reading_mode: payload.readingMode,
        divination: payload.divination,
        theme: payload.theme,
        name: payload.name,
        concern: payload.concern,
        source_text: payload.sourceText,
      },
      resultSnapshot,
      promptVersion: "raven-api-guild-member-v1",
      modelIdentifier,
      divinationMethods: divinationMethods(payload),
    });
    await recordMemberEvent(env, request, context.reservation.is_trial ? "trial_completed" : "reading_completed", {
      menu_id: context.menuId,
      reading_id: commit.reading_id,
    });
    return { member: { reading_id: commit.reading_id, saved: true, is_trial: context.reservation.is_trial } };
  } catch (error) {
    await releaseReadingEntitlement(env, request, { reservationId: context.reservation.reservation_id, reason: "commit_failed" });
    return guildMemberErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let payload: RavenRequest;

  try {
    payload = (await request.json()) as RavenRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (payload.mode === "fortune") {
    const theme = normalizeTheme(payload.theme);
    const card = drawServerCard({ theme, name: payload.name, concern: payload.concern });
    const yijingHexagram = theme === "yijing" ? selectYijingHexagram({ name: payload.name, concern: payload.concern }) : null;
    const memberContext = await reserveMemberReading(request, { ...payload, theme }, { requireAuthenticated: false });
    if (memberContext instanceof Response) return memberContext;
    const safetyReading = payload.concern?.trim()
      ? buildSafetyReading({ theme, name: payload.name, concern: payload.concern, card })
      : null;

    if (safetyReading) {
      const member = await commitMemberReading(request, { ...payload, theme }, memberContext, { reading: safetyReading, yijingHexagram }, "safety");
      if (member instanceof Response) return member;
      return jsonResponse({ reading: safetyReading, ...member });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const reading = buildFallbackReading({ theme, name: payload.name, concern: payload.concern, card });
      const member = await commitMemberReading(request, { ...payload, theme }, memberContext, { reading, yijingHexagram }, "fallback");
      if (member instanceof Response) return member;
      return jsonResponse({
        reading,
        ...member,
      });
    }

    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const openAIResponse = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: buildFortunePrompt({ theme, name: payload.name, concern: payload.concern, birthDate: payload.birthDate, card }),
        max_output_tokens: 520,
      }),
    });

    const data = (await openAIResponse.json()) as OpenAIResponse;
    const text = openAIResponse.ok ? extractText(data) : "";
    const aiReading = text ? parseAIReading(text, { theme, card, name: payload.name, concern: payload.concern }) : null;
    const reading = aiReading ?? buildFallbackReading({ theme, name: payload.name, concern: payload.concern, card });
    const member = await commitMemberReading(request, { ...payload, theme }, memberContext, { reading }, openAIResponse.ok ? model : "fallback");
    if (member instanceof Response) return member;

    return jsonResponse({
      reading,
      model: openAIResponse.ok ? model : undefined,
      ...member,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return jsonResponse(
      {
        error: "OPENAI_API_KEY is not configured.",
      },
      503,
    );
  }

  if (payload.mode !== "reading" && payload.mode !== "chat") {
    return jsonResponse({ error: "mode must be fortune, reading, or chat." }, 400);
  }

  if (payload.mode === "reading" && !payload.sourceText?.trim()) {
    return jsonResponse({ error: "sourceText is required for reading mode." }, 400);
  }

  if (payload.mode === "chat" && !payload.message?.trim()) {
    return jsonResponse({ error: "message is required for chat mode." }, 400);
  }

  const memberContext = payload.mode === "reading" ? await reserveMemberReading(request, payload) : null;
  if (memberContext instanceof Response) return memberContext;

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  let openAIResponse: Response | null = null;
  let data: OpenAIResponse = {};
  try {
    openAIResponse = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: buildPrompt(payload),
        max_output_tokens: payload.mode === "chat" ? 360 : 520,
      }),
    });
    data = (await openAIResponse.json()) as OpenAIResponse;
  } catch {
    if (memberContext) {
      const fallback = buildTextFallback(payload);
      const member = await commitMemberReading(request, payload, memberContext, { text: fallback }, "fallback");
      if (member instanceof Response) return member;
      return jsonResponse({ text: fallback, model: "fallback", degraded: true, ...member });
    }
    return jsonResponse({ text: buildTextFallback(payload), model: "fallback", degraded: true });
  }

  if (!openAIResponse.ok) {
    const fallback = buildTextFallback(payload);
    if (memberContext) {
      const member = await commitMemberReading(request, payload, memberContext, { text: fallback }, "fallback");
      if (member instanceof Response) return member;
      return jsonResponse({ text: fallback, model: "fallback", degraded: true, ...member });
    }
    return jsonResponse({ text: fallback, model: "fallback", degraded: true });
  }

  const rawText = extractText(data);
  const yijingHexagram = payload.divination === "yijing" ? selectYijingHexagram({ concern: payload.sourceText?.trim() || "(no source text provided)" }) : null;
  const text = rawText && yijingHexagram ? formatYijingReading(rawText, yijingHexagram) : rawText;

  if (!text) {
    if (memberContext) await releaseReadingEntitlement(env, request, { reservationId: memberContext.reservation.reservation_id, reason: "empty_ai_response" });
    return jsonResponse({ error: "OpenAI returned an empty response." }, 502);
  }

  const member = await commitMemberReading(request, payload, memberContext, { text }, model);
  if (member instanceof Response) return member;

  return jsonResponse({
    text,
    model,
    ...member,
  });
}
