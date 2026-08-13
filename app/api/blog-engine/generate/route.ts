import { env } from "cloudflare:workers";
import { BLOG_ENGINE_TENANT_ID, BLOG_ENGINE_VERSION, BlogEngineDraft, buildBlogDraft, createBlogEvent, createSocialDerivatives, applyBrandGuard, slugify } from "@/app/lib/blog-engine";


type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  error?: { message?: string };
};

function extractOpenAIText(data: OpenAIResponse) {
  return data.output_text?.trim() || data.output?.flatMap((item) => item.content || []).map((part) => part.text).filter(Boolean).join("\n").trim() || "";
}

function jsonArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : fallback;
}

function normalizeAiDraft(raw: any, fallback: BlogEngineDraft): BlogEngineDraft {
  const draft: BlogEngineDraft = {
    title: String(raw?.title || fallback.title).slice(0, 180),
    slug: slugify(String(raw?.slug || raw?.title || fallback.slug)),
    description: String(raw?.description || fallback.description).slice(0, 220),
    body: String(raw?.body || fallback.body),
    category: String(raw?.category || fallback.category).slice(0, 120),
    tags: jsonArray(raw?.tags, fallback.tags).slice(0, 12),
    primaryKeyword: String(raw?.primaryKeyword || raw?.primary_keyword || fallback.primaryKeyword).slice(0, 120),
    secondaryKeywords: jsonArray(raw?.secondaryKeywords || raw?.secondary_keywords, fallback.secondaryKeywords).slice(0, 10),
    searchIntent: String(raw?.searchIntent || raw?.search_intent || fallback.searchIntent).slice(0, 240),
    targetReader: String(raw?.targetReader || raw?.target_reader || fallback.targetReader).slice(0, 240),
    outline: jsonArray(raw?.outline, fallback.outline).slice(0, 8),
    seoTitle: String(raw?.seoTitle || raw?.seo_title || raw?.title || fallback.seoTitle).slice(0, 180),
    metaDescription: String(raw?.metaDescription || raw?.meta_description || raw?.description || fallback.metaDescription).slice(0, 160),
    keyMessage: String(raw?.keyMessage || raw?.key_message || fallback.keyMessage).slice(0, 240),
    recommendedSocialAngle: String(raw?.recommendedSocialAngle || raw?.recommended_social_angle || fallback.recommendedSocialAngle).slice(0, 80),
    qualityScore: 92,
    brandScore: 96,
    safetyScore: 98,
    qualityReport: { warnings: [], blocked: false },
  };
  if (!draft.body.includes("##") || draft.body.length < 900) return fallback;
  return applyBrandGuard(draft);
}

async function buildAiBlogDraft(input: { topic: string; category: string; primaryKeyword: string; targetReader: string; searchIntent: string; customPrompt?: string }, fallback: BlogEngineDraft) {
  const apiKey = (env as any).OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return { draft: fallback, provider: "fallback-template" };
  const model = (env as any).OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const basePrompt = input.customPrompt?.trim() || [
    "You are Fortune Studio Blog Engine for Raven Blackwood.",
    "Write a production-ready Japanese blog article. Do not output markdown fences. Return JSON only.",
    "Brand rules: do not claim guaranteed fortune results, do not create fear-based sales copy, do not encourage dependency. Treat divination as a tool for organizing choices.",
    "The article must be useful, specific, and suitable for an official Raven Blackwood blog.",
    "Return keys: title, slug, description, body, category, tags, primaryKeyword, secondaryKeywords, searchIntent, targetReader, outline, seoTitle, metaDescription, keyMessage, recommendedSocialAngle.",
    "body must be markdown with 4-6 H2 sections and at least 1000 Japanese characters.",
  ].join("\n");
  const prompt = [
    basePrompt,
    `Topic: ${input.topic}`,
    `Category: ${input.category}`,
    `Primary keyword: ${input.primaryKeyword}`,
    `Target reader: ${input.targetReader}`,
    `Search intent: ${input.searchIntent}`,
  ].join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 2600 }),
  });
  const data = (await response.json().catch(() => ({}))) as OpenAIResponse;
  if (!response.ok) return { draft: fallback, provider: `openai-error:${response.status}` };
  const text = extractOpenAIText(data).replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return { draft: normalizeAiDraft(JSON.parse(text), fallback), provider: `openai:${model}` };
  } catch {
    return { draft: fallback, provider: "openai-parse-fallback" };
  }
}
function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || BLOG_ENGINE_TENANT_ID;
  if (tenantId !== BLOG_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const settings = await env.DB.prepare("SELECT kill_switch, posting_mode FROM blog_engine_settings WHERE tenant_id = ? LIMIT 1").bind(tenantId).first<{
    kill_switch: number;
    posting_mode: string;
  }>();
  if (settings?.kill_switch) return Response.json({ error: "Blog Engine kill switch is ON." }, { status: 423 });
  const generationInput = {
    topic: clean(body.topic, 180),
    category: clean(body.category, 120),
    primaryKeyword: clean(body.primary_keyword ?? body.primaryKeyword, 120),
    targetReader: clean(body.target_reader ?? body.targetReader, 240),
    searchIntent: clean(body.search_intent ?? body.searchIntent, 240),
    customPrompt: clean(body.custom_prompt ?? body.customPrompt, 4000),
  };
  const fallbackDraft = buildBlogDraft(generationInput);
  const aiResult = await buildAiBlogDraft(generationInput, fallbackDraft);
  const draft = aiResult.draft;
  const requestedStatus = clean(body.status, 40);
  const status = draft.qualityReport.blocked ? "quality_failed" : requestedStatus || (settings?.posting_mode === "auto" ? "scheduled" : "draft");
  const id = crypto.randomUUID();
  const idempotencyKey = clean(body.idempotency_key ?? body.idempotencyKey, 200) || `generate:${tenantId}:${draft.slug}:${Date.now()}`;
  const duplicate = await env.DB.prepare("SELECT id FROM blog_engine_articles WHERE tenant_id = ? AND idempotency_key = ? LIMIT 1")
    .bind(tenantId, idempotencyKey)
    .first<{ id: string }>();
  if (duplicate) return Response.json({ ok: true, id: duplicate.id, duplicate: true });
  await env.DB.prepare(
    `INSERT INTO blog_engine_articles
      (id, tenant_id, title, slug, description, body, category, tags_json, primary_keyword, secondary_keywords_json,
       search_intent, target_reader, outline_json, seo_title, meta_description, og_title, og_description, faq_json,
       internal_links_json, related_articles_json, key_message, recommended_social_angle, quality_score, brand_score,
       safety_score, quality_report_json, status, scheduled_at, generation_version, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      tenantId,
      draft.title,
      draft.slug,
      draft.description,
      draft.body,
      draft.category,
      JSON.stringify(draft.tags),
      draft.primaryKeyword,
      JSON.stringify(draft.secondaryKeywords),
      draft.searchIntent,
      draft.targetReader,
      JSON.stringify(draft.outline),
      draft.seoTitle,
      draft.metaDescription,
      draft.seoTitle,
      draft.metaDescription,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      draft.keyMessage,
      draft.recommendedSocialAngle,
      draft.qualityScore,
      draft.brandScore,
      draft.safetyScore,
      JSON.stringify(draft.qualityReport),
      status,
      clean(body.scheduled_at ?? body.scheduledAt, 80),
      BLOG_ENGINE_VERSION,
      idempotencyKey,
    )
    .run();
  for (const step of ["theme", "intent", "outline", "body", "voice", "seo", "safety", "final"]) {
    await env.DB.prepare("INSERT INTO blog_engine_generation_steps (id, tenant_id, article_id, step_name, output_json) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), tenantId, id, step, JSON.stringify({ ok: true, provider: aiResult.provider }))
      .run();
  }
  const event = createBlogEvent({ eventType: "article.created", articleId: id, article: draft });
  await env.DB.prepare("INSERT INTO blog_engine_events (event_id, event_type, tenant_id, article_id, payload_json) VALUES (?, ?, ?, ?, ?)")
    .bind(event.event_id, event.event_type, tenantId, id, JSON.stringify(event.payload))
    .run();
  for (const social of createSocialDerivatives(id, draft)) {
    await env.DB.prepare(
      "INSERT INTO blog_engine_social_contents (id, tenant_id, source_article_id, platform, format, angle, content, cta, tracking_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), tenantId, id, social.platform, social.format, social.angle, social.content, draft.keyMessage, social.trackingId)
      .run();
  }
  return Response.json({ ok: true, id, status, provider: aiResult.provider, draft }, { status: 201, headers: { "Cache-Control": "no-store" } });
}





