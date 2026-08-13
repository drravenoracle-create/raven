import { env } from "cloudflare:workers";
import { BLOG_ENGINE_TENANT_ID, createBlogEvent } from "@/app/lib/blog-engine";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || BLOG_ENGINE_TENANT_ID;
  if (tenantId !== BLOG_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const id = clean(body.id, 80);
  const status = clean(body.status, 40);
  if (!id || !status) return Response.json({ error: "id and status are required" }, { status: 400 });
  const publishedAt = status === "published" ? new Date().toISOString() : null;
  await env.DB.prepare("UPDATE blog_engine_articles SET status = ?, published_at = COALESCE(?, published_at), updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(status, publishedAt, tenantId, id)
    .run();
  const eventType = status === "approved" ? "article.approved" : status === "scheduled" ? "article.scheduled" : status === "published" ? "article.published" : "article.updated";
  const event = createBlogEvent({ eventType, articleId: id, article: { publishedAt: publishedAt || undefined } });
  await env.DB.prepare("INSERT INTO blog_engine_events (event_id, event_type, tenant_id, article_id, payload_json) VALUES (?, ?, ?, ?, ?)")
    .bind(event.event_id, event.event_type, tenantId, id, JSON.stringify(event.payload))
    .run();
  return Response.json({ ok: true });
}
