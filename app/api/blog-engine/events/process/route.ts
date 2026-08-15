import { env } from "cloudflare:workers";
import { BLOG_ENGINE_TENANT_ID, BlogEngineDraft, applyBrandGuard, buildBlogDraft, createSocialDerivatives, slugify } from "@/app/lib/blog-engine";


type OpenAIResponse = { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { message?: string } };

function extractOpenAIText(data: OpenAIResponse) {
  return data.output_text?.trim() || data.output?.flatMap((item) => item.content || []).map((part) => part.text).filter(Boolean).join("\n").trim() || "";
}

function jsonArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : fallback;
}

function normalizeAiDraft(raw: any, fallback: BlogEngineDraft, date: string): BlogEngineDraft {
  const draft: BlogEngineDraft = {
    title: String(raw?.title || fallback.title).slice(0, 180),
    slug: String(raw?.slug || `daily-fortune-${date}`).slice(0, 160),
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
  draft.slug = slugify(draft.slug) || `daily-fortune-${date}`;
  if (!draft.body.includes("##") || draft.body.length < 900) return fallback;
  return applyBrandGuard(draft);
}

async function buildAiBlogDraft(input: { topic: string; category: string; primaryKeyword: string; targetReader: string; searchIntent: string }, fallback: BlogEngineDraft, date: string) {
  const apiKey = (env as any).OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return { draft: fallback, provider: "fallback-template" };
  const model = (env as any).OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const prompt = [
    "You are Fortune Studio Blog Engine for Raven Blackwood.",
    "Write a production-ready Japanese blog article. Return JSON only, no markdown fences.",
    "Brand rules: no guaranteed fortune claims, no fear-based sales copy, no dependency inducement. Divination helps people organize choices.",
    "Return keys: title, slug, description, body, category, tags, primaryKeyword, secondaryKeywords, searchIntent, targetReader, outline, seoTitle, metaDescription, keyMessage, recommendedSocialAngle.",
    "body must be markdown with 4-6 H2 sections and at least 1000 Japanese characters.",
    `Date: ${date}`,
    `Topic: ${input.topic}`,
    `Category: ${input.category}`,
    `Primary keyword: ${input.primaryKeyword}`,
    `Target reader: ${input.targetReader}`,
    `Search intent: ${input.searchIntent}`,
  ].join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: prompt, max_output_tokens: 2600 }) });
  const data = (await response.json().catch(() => ({}))) as OpenAIResponse;
  if (!response.ok) return { draft: fallback, provider: `openai-error:${response.status}` };
  const output = extractOpenAIText(data).replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return { draft: normalizeAiDraft(JSON.parse(output), fallback, date), provider: `openai:${model}` };
  } catch {
    return { draft: fallback, provider: "openai-parse-fallback" };
  }
}
type BlogEvent = {
  event_id: string;
  event_type: string;
  article_id: string;
  retry_count: number;
};

function jstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function jstLocalToUtcIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

function nextSnsScheduledAt() {
  const { date, time } = jstParts();
  if (time <= "07:00") return jstLocalToUtcIso(date, time);
  if (time < "13:00") return jstLocalToUtcIso(date, "13:00");
  if (time <= "17:00") return jstLocalToUtcIso(date, time);
  const next = new Date(`${date}T01:00:00+09:00`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

async function insertSocialDerivatives(articleId: string, draft: ReturnType<typeof buildBlogDraft>) {
  let created = 0;
  for (const social of createSocialDerivatives(articleId, draft)) {
    const existing = await env.DB.prepare("SELECT id FROM blog_engine_social_contents WHERE tenant_id = ? AND tracking_id = ? LIMIT 1")
      .bind(BLOG_ENGINE_TENANT_ID, social.trackingId)
      .first();
    if (existing) continue;
    await env.DB.prepare(
      "INSERT INTO blog_engine_social_contents (id, tenant_id, source_article_id, platform, format, angle, content, cta, tracking_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), BLOG_ENGINE_TENANT_ID, articleId, social.platform, social.format, social.angle, social.content, draft.keyMessage, social.trackingId)
      .run();
    created += 1;
    if (social.platform === "instagram" && social.format === "carousel") {
      const existingPost = await env.DB.prepare("SELECT id FROM sns_posts WHERE tenant_id = ? AND duplicate_warning = ? LIMIT 1")
        .bind(BLOG_ENGINE_TENANT_ID, social.trackingId)
        .first<{ id: string }>();
      if (!existingPost) {
        await env.DB.prepare(
          `INSERT INTO sns_posts
            (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, media_type, media_url, thumbnail_url, status, scheduled_at, duplicate_warning, ai_generated)
            VALUES (?, ?, 'instagram', 'image', ?, ?, ?, 'レイヴン・ブラックウッド', 'ブログ記事からSNS導線を作る', ?, ?, ?, ?, 'image', ?, ?, 'scheduled', ?, ?, 1)`,
        )
          .bind(
            crypto.randomUUID(),
            BLOG_ENGINE_TENANT_ID,
            `${draft.title} / Instagram`.slice(0, 180),
            draft.title,
            draft.category,
            draft.keyMessage,
            social.content,
            "#レイヴンブラックウッド #占い #相談整理 #ブログ更新",
            social.content,
            "https://raven.fortunestudios.jp/raven-blackwood-cover.png",
            "https://raven.fortunestudios.jp/raven-blackwood-cover.png",
            nextSnsScheduledAt(),
            social.trackingId,
          )
          .run();
      }
    }
  }
  return created;
}

async function createDueDailyDraft(settingsRow: { schedule_json?: string | null }) {
  const { date, time } = jstParts();
  let schedule: any = {};
  try {
    schedule = JSON.parse(settingsRow.schedule_json || "{}");
  } catch {
    schedule = {};
  }
  const series = (schedule.daily_series || []).find((item: any) => item?.enabled && item?.id === "today-fortune");
  if (!series) return 0;
  const draftTime = series.draft_time || schedule.draft_time || "07:00";
  const publishTime = series.publish_time || schedule.publish_time || "07:00";
  if (time < draftTime) return 0;

  const idempotencyKey = `daily:${BLOG_ENGINE_TENANT_ID}:${series.id}:${date}`;
  const existing = await env.DB.prepare("SELECT id FROM blog_engine_articles WHERE tenant_id = ? AND idempotency_key = ? LIMIT 1")
    .bind(BLOG_ENGINE_TENANT_ID, idempotencyKey)
    .first<{ id: string }>();
  if (existing) return 0;

  const generationInput = {
    topic: series.title || "今日の占い",
    category: series.category || "今日の占い",
    primaryKeyword: "今日の占い レイヴン・ブラックウッド",
    targetReader: "朝のうちに一日の流れと判断軸を整えたい読者",
    searchIntent: "今日の占いを読み、仕事・恋愛・対人の注意点を確認したい",
  };
  const fallbackDraft = buildBlogDraft(generationInput);
  const aiResult = await buildAiBlogDraft(generationInput, fallbackDraft, date);
  const draft = aiResult.draft;
  const articleId = crypto.randomUUID();
  const scheduledAt = jstLocalToUtcIso(date, publishTime);
  await env.DB.prepare(
    `INSERT INTO blog_engine_articles
      (id, tenant_id, title, slug, description, body, category, tags_json, primary_keyword, secondary_keywords_json,
       search_intent, target_reader, outline_json, seo_title, meta_description, og_title, og_description, faq_json,
       internal_links_json, related_articles_json, key_message, recommended_social_angle, quality_score, brand_score,
       safety_score, quality_report_json, status, scheduled_at, generation_version, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, 'blog-engine-v2.0', ?)`,
  )
    .bind(
      articleId,
      BLOG_ENGINE_TENANT_ID,
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
      scheduledAt,
      idempotencyKey,
    )
    .run();
  await env.DB.prepare("INSERT INTO blog_engine_events (event_id, event_type, tenant_id, article_id, payload_json) VALUES (?, 'article.created', ?, ?, ?)")
    .bind(crypto.randomUUID(), BLOG_ENGINE_TENANT_ID, articleId, JSON.stringify({ article_id: articleId, series_id: series.id, draft_time: draftTime, publish_time: publishTime, provider: aiResult.provider }))
    .run();
  await insertSocialDerivatives(articleId, draft);
  return 1;
}

async function processBlogEvents() {
  const settings = await env.DB.prepare("SELECT enabled, kill_switch, schedule_json FROM blog_engine_settings WHERE tenant_id = ? LIMIT 1")
    .bind(BLOG_ENGINE_TENANT_ID)
    .first<{ enabled: number; kill_switch: number; schedule_json?: string }>();
  if (!settings?.enabled || settings.kill_switch) {
    return Response.json({ ok: false, error: "Blog Engine is stopped." }, { status: 423 });
  }

  const drafted = await createDueDailyDraft(settings);

  const dueArticles = await env.DB.prepare(
    "SELECT id FROM blog_engine_articles WHERE tenant_id = ? AND status IN ('draft', 'scheduled') AND scheduled_at IS NOT NULL AND datetime(scheduled_at) <= datetime('now') ORDER BY datetime(scheduled_at) ASC LIMIT 20",
  )
    .bind(BLOG_ENGINE_TENANT_ID)
    .all<{ id: string }>();

  let published = 0;
  for (const article of dueArticles.results || []) {
    await env.DB.prepare("UPDATE blog_engine_articles SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .bind(BLOG_ENGINE_TENANT_ID, article.id)
      .run();
    await env.DB.prepare("INSERT INTO blog_engine_events (event_id, event_type, tenant_id, article_id, payload_json) VALUES (?, 'article.published', ?, ?, ?)")
      .bind(crypto.randomUUID(), BLOG_ENGINE_TENANT_ID, article.id, JSON.stringify({ article_id: article.id, published_by: "blog_engine_scheduler" }))
      .run();
    published += 1;
  }

  const events = await env.DB.prepare(
    "SELECT event_id, event_type, article_id, retry_count FROM blog_engine_events WHERE tenant_id = ? AND status = 'pending' ORDER BY datetime(created_at) ASC LIMIT 20",
  )
    .bind(BLOG_ENGINE_TENANT_ID)
    .all<BlogEvent>();

  let processed = 0;
  let created = 0;
  let failed = 0;

  for (const event of events.results || []) {
    try {
      if (event.event_type !== "article.published") {
        await env.DB.prepare("UPDATE blog_engine_events SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE event_id = ?")
          .bind(event.event_id)
          .run();
        processed += 1;
        continue;
      }

      const article = await env.DB.prepare("SELECT title, category, primary_keyword, target_reader, search_intent FROM blog_engine_articles WHERE tenant_id = ? AND id = ? LIMIT 1")
        .bind(BLOG_ENGINE_TENANT_ID, event.article_id)
        .first<{ title: string; category: string; primary_keyword: string; target_reader: string; search_intent: string }>();
      if (!article) throw new Error("Article not found.");

      const draft = buildBlogDraft({
        topic: article.title,
        category: article.category,
        primaryKeyword: article.primary_keyword,
        targetReader: article.target_reader,
        searchIntent: article.search_intent,
      });
      created += await insertSocialDerivatives(event.article_id, draft);

      await env.DB.prepare("UPDATE blog_engine_events SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE event_id = ?")
        .bind(event.event_id)
        .run();
      processed += 1;
    } catch (error) {
      failed += 1;
      const nextStatus = event.retry_count >= 2 ? "dead_letter" : "pending";
      await env.DB.prepare("UPDATE blog_engine_events SET retry_count = retry_count + 1, status = ?, last_error = ? WHERE event_id = ?")
        .bind(nextStatus, error instanceof Error ? error.message : "Unknown error", event.event_id)
        .run();
    }
  }

  return Response.json({ ok: true, drafted, published, processed, created, failed });
}

export async function POST() {
  try {
    return await processBlogEvents();
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown blog engine error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}



