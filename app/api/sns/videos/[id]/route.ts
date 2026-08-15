import { env } from "cloudflare:workers";
import { THREE_CHOICE_TENANT_ID, captionFromThreeChoice, type ThreeChoiceVideoJobPayload } from "@/app/lib/three-choice-video";

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
  return job ? Response.json({ ok: true, job }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Video job not found." }, { status: 404 });
}

export async function POST(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const jobId = clean(id, 120);
  const job = await env.DB.prepare("SELECT * FROM three_choice_video_jobs WHERE tenant_id = ? AND id = ? LIMIT 1")
    .bind(THREE_CHOICE_TENANT_ID, jobId)
    .first<{ id: string; status: string; output_url: string; thumbnail_url: string; job_payload: string }>();
  if (!job) return Response.json({ error: "Video job not found." }, { status: 404 });
  if (job.status !== "completed" || !job.output_url) return Response.json({ error: "Only completed jobs with output_url can be queued to SNS." }, { status: 409 });
  const duplicate = await env.DB.prepare("SELECT id FROM sns_posts WHERE tenant_id = ? AND duplicate_warning = ? LIMIT 1")
    .bind(THREE_CHOICE_TENANT_ID, `three-choice-video:${jobId}`)
    .first<{ id: string }>();
  if (duplicate) return Response.json({ ok: true, snsPostId: duplicate.id, duplicate: true });

  let payload: ThreeChoiceVideoJobPayload;
  try {
    payload = JSON.parse(job.job_payload) as ThreeChoiceVideoJobPayload;
  } catch {
    return Response.json({ error: "Stored job payload is invalid." }, { status: 422 });
  }

  const snsPostId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO sns_posts
      (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, media_type, media_url, thumbnail_url, status, ai_generated, duplicate_warning)
      VALUES (?, ?, 'instagram', 'reel', ?, ?, ?, 'レイヴン・ブラックウッド', '3択動画から鑑定導線を作る', ?, ?, ?, ?, 'video', ?, ?, 'draft', 1, ?)`,
  )
    .bind(snsPostId, THREE_CHOICE_TENANT_ID, payload.theme, payload.theme, "3択動画", payload.cta, captionFromThreeChoice(payload), "#レイヴンブラックウッド #3択占い #占い #オラクルカード", JSON.stringify(payload.timeline), job.output_url, job.thumbnail_url || "", `three-choice-video:${jobId}`)
    .run();
  await env.DB.prepare("INSERT INTO three_choice_video_job_logs (id, tenant_id, job_id, action, status, detail_json) VALUES (?, ?, ?, 'sns.queued', 'draft', ?)")
    .bind(crypto.randomUUID(), THREE_CHOICE_TENANT_ID, jobId, JSON.stringify({ snsPostId }))
    .run();
  return Response.json({ ok: true, snsPostId }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
