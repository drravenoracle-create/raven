import { env } from "cloudflare:workers";
import { MockVideoRendererProvider, REEL_ENGINE_TENANT_ID, type ReelProject } from "@/app/lib/reel-engine";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parseJson<T>(value: unknown, fallback: T): T {
  try { return typeof value === "string" ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function toProject(row: any): ReelProject {
  return {
    tenantId: row.tenant_id,
    reelId: row.reel_id,
    title: row.title,
    objective: row.objective,
    platform: row.platform,
    aspectRatio: row.aspect_ratio,
    duration: Number(row.duration),
    status: row.status,
    script: parseJson(row.script_json, { hook: row.title, scenes: [], cta: "", backgroundCategories: [], tempo: "medium", bgmMood: "calm" }),
    scenes: parseJson(row.scenes_json, []),
    backgroundAssetIds: parseJson(row.background_asset_ids_json, []),
    textLayers: parseJson(row.text_layers_json, []),
    brandPresetId: row.brand_preset_id,
    audioAssetId: row.audio_asset_id,
    rendererProvider: row.renderer_provider,
    outputAssetId: row.output_asset_id,
    campaignId: row.campaign_id,
    sourceContentId: row.source_content_id,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const reelId = clean(body.reel_id ?? body.reelId, 120);
  if (!reelId) return Response.json({ error: "reel_id is required." }, { status: 400 });

  const settings = await env.DB.prepare("SELECT enabled, renderer_provider, monthly_render_count, entitlement_json FROM reel_engine_settings WHERE tenant_id = ? LIMIT 1")
    .bind(REEL_ENGINE_TENANT_ID)
    .first<{ enabled: number; renderer_provider: string; monthly_render_count: number; entitlement_json: string }>();
  if (!settings || settings.enabled === 0) return Response.json({ error: "Reel Engine is disabled." }, { status: 403 });
  const entitlement = parseJson(settings.entitlement_json, { monthly_render_limit: 0 });
  if (Number(settings.monthly_render_count || 0) >= Number(entitlement.monthly_render_limit || 0)) return Response.json({ error: "Monthly render limit reached." }, { status: 429 });

  const row = await env.DB.prepare("SELECT * FROM reel_projects WHERE tenant_id = ? AND reel_id = ? LIMIT 1")
    .bind(REEL_ENGINE_TENANT_ID, reelId)
    .first<any>();
  if (!row) return Response.json({ error: "Reel project not found." }, { status: 404 });

  const duplicate = await env.DB.prepare("SELECT job_id, status FROM reel_render_jobs WHERE tenant_id = ? AND reel_id = ? AND status IN ('queued','rendering','unavailable') LIMIT 1")
    .bind(REEL_ENGINE_TENANT_ID, reelId)
    .first<{ job_id: string; status: string }>();
  if (duplicate) return Response.json({ ok: true, jobId: duplicate.job_id, status: duplicate.status, duplicate: true });

  const project = toProject({ ...row, renderer_provider: settings.renderer_provider || row.renderer_provider || "unconfigured" });
  const provider = new MockVideoRendererProvider();
  const job = await provider.createRenderJob(project);
  await env.DB.prepare("INSERT INTO reel_render_jobs (job_id, tenant_id, reel_id, provider, status, request_json, response_json, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(job.jobId, REEL_ENGINE_TENANT_ID, reelId, project.rendererProvider, job.status, JSON.stringify(project), JSON.stringify(job), job.status === "unavailable" ? job.message || "Renderer unavailable" : null)
    .run();
  await env.DB.prepare("UPDATE reel_projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND reel_id = ?")
    .bind(job.status === "queued" ? "rendering" : "planned", REEL_ENGINE_TENANT_ID, reelId)
    .run();
  await env.DB.prepare("INSERT INTO reel_engine_audit_logs (id, tenant_id, reel_id, action, detail_json) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), REEL_ENGINE_TENANT_ID, reelId, "render.requested", JSON.stringify(job))
    .run();
  return Response.json({ ok: true, ...job }, { status: job.status === "unavailable" ? 202 : 201, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reelId = clean(url.searchParams.get("reelId"), 120);
  const result = await env.DB.prepare("SELECT * FROM reel_render_jobs WHERE tenant_id = ? AND (? = '' OR reel_id = ?) ORDER BY datetime(created_at) DESC LIMIT 50")
    .bind(REEL_ENGINE_TENANT_ID, reelId, reelId)
    .all();
  return Response.json({ jobs: result.results || [] }, { headers: { "Cache-Control": "no-store" } });
}
