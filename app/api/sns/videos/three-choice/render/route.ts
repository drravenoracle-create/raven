import { env } from "cloudflare:workers";
import {
  THREE_CHOICE_TENANT_ID,
  THREE_CHOICE_TEMPLATE_ID,
  captionFromThreeChoice,
  recordThreeChoiceUsage,
  validateVideoJobPayload,
  type ThreeChoiceVideoJobPayload,
} from "@/app/lib/three-choice-video";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function assertTenant(value: unknown) {
  const tenantId = clean(value, 80) || THREE_CHOICE_TENANT_ID;
  if (tenantId !== THREE_CHOICE_TENANT_ID) throw new Error("Invalid tenant_id");
  return tenantId;
}

function rendererUrl() {
  return clean((env as any).VIDEO_RENDERER_URL, 1000);
}

async function logJob(jobId: string, action: string, status: string, detail: unknown, durationMs?: number) {
  await env.DB.prepare(
    "INSERT INTO three_choice_video_job_logs (id, tenant_id, job_id, action, status, detail_json, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), THREE_CHOICE_TENANT_ID, jobId, action, status, JSON.stringify(detail || {}), durationMs ?? null)
    .run();
}

async function submitRenderer(jobId: string, payload: ThreeChoiceVideoJobPayload) {
  const url = rendererUrl();
  if (!url) {
    await env.DB.prepare(
      "UPDATE three_choice_video_jobs SET status = 'failed', error_code = 'renderer_unconfigured', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?",
    )
      .bind("VIDEO_RENDERER_URL is not configured. Job payload is ready, but no external renderer is connected.", THREE_CHOICE_TENANT_ID, jobId)
      .run();
    await logJob(jobId, "render.skipped", "failed", { reason: "renderer_unconfigured" });
    return { status: "failed", error: "VIDEO_RENDERER_URL is not configured." };
  }

  const started = Date.now();
  await env.DB.prepare("UPDATE three_choice_video_jobs SET status = 'rendering', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
    .bind(THREE_CHOICE_TENANT_ID, jobId)
    .run();
  await logJob(jobId, "render.submit", "rendering", { renderer: url.replace(/\/+$/, "") });

  const response = await fetch(`${url.replace(/\/+$/, "")}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(clean((env as any).VIDEO_RENDERER_TOKEN, 500) ? { Authorization: `Bearer ${clean((env as any).VIDEO_RENDERER_TOKEN, 500)}` } : {}),
    },
    body: JSON.stringify({ jobId, payload }),
  });
  const data = (await response.json().catch(() => ({}))) as { rendererJobId?: string; status?: string; outputUrl?: string; thumbnailUrl?: string; error?: string };
  const elapsed = Date.now() - started;
  if (!response.ok) {
    await env.DB.prepare(
      "UPDATE three_choice_video_jobs SET status = 'failed', error_code = 'renderer_submit_failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?",
    )
      .bind(data.error || `Renderer returned ${response.status}`, THREE_CHOICE_TENANT_ID, jobId)
      .run();
    await logJob(jobId, "render.submit_failed", "failed", { status: response.status, data }, elapsed);
    return { status: "failed", error: data.error || "Renderer submit failed." };
  }

  const completed = data.outputUrl ? "completed" : "rendering";
  await env.DB.prepare(
    "UPDATE three_choice_video_jobs SET status = ?, renderer_job_id = ?, output_url = ?, thumbnail_url = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?",
  )
    .bind(completed, clean(data.rendererJobId, 200), clean(data.outputUrl, 1000), clean(data.thumbnailUrl, 1000), completed, THREE_CHOICE_TENANT_ID, jobId)
    .run();
  await logJob(jobId, "render.submitted", completed, data, elapsed);
  return { status: completed, rendererJobId: data.rendererJobId, outputUrl: data.outputUrl };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  try {
    assertTenant(body.tenant_id ?? body.tenantId);
  } catch {
    return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  }
  const payload = body.job_payload ?? body.jobPayload;
  const validation = validateVideoJobPayload(payload as ThreeChoiceVideoJobPayload);
  if (!validation.valid) return Response.json({ error: "Invalid video job payload.", details: validation.errors }, { status: 422 });

  const typedPayload = payload as ThreeChoiceVideoJobPayload;
  const duplicate = await env.DB.prepare(
    "SELECT id, status FROM three_choice_video_jobs WHERE tenant_id = ? AND theme = ? AND deck_id = ? AND status IN ('queued','rendering','completed') ORDER BY datetime(created_at) DESC LIMIT 1",
  )
    .bind(THREE_CHOICE_TENANT_ID, typedPayload.theme, typedPayload.deckId)
    .first<{ id: string; status: string }>();
  if (duplicate && body.allow_duplicate !== true && body.allowDuplicate !== true) {
    return Response.json({ ok: true, duplicate: true, jobId: duplicate.id, status: duplicate.status }, { headers: { "Cache-Control": "no-store" } });
  }

  const jobId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO three_choice_video_jobs
      (id, tenant_id, character_id, template_id, status, theme, category, deck_id, job_payload, renderer_provider)
      VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?)`,
  )
    .bind(jobId, THREE_CHOICE_TENANT_ID, "raven", THREE_CHOICE_TEMPLATE_ID, typedPayload.theme, typedPayload.category, typedPayload.deckId, JSON.stringify(typedPayload), rendererUrl() ? "external_http" : "unconfigured")
    .run();
  await recordThreeChoiceUsage(env.DB, typedPayload, jobId);
  await logJob(jobId, "job.created", "queued", { theme: typedPayload.theme, deckId: typedPayload.deckId });
  const renderResult = await submitRenderer(jobId, typedPayload);

  if (body.queue_to_sns === true || body.queueToSns === true) {
    const outputUrl = clean((renderResult as { outputUrl?: string }).outputUrl, 1000);
    if (outputUrl) {
      const snsPostId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO sns_posts
          (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, media_type, media_url, thumbnail_url, status, ai_generated, duplicate_warning)
          VALUES (?, ?, 'instagram', 'reel', ?, ?, ?, 'レイヴン・ブラックウッド', '3択動画から鑑定導線を作る', ?, ?, ?, ?, 'video', ?, ?, 'draft', 1, ?)`,
      )
        .bind(snsPostId, THREE_CHOICE_TENANT_ID, typedPayload.theme, typedPayload.theme, "3択動画", typedPayload.cta, captionFromThreeChoice(typedPayload), "#レイヴンブラックウッド #3択占い #占い #オラクルカード", JSON.stringify(typedPayload.timeline), outputUrl, "", `three-choice-video:${jobId}`)
        .run();
      await logJob(jobId, "sns.queued", "draft", { snsPostId });
    }
  }

  return Response.json({ ok: true, jobId, ...renderResult }, { status: 202, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const result = await env.DB.prepare("SELECT * FROM three_choice_video_jobs WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 50")
    .bind(THREE_CHOICE_TENANT_ID)
    .all();
  return Response.json({ ok: true, jobs: result.results || [] }, { headers: { "Cache-Control": "no-store" } });
}
