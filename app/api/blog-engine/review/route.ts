import { env } from "cloudflare:workers";
import { BLOG_ENGINE_TENANT_ID, guardOptimization } from "@/app/lib/blog-engine";

type ReviewArticle = {
  id: string;
  title: string;
  category: string;
  quality_score: number;
  brand_score: number;
  safety_score: number;
};

function recommendationFor(article: ReviewArticle) {
  const guard = guardOptimization({
    brandScore: article.brand_score,
    safetyScore: article.safety_score,
    sampleSize: 0,
    riskLevel: "medium",
  });

  if (!guard.allowed) {
    return {
      title: `${article.title} の品質確認`,
      summary: "記事のブランド適合・安全性・データ量を確認し、公開導線を強める前に人の目で見直します。",
      reason: guard.reason,
      expectedEffect: "安全な記事だけを改善対象にし、レイヴン・ブラックウッドの世界観と信頼性を守ります。",
      riskLevel: "medium",
    };
  }

  return {
    title: `${article.title} の内部リンクとSNS展開を強化`,
    summary: "本文内に関連鑑定ページや近いテーマの記事への導線を追加し、SNS投稿へ転用できる要点を整理します。",
    reason: "品質・ブランド・安全性の基準を満たしているため、集客導線の改善候補として扱えます。",
    expectedEffect: "ブログ閲覧後の回遊、鑑定ページへの遷移、SNSからの再訪問を増やす狙いです。",
    riskLevel: "low",
  };
}

export async function POST() {
  try {
    const articles = await env.DB.prepare(
      "SELECT id, title, category, quality_score, brand_score, safety_score FROM blog_engine_articles WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20",
    )
      .bind(BLOG_ENGINE_TENANT_ID)
      .all<ReviewArticle>();

    const rows = articles.results || [];
    if (!rows.length) {
      return Response.json({ ok: true, created: 0, message: "レビュー対象の記事がありません。先に記事を生成または公開してください。" });
    }

    let created = 0;
    let skipped = 0;
    for (const article of rows) {
      const existing = await env.DB.prepare("SELECT id FROM blog_engine_improvement_recommendations WHERE tenant_id = ? AND article_id = ? AND recommendation_type = ? AND status = ? LIMIT 1")
        .bind(BLOG_ENGINE_TENANT_ID, article.id, "manual_review", "proposed")
        .first<{ id: string }>();
      if (existing) {
        skipped += 1;
        continue;
      }
      const recommendation = recommendationFor(article);
      await env.DB.prepare(
        "INSERT INTO blog_engine_improvement_recommendations (id, tenant_id, article_id, recommendation_type, title, summary, reason, evidence_json, expected_effect, risk_level, rollback_plan, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          crypto.randomUUID(),
          BLOG_ENGINE_TENANT_ID,
          article.id,
          "manual_review",
          recommendation.title,
          recommendation.summary,
          recommendation.reason,
          JSON.stringify({
            article_id: article.id,
            category: article.category,
            quality_score: article.quality_score,
            brand_score: article.brand_score,
            safety_score: article.safety_score,
          }),
          recommendation.expectedEffect,
          recommendation.riskLevel,
          "変更前の記事内容は blog_engine_content_versions または現在の記事編集画面で確認し、問題があれば元の本文へ戻します。",
          "proposed",
        )
        .run();
      created += 1;
    }

    await env.DB.prepare(
      "INSERT INTO blog_engine_strategy_memories (id, tenant_id, memory_type, summary, evidence_json, confidence) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        crypto.randomUUID(),
        BLOG_ENGINE_TENANT_ID,
        "manual_review",
        `管理画面から改善レビューを作成しました。対象記事 ${created} 件。`,
        JSON.stringify({ articles: created, skipped }),
        0.7,
      )
      .run();

    return Response.json({ ok: true, created, skipped, message: skipped ? `改善提案を ${created} 件作成しました。重複 ${skipped} 件は追加しませんでした。` : `改善提案を ${created} 件作成しました。` });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "改善レビュー作成に失敗しました。" }, { status: 500 });
  }
}
function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || BLOG_ENGINE_TENANT_ID;
    if (tenantId !== BLOG_ENGINE_TENANT_ID) return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 });
    const id = clean(body.id, 120);
    const status = clean(body.status, 40);
    const allowed = new Set(["proposed", "applied", "dismissed"]);
    if (!id || !allowed.has(status)) return Response.json({ ok: false, error: "Invalid recommendation update." }, { status: 400 });

    await env.DB.prepare(
      "UPDATE blog_engine_improvement_recommendations SET status = ?, applied_at = CASE WHEN ? = 'applied' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE tenant_id = ? AND id = ?",
    )
      .bind(status, status, tenantId, id)
      .run();

    return Response.json({ ok: true, id, status, message: status === "applied" ? "改善提案を適用済みにしました。" : "改善提案の状態を更新しました。" });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "改善提案の更新に失敗しました。" }, { status: 500 });
  }
}

