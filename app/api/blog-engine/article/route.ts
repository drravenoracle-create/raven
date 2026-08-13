import { env } from "cloudflare:workers";
import { BLOG_ENGINE_TENANT_ID } from "@/app/lib/blog-engine";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

async function readBody(request: Request) {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || BLOG_ENGINE_TENANT_ID;
  if (tenantId !== BLOG_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const id = clean(body.id, 80);
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const title = clean(body.title, 180);
  const slug = clean(body.slug, 220);
  const description = clean(body.description, 220);
  const category = clean(body.category, 120);
  const bodyText = String(body.body ?? "").trim();
  const status = clean(body.status, 40);
  const scheduledAt = clean(body.scheduled_at ?? body.scheduledAt, 80);
  const current = await env.DB.prepare("SELECT status, quality_score, safety_score, quality_report_json FROM blog_engine_articles WHERE tenant_id = ? AND id = ? LIMIT 1")
    .bind(tenantId, id)
    .first<{ status: string; quality_score: number; safety_score: number; quality_report_json: string }>();
  if (!current) return Response.json({ error: "Article not found" }, { status: 404 });
  if (status === "published" && (current.status === "quality_failed" || current.quality_score < 70 || current.safety_score < 90)) {
    return Response.json({ error: "品質停止の記事はそのまま公開できません。本文を修正して保存し、品質確認後に公開してください。" }, { status: 409 });
  }
  const publishedAt = status === "published" ? new Date().toISOString() : null;

  await env.DB.prepare(
    `UPDATE blog_engine_articles
     SET title = COALESCE(NULLIF(?, ''), title),
         slug = COALESCE(NULLIF(?, ''), slug),
         description = COALESCE(NULLIF(?, ''), description),
         category = COALESCE(NULLIF(?, ''), category),
         body = COALESCE(NULLIF(?, ''), body),
         status = COALESCE(NULLIF(?, ''), status),
         scheduled_at = COALESCE(NULLIF(?, ''), scheduled_at),
         published_at = COALESCE(?, published_at),
         updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = ? AND id = ?`,
  )
    .bind(title, slug, description, category, bodyText, status, scheduledAt, publishedAt, tenantId, id)
    .run();

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const body = await readBody(request);
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || BLOG_ENGINE_TENANT_ID;
  if (tenantId !== BLOG_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const id = clean(body.id, 80);
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  await env.DB.prepare("DELETE FROM blog_engine_social_contents WHERE tenant_id = ? AND source_article_id = ?").bind(tenantId, id).run();
  await env.DB.prepare("DELETE FROM blog_engine_generation_steps WHERE tenant_id = ? AND article_id = ?").bind(tenantId, id).run();
  await env.DB.prepare("DELETE FROM blog_engine_events WHERE tenant_id = ? AND article_id = ?").bind(tenantId, id).run();
  await env.DB.prepare("DELETE FROM blog_engine_article_metrics WHERE tenant_id = ? AND article_id = ?").bind(tenantId, id).run();
  await env.DB.prepare("DELETE FROM blog_engine_articles WHERE tenant_id = ? AND id = ?").bind(tenantId, id).run();

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

