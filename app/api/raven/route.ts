import { getPersona, personaSystemPrompt } from "@/app/lib/personas";
import {
  buildFallbackReading,
  buildFortunePrompt,
  buildSafetyReading,
  drawServerCard,
  normalizeTheme,
  parseAIReading,
} from "@/app/lib/fortune/engine";

type RavenRequest = {
  mode?: "fortune" | "reading" | "chat";
  readingMode?: "message" | "reply" | "consultation";
  readingModeLabel?: string;
  divination?: "integrated" | "qimen" | "liuren" | "taiyi" | "yijing";
  divinationLabel?: string;
  theme?: unknown;
  name?: string;
  concern?: string;
  sourceText?: string;
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

  return [
    personaPrompt,
    "",
    "Analyze the user's text as a Japanese AI text divination reading for Raven Blackwood.",
    `Reading mode: ${payload.readingModeLabel || payload.readingMode || "unspecified"}.`,
    `Selected divination method: ${payload.divinationLabel || payload.divination || "integrated"}.`,
    divinationInstructions[payload.divination || "integrated"] || divinationInstructions.integrated,
    "Return clear Japanese prose. Use the section labels requested by the selected divination method above, not generic labels.",
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
    const safetyReading = payload.concern?.trim()
      ? buildSafetyReading({ theme, name: payload.name, concern: payload.concern, card })
      : null;

    if (safetyReading) {
      return jsonResponse({ reading: safetyReading });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return jsonResponse({
        reading: buildFallbackReading({ theme, name: payload.name, concern: payload.concern, card }),
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
        input: buildFortunePrompt({ theme, name: payload.name, concern: payload.concern, card }),
        max_output_tokens: 520,
      }),
    });

    const data = (await openAIResponse.json()) as OpenAIResponse;
    const text = openAIResponse.ok ? extractText(data) : "";
    const aiReading = text ? parseAIReading(text, { theme, card }) : null;

    return jsonResponse({
      reading: aiReading ?? buildFallbackReading({ theme, name: payload.name, concern: payload.concern, card }),
      model: openAIResponse.ok ? model : undefined,
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

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const openAIResponse = await fetch(OPENAI_ENDPOINT, {
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

  const data = (await openAIResponse.json()) as OpenAIResponse;

  if (!openAIResponse.ok) {
    return jsonResponse(
      {
        error: data.error?.message || "OpenAI request failed.",
      },
      openAIResponse.status,
    );
  }

  const text = extractText(data);

  if (!text) {
    return jsonResponse({ error: "OpenAI returned an empty response." }, 502);
  }

  return jsonResponse({
    text,
    model,
  });
}
