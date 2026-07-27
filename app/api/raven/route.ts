import { getPersona, personaSystemPrompt } from "@/app/lib/personas";

type RavenRequest = {
  mode?: "reading" | "chat";
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

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
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
    "Analyze the user's text for tone, intent, emotional pressure, ambiguity, risk, and the next best edit.",
    `Return clear prose with these labels: ${persona.readingLabels.join(", ")}.`,
    "Do not overstate certainty. Do not invent facts outside the text.",
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
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return jsonResponse(
      {
        error: "OPENAI_API_KEY is not configured.",
      },
      503,
    );
  }

  let payload: RavenRequest;

  try {
    payload = (await request.json()) as RavenRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (payload.mode !== "reading" && payload.mode !== "chat") {
    return jsonResponse({ error: "mode must be reading or chat." }, 400);
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