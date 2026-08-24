import { env } from "cloudflare:workers";
import { classifyInstagramReconciliation } from "@/app/lib/instagram-reconciliation";
import { resolveSnsConfig } from "@/app/lib/tenant-config-resolver";

const TENANT_ID = resolveSnsConfig().tenantId;

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = clean(body?.id, 80);
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  if (!env.INSTAGRAM_ACCESS_TOKEN) return Response.json({ error: "Instagram API is not configured." }, { status: 400 });

  const post = await env.DB.prepare(
    "SELECT id, tenant_id, platform, status, external_post_id, container_id, container_status, retry_count FROM sns_posts WHERE tenant_id = ? AND id = ? LIMIT 1",
  ).bind(TENANT_ID, id).first<{ id: string; tenant_id: string; platform: string; status?: string; external_post_id?: string; container_id?: string; container_status?: string; retry_count?: number }>();
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
  if (post.platform !== "instagram" || !post.container_id) return Response.json({ error: "Instagram container_id is required." }, { status: 400 });
  if (post.external_post_id || post.status === "published") return Response.json({ ok: true, alreadyPublished: true, externalId: post.external_post_id }, { headers: { "Cache-Control": "no-store" } });

  const response = await fetch(`https://graph.facebook.com/v26.0/${post.container_id}?fields=status_code,status,media_id&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
  const responseBody = await response.json().catch(() => ({}));
  const result = classifyInstagramReconciliation(response.status, responseBody);
  const nextPostStatus = result.state === "published" ? "published" : result.state === "failed" ? "failed" : "reconciliation_required";
  const resolved = result.state === "published" || result.state === "failed";

  await env.DB.prepare(
    "UPDATE sns_posts SET status = ?, container_status = ?, external_post_id = COALESCE(?, external_post_id), published_at = CASE WHEN ? IS NULL THEN published_at ELSE CURRENT_TIMESTAMP END, container_published_at = CASE WHEN ? IS NULL THEN container_published_at ELSE CURRENT_TIMESTAMP END, container_last_checked_at = CURRENT_TIMESTAMP, meta_status = ?, meta_http_status = ?, meta_response_body = ?, meta_error_code = ?, meta_error_subcode = ?, meta_error_message = ?, meta_error_type = ?, reconciliation_reason = ?, reconciliation_required_at = CASE WHEN ? = 1 THEN reconciliation_required_at ELSE CURRENT_TIMESTAMP END, reconciliation_resolved_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE reconciliation_resolved_at END, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?",
  ).bind(nextPostStatus, result.state, result.mediaId, result.mediaId, result.mediaId, result.metaStatus, response.status, result.responseBody, result.error.code, result.error.subcode, result.error.message, result.error.type, result.reason, resolved ? 1 : 0, resolved ? 1 : 0, TENANT_ID, id).run();

  await env.DB.prepare(
    "INSERT INTO sns_publish_logs (id, tenant_id, sns_post_id, platform, action, status, response_code, response_body, error_message, container_id, container_status, retry_count, meta_error_code, meta_error_subcode) VALUES (?, ?, ?, 'instagram', 'reconcile', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), TENANT_ID, id, result.state, response.status, result.responseBody, result.reason, post.container_id, result.state, post.retry_count ?? 0, result.error.code, result.error.subcode).run();

  return Response.json({ ok: true, id, state: result.state, metaStatus: result.metaStatus, mediaId: result.mediaId, reason: result.reason, retryCount: post.retry_count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
