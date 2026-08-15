import { env } from "cloudflare:workers";
import { THREE_CHOICE_TENANT_ID, validateVideoJobPayload, type ThreeChoiceVideoJobPayload } from "@/app/lib/three-choice-video";

type Params = Promise<{ id: string }>;

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

async function logJob(jobId: string, action: string, status: string, detail: unknown) {
  await env.DB.prepare(
    "INSERT INTO three_choice_video_job_logs (id, tenant_id, job_id, action, status, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), THREE_CHOICE_TENANT_ID, jobId, action, status, JSON.stringify(detail || {}))
    .run();
}

export async function POST(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const jobId = clean(id, 120);
  const job = await env.DB.prepare("SELECT * FROM three_choice_video_jobs WHERE tenant_id = ? AND id = ? LIMIT 1")
    .bind(THREE_CHOICE_TENANT_ID, jobId)
    .first<{ id: string; retry_count: number; job_payload: string }>();
  if (!job) return Response.json({ error: "Video job not found." }, { status: 404 });
  let payload: ThreeChoiceVideoJobPayload;
  try {
    payload = JSON.parse(job.job_payload) as ThreeChoiceVideoJobPayload;
  } catch {
    return Response.json({ error: "Stored job payload is invalid." }, { status: 422 });
  }
  const validation = validateVideoJobPayload(payload);
  if (!validation.valid) return Response.json({ error: "Stored job payload is invalid.", details: validation.errors }, { status: 422 });
  const rendererUrl = clean((env as any).VIDEO_RENDERER_URL, 1000);
  if (!rendererUrl) {
    await env.DB.prepare("UPDATE three_choice_video_jobs SET retry_count = retry_count + 1, status = 'failed', error_code = 'renderer_unconfigured', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .bind("VIDEO_RENDERER_URL is not configured.", THREE_CHOICE_TENANT_ID, jobId)
      .run();
    await logJob(jobId, "retry.skipped", "failed", { reason: "renderer_unconfigured" });
    return Response.json({ ok: false, status: "failed", error: "VIDEO_RENDERER_URL is not configured." }, { status: 202 });
  }
  await env.DB.prepare("UPDATE three_choice_video_jobs SET retry_count = retry_count + 1, status = 'rendering', started_at = CURRENT_TIMESTAMP, error_code = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(THREE_CHOICE_TENANT_ID, jobId)
    .run();
  await logJob(jobId, "retry.started", "rendering", { renderer: rendererUrl.replace(/\/+$/, "") });
  const response = await fetch(`${rendererUrl.replace(/\/+$/, "")}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(clean((env as any).VIDEO_RENDERER_TOKEN, 500) ? { Authorization: `Bearer ${clean((env as any).VIDEO_RENDERER_TOKEN, 500)}` } : {}),
    },
    body: JSON.stringify({ jobId, payload }),
  });
  const data = (await response.json().catch(() => ({}))) as { rendererJobId?: string; outputUrl?: string; thumbnailUrl?: string; error?: string };
  if (!response.ok) {
    await env.DB.prepare("UPDATE three_choice_video_jobs SET status = 'failed', error_code = 'renderer_submit_failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .bind(data.error || `Renderer returned ${response.status}`, THREE_CHOICE_TENANT_ID, jobId)
      .run();
    await logJob(jobId, "retry.failed", "failed", { responseStatus: response.status, data });
    return Response.json({ ok: false, status: "failed", error: data.error || "Renderer submit failed." }, { status: 202 });
  }
  const status = data.outputUrl ? "completed" : "rendering";
  await env.DB.prepare("UPDATE three_choice_video_jobs SET status = ?, renderer_job_id = ?, output_url = ?, thumbnail_url = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(status, clean(data.rendererJobId, 200), clean(data.outputUrl, 1000), clean(data.thumbnailUrl, 1000), status, THREE_CHOICE_TENANT_ID, jobId)
    .run();
  await logJob(jobId, "retry.submitted", status, data);
  return Response.json({ ok: true, status, ...data }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
