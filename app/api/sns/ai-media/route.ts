import { env } from "cloudflare:workers";
import {
  AI_MEDIA_TENANT_ID,
  OpenAiImageProvider,
  buildPrompt,
  cleanAiMediaText,
  estimateConfiguredCost,
  hasPromptInjectionRisk,
  sizeForAspectRatio,
  type AiMediaSettings,
  type MediaGenerationRequest,
} from "@/app/lib/ai-media/generator";

type MediaBucket = {
  put(key: string, value: ArrayBuffer | Blob | ReadableStream, options?: Record<string, unknown>): Promise<unknown>;
};

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function assertTenant(value: unknown) {
  const tenantId = clean(value, 80) || AI_MEDIA_TENANT_ID;
  if (tenantId !== AI_MEDIA_TENANT_ID) throw new Error("Invalid tenant_id");
  return tenantId;
}

function bucket() {
  return (env as any).MEDIA_BUCKET as MediaBucket | undefined;
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function settings() {
  return await env.DB.prepare("SELECT * FROM ai_media_settings WHERE tenant_id = ? LIMIT 1").bind(AI_MEDIA_TENANT_ID).first<AiMediaSettings>();
}

async function monthlySpent() {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(actual_cost), SUM(estimated_cost), 0) AS total FROM ai_media_cost_logs WHERE tenant_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
  ).bind(AI_MEDIA_TENANT_ID).first<{ total: number }>();
  return Number(row?.total || 0);
}

async function logCost(jobId: string, provider: string, model: string, action: string, estimated: number, actual = 0) {
  await env.DB.prepare(
    "INSERT INTO ai_media_cost_logs (cost_id, tenant_id, job_id, provider, model, action, estimated_cost, actual_cost, units) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
  ).bind(crypto.randomUUID(), AI_MEDIA_TENANT_ID, jobId, provider, model, action, estimated, actual).run();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    assertTenant(url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id"));
  } catch {
    return Response.json({ ok: false, error: "Invalid tenant_id" }, { status: 400 });
  }
  const [config, jobs, assets, presets, prompts, providers, spent] = await Promise.all([
    settings(),
    env.DB.prepare("SELECT * FROM ai_media_jobs WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 30").bind(AI_MEDIA_TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM ai_media_assets WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 30").bind(AI_MEDIA_TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM ai_media_presets WHERE tenant_id = ? AND enabled = 1 ORDER BY character_id, name").bind(AI_MEDIA_TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM ai_media_prompts WHERE tenant_id = ? AND enabled = 1 ORDER BY name").bind(AI_MEDIA_TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM ai_media_provider_config WHERE tenant_id IN ('GLOBAL', ?) ORDER BY provider_id").bind(AI_MEDIA_TENANT_ID).all(),
    monthlySpent(),
  ]);
  return Response.json({
    ok: true,
    settings: config,
    monthlySpent: spent,
    jobs: jobs.results || [],
    assets: assets.results || [],
    presets: presets.results || [],
    prompts: prompts.results || [],
    providers: providers.results || [],
    hasOpenAiSecret: Boolean(clean((env as any).OPENAI_API_KEY, 20)),
    hasMediaBucket: Boolean(bucket()),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  try {
    assertTenant(body.tenant_id ?? body.tenantId);
  } catch {
    return Response.json({ ok: false, error: "Invalid tenant_id" }, { status: 400 });
  }
  const action = clean(body.action, 80);
  if (action !== "generate_image") return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });

  const config = await settings();
  if (!config) return Response.json({ ok: false, error: "AI Media settings are not initialized." }, { status: 503 });
  const jobId = crypto.randomUUID();
  const aspectRatio = clean(body.aspect_ratio ?? body.aspectRatio, 20) || config.default_aspect_ratio || "9:16";
  const size = sizeForAspectRatio(aspectRatio);
  const requestPayload: MediaGenerationRequest = {
    tenantId: AI_MEDIA_TENANT_ID,
    theme: cleanAiMediaText(body.theme, 180) || "今日のメッセージ",
    characterId: cleanAiMediaText(body.character_id ?? body.characterId, 80) || "raven",
    divinationType: cleanAiMediaText(body.divination_type ?? body.divinationType, 80) || "oracle",
    season: cleanAiMediaText(body.season, 80),
    mood: cleanAiMediaText(body.mood, 80) || "quiet mystical",
    scene: cleanAiMediaText(body.scene, 160) || "oracle cards on a quiet desk",
    platform: cleanAiMediaText(body.platform, 80) || "instagram",
    aspectRatio,
    brandStyle: cleanAiMediaText(body.brand_style ?? body.brandStyle, 240) || "Raven Oracle, refined, readable, calm",
    negativeInstructions: cleanAiMediaText(body.negative_instructions ?? body.negativeInstructions, 300) || "no gore, no medical/legal/financial claims, no readable text",
    postId: clean(body.post_id ?? body.postId, 120),
    experimentId: clean(body.experiment_id ?? body.experimentId, 120),
  };
  const promptTemplate = await env.DB.prepare("SELECT template FROM ai_media_prompts WHERE tenant_id = ? AND enabled = 1 ORDER BY datetime(updated_at) DESC LIMIT 1")
    .bind(AI_MEDIA_TENANT_ID).first<{ template: string }>();
  const prompt = buildPrompt(promptTemplate?.template || "{{theme}}", requestPayload);
  const spent = await monthlySpent();
  const cost = estimateConfiguredCost(spent, config, 1);

  await env.DB.prepare(
    `INSERT INTO ai_media_jobs
      (job_id, tenant_id, post_id, experiment_id, provider, model, media_type, aspect_ratio, status, prompt_snapshot, request_json, estimated_cost)
     VALUES (?, ?, ?, ?, ?, ?, 'image', ?, 'queued', ?, ?, ?)`,
  ).bind(jobId, AI_MEDIA_TENANT_ID, requestPayload.postId || "", requestPayload.experimentId || "", config.provider, config.model, aspectRatio, prompt, JSON.stringify({ ...requestPayload, size: size.size, quality: config.quality }), cost.estimated).run();

  if (!config.enabled) {
    await env.DB.prepare("UPDATE ai_media_jobs SET status = 'failed', error_code = 'ai_media_disabled', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND job_id = ?")
      .bind("AI Media Generator is disabled in settings.", AI_MEDIA_TENANT_ID, jobId).run();
    await logCost(jobId, config.provider, config.model, "image.skipped.disabled", cost.estimated, 0);
    return Response.json({ ok: false, jobId, error: "AI Media Generator is disabled. Enable it in the AI Media screen first." }, { status: 409 });
  }
  if (!cost.allowed) {
    await env.DB.prepare("UPDATE ai_media_jobs SET status = 'failed', error_code = 'budget_limit', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND job_id = ?")
      .bind("Budget guard blocked this generation.", AI_MEDIA_TENANT_ID, jobId).run();
    await logCost(jobId, config.provider, config.model, "image.blocked.budget", cost.estimated, 0);
    return Response.json({ ok: false, jobId, error: "Budget guard blocked this generation.", cost }, { status: 402 });
  }
  if (hasPromptInjectionRisk(prompt)) {
    await env.DB.prepare("UPDATE ai_media_jobs SET status = 'failed', error_code = 'prompt_guard', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND job_id = ?")
      .bind("Prompt guard blocked unsafe instructions.", AI_MEDIA_TENANT_ID, jobId).run();
    return Response.json({ ok: false, jobId, error: "Prompt guard blocked unsafe instructions." }, { status: 422 });
  }
  const mediaBucket = bucket();
  if (!mediaBucket) {
    await env.DB.prepare("UPDATE ai_media_jobs SET status = 'failed', error_code = 'media_bucket_unconfigured', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND job_id = ?")
      .bind("R2 MEDIA_BUCKET is not configured.", AI_MEDIA_TENANT_ID, jobId).run();
    return Response.json({ ok: false, jobId, error: "R2 MEDIA_BUCKET is not configured." }, { status: 503 });
  }

  try {
    await env.DB.prepare("UPDATE ai_media_jobs SET status = 'generating', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND job_id = ?").bind(AI_MEDIA_TENANT_ID, jobId).run();
    const provider = new OpenAiImageProvider(clean((env as any).OPENAI_API_KEY, 4000));
    const result = await provider.generateImage({ ...requestPayload, prompt, model: config.model, quality: config.quality, size: size.size });
    const checksum = await sha256Hex(result.bytes);
    const assetId = crypto.randomUUID();
    const storageKey = `media/ai/images/${AI_MEDIA_TENANT_ID}/${assetId}.png`;
    await mediaBucket.put(storageKey, result.bytes, {
      httpMetadata: { contentType: result.mimeType },
      customMetadata: { tenant_id: AI_MEDIA_TENANT_ID, job_id: jobId, asset_id: assetId, checksum },
    });
    await env.DB.prepare(
      `INSERT INTO media_video_assets
        (asset_id, tenant_id, source, storage_key, duration, width, height, tags_json, category, mood, license_type, mime_type, size_bytes, checksum, performance_score)
       VALUES (?, ?, 'ai_generated', ?, 0, ?, ?, ?, 'ai-image', ?, 'generated', ?, ?, ?, 0)`,
    ).bind(assetId, AI_MEDIA_TENANT_ID, storageKey, size.width, size.height, JSON.stringify(["ai-media", requestPayload.characterId, requestPayload.platform]), requestPayload.mood, result.mimeType, result.bytes.byteLength, checksum).run();
    await env.DB.prepare(
      `INSERT INTO ai_media_assets
        (asset_id, tenant_id, job_id, media_video_asset_id, provider, media_type, mime_type, width, height, aspect_ratio, storage_provider, storage_key, preview_url, prompt_snapshot, status)
       VALUES (?, ?, ?, ?, ?, 'image', ?, ?, ?, ?, 'r2', ?, ?, ?, 'ready')`,
    ).bind(assetId, AI_MEDIA_TENANT_ID, jobId, assetId, provider.providerId, result.mimeType, size.width, size.height, aspectRatio, storageKey, `/api/reel-engine/assets?assetId=${encodeURIComponent(assetId)}`, prompt).run();
    await env.DB.prepare("UPDATE ai_media_jobs SET status = 'ready', response_json = ?, actual_cost = ?, asset_id = ?, storage_key = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND job_id = ?")
      .bind(JSON.stringify(result.responseJson), result.actualCost || cost.estimated, assetId, storageKey, AI_MEDIA_TENANT_ID, jobId).run();
    await logCost(jobId, config.provider, config.model, "image.generated", cost.estimated, result.actualCost || cost.estimated);
    return Response.json({ ok: true, jobId, assetId, previewUrl: `/api/reel-engine/assets?assetId=${encodeURIComponent(assetId)}`, storageKey }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await env.DB.prepare("UPDATE ai_media_jobs SET status = 'failed', error_code = 'provider_error', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND job_id = ?")
      .bind(error instanceof Error ? error.message.slice(0, 500) : "Provider failed.", AI_MEDIA_TENANT_ID, jobId).run();
    await logCost(jobId, config.provider, config.model, "image.failed", cost.estimated, 0);
    return Response.json({ ok: false, jobId, error: error instanceof Error ? error.message : "Provider failed." }, { status: 502 });
  }
}
