import { env } from "cloudflare:workers";
import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";
async function admin() { const session = await getAdminSession(); return session && session.email.toLowerCase() === adminEmail().toLowerCase(); }
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await admin())) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  const jobId = String(new URL(request.url).searchParams.get("jobId") || ""); const draftId = (await context.params).id;
  if (!jobId) return Response.json({ ok: false, error: "jobId is required." }, { status: 400 });
  const row = await env.DB.prepare("SELECT storage_key FROM sns_draft_render_jobs WHERE tenant_id = ? AND draft_id = ? AND render_job_id = ? AND status = 'COMPLETED' LIMIT 1").bind(GROWTH_ENGINE_TENANT_ID, draftId, jobId).first<{ storage_key: string | null }>();
  if (!row?.storage_key) return Response.json({ ok: false, error: "Artifact not found." }, { status: 404 });
  const bucket = (env as unknown as { MEDIA_BUCKET?: { get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; size?: number } | null> } }).MEDIA_BUCKET;
  if (!bucket) return Response.json({ ok: false, error: "Artifact storage is not configured." }, { status: 503 });
  const object = await bucket.get(row.storage_key); if (!object) return Response.json({ ok: false, error: "Artifact object is missing." }, { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType || "video/mp4", "Cache-Control": "private, max-age=300", ...(object.size ? { "Content-Length": String(object.size) } : {}) } });
}
