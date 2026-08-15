import { env } from "cloudflare:workers";
import { THREE_CHOICE_TENANT_ID } from "@/app/lib/three-choice-video";

type Params = Promise<{ id: string }>;

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const jobId = clean(id, 120);
  const job = await env.DB.prepare("SELECT * FROM three_choice_video_jobs WHERE tenant_id = ? AND id = ? LIMIT 1")
    .bind(THREE_CHOICE_TENANT_ID, jobId)
    .first();
  if (!job) return Response.json({ error: "Video job not found." }, { status: 404 });
  const logs = await env.DB.prepare("SELECT * FROM three_choice_video_job_logs WHERE tenant_id = ? AND job_id = ? ORDER BY datetime(created_at) DESC LIMIT 50")
    .bind(THREE_CHOICE_TENANT_ID, jobId)
    .all();
  return Response.json({ ok: true, job, logs: logs.results || [] }, { headers: { "Cache-Control": "no-store" } });
}
