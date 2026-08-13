import { env } from "cloudflare:workers";
import { BLOG_ENGINE_TENANT_ID, buildBlogDraft, createSocialDerivatives } from "@/app/lib/blog-engine";

type ArticleRow = {
  title: string;
  category: string;
  primary_keyword: string;
  target_reader: string;
  search_intent: string;
};

function postTypeFor(format: string) {
  if (format === "reel_script") return "reel";
  if (format === "story") return "story";
  if (format === "thread") return "thread";
  return "carousel";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const articleId = String(body.article_id ?? body.articleId ?? "");
  if (!articleId) return Response.json({ error: "article_id is required" }, { status: 400 });

  const article = await env.DB.prepare("SELECT title, category, primary_keyword, target_reader, search_intent FROM blog_engine_articles WHERE tenant_id = ? AND id = ? LIMIT 1")
    .bind(BLOG_ENGINE_TENANT_ID, articleId)
    .first<ArticleRow>();
  if (!article) return Response.json({ error: "Article not found" }, { status: 404 });

  const draft = buildBlogDraft({
    topic: article.title,
    category: article.category,
    primaryKeyword: article.primary_keyword,
    targetReader: article.target_reader,
    searchIntent: article.search_intent,
  });

  let socialCreated = 0;
  let queueCreated = 0;
  let skipped = 0;
  for (const social of createSocialDerivatives(articleId, draft)) {
    const existingSocial = await env.DB.prepare("SELECT id FROM blog_engine_social_contents WHERE tenant_id = ? AND tracking_id = ? LIMIT 1")
      .bind(BLOG_ENGINE_TENANT_ID, social.trackingId)
      .first<{ id: string }>();
    if (!existingSocial) {
      await env.DB.prepare(
        "INSERT INTO blog_engine_social_contents (id, tenant_id, source_article_id, platform, format, angle, content, cta, tracking_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(crypto.randomUUID(), BLOG_ENGINE_TENANT_ID, articleId, social.platform, social.format, social.angle, social.content, draft.keyMessage, social.trackingId)
        .run();
      socialCreated += 1;
    }

    const existingPost = await env.DB.prepare("SELECT id FROM sns_posts WHERE tenant_id = ? AND duplicate_warning = ? LIMIT 1")
      .bind(BLOG_ENGINE_TENANT_ID, social.trackingId)
      .first<{ id: string }>();
    if (existingPost) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(
      `INSERT INTO sns_posts
        (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, status, duplicate_warning, ai_generated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        BLOG_ENGINE_TENANT_ID,
        social.platform,
        postTypeFor(social.format),
        `${article.title} / ${social.platform} ${social.format}`.slice(0, 180),
        article.title,
        article.category,
        "Raven Blackwood",
        "ブログ記事からSNS導線を作る",
        draft.keyMessage,
        social.content,
        "#RavenBlackwood #レイヴンブラックウッド #占い #相談整理",
        social.content,
        "draft",
        social.trackingId,
        1,
      )
      .run();
    queueCreated += 1;
  }

  return Response.json({ ok: true, created: socialCreated, queued: queueCreated, skipped, message: `SNS派生 ${socialCreated} 件、SNS下書き ${queueCreated} 件を作成しました。重複 ${skipped} 件は追加しませんでした。` });
}
