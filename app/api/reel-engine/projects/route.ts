import { env } from "cloudflare:workers";
import { REEL_ENGINE_TENANT_ID, REEL_ENGINE_VERSION, composeScenes, defaultEntitlement, generateReelScript, reelProjectToSnsDraft, selectBackgroundAssets, validateComposition, type ReelDuration, type VideoAsset } from "@/app/lib/reel-engine";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parseJson<T>(value: unknown, fallback: T): T {
  try { return typeof value === "string" ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function duration(value: unknown): ReelDuration {
  const n = Number(value || 30);
  return n === 15 || n === 60 ? n : 30;
}

async function settings() {
  const row = await env.DB.prepare("SELECT * FROM reel_engine_settings WHERE tenant_id = ? LIMIT 1").bind(REEL_ENGINE_TENANT_ID).first<{ enabled: number; plan: string; entitlement_json: string; renderer_provider: string }>();
  const entitlement = defaultEntitlement(row?.plan || "STANDARD", parseJson(row?.entitlement_json, {}));
  return { enabled: row?.enabled !== 0, rendererProvider: row?.renderer_provider || "unconfigured", entitlement };
}

export async function GET() {
  const result = await env.DB.prepare("SELECT * FROM reel_projects WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 100")
    .bind(REEL_ENGINE_TENANT_ID)
    .all();
  return Response.json({ projects: result.results || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const config = await settings();
  if (!config.enabled || !config.entitlement.reel_engine || !config.entitlement.reel_basic) return Response.json({ error: "Reel Engine is not enabled for this tenant." }, { status: 403 });

  const title = clean(body.title, 180) || "迷った時に選択肢を整える30秒リール";
  const reelDuration = duration(body.duration);
  const objective = clean(body.objective, 240) || "ブログ記事からSNS向けの短尺動画導線を作る";
  const platform = clean(body.platform, 40) || "instagram";
  const sourceContentId = clean(body.source_content_id ?? body.sourceContentId, 120);
  const idempotencyKey = clean(body.idempotency_key ?? body.idempotencyKey, 200) || `reel:${REEL_ENGINE_TENANT_ID}:${sourceContentId || title}:${reelDuration}`;

  const duplicate = await env.DB.prepare("SELECT reel_id FROM reel_projects WHERE tenant_id = ? AND idempotency_key = ? LIMIT 1")
    .bind(REEL_ENGINE_TENANT_ID, idempotencyKey)
    .first<{ reel_id: string }>();
  if (duplicate) return Response.json({ ok: true, reelId: duplicate.reel_id, duplicate: true });

  const script = generateReelScript({ title, objective, duration: reelDuration, cta: clean(body.cta, 240) });
  const assets = await env.DB.prepare("SELECT * FROM media_video_assets WHERE tenant_id = ? ORDER BY usage_count ASC, performance_score DESC LIMIT 20")
    .bind(REEL_ENGINE_TENANT_ID)
    .all<any>();
  const normalizedAssets: VideoAsset[] = (assets.results || []).map((asset) => ({ assetId: asset.asset_id, tenantId: asset.tenant_id, source: asset.source, storageKey: asset.storage_key, duration: Number(asset.duration || 0), width: Number(asset.width || 1080), height: Number(asset.height || 1920), tags: parseJson(asset.tags_json, []), category: asset.category, mood: asset.mood, usageCount: Number(asset.usage_count || 0), performanceScore: Number(asset.performance_score || 0) }));
  const selectedAssets = selectBackgroundAssets(script, normalizedAssets, script.scenes.length);
  const backgroundAssetIds = selectedAssets.map((asset) => asset.assetId);
  const composition = composeScenes(reelDuration, script, backgroundAssetIds);
  const validation = validateComposition({ duration: reelDuration, scenes: composition.scenes, textLayers: composition.textLayers });
  if (!validation.valid) return Response.json({ error: "Invalid reel composition.", details: validation.errors }, { status: 422 });

  const reelId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO reel_projects
      (reel_id, tenant_id, title, objective, platform, aspect_ratio, duration, status, script_json, scenes_json, background_asset_ids_json, text_layers_json, brand_preset_id, renderer_provider, campaign_id, source_content_id, source_type, metadata_json, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(reelId, REEL_ENGINE_TENANT_ID, title, objective, platform, "9:16", reelDuration, "planned", JSON.stringify(script), JSON.stringify(composition.scenes), JSON.stringify(backgroundAssetIds), JSON.stringify(composition.textLayers), clean(body.brand_preset_id ?? body.brandPresetId, 120) || "Raven Blackwood", config.rendererProvider, clean(body.campaign_id ?? body.campaignId, 120), sourceContentId, sourceContentId ? "blog_article" : "manual", JSON.stringify({ version: REEL_ENGINE_VERSION, tempo: script.tempo, bgmMood: script.bgmMood }), idempotencyKey)
    .run();
  for (const assetId of backgroundAssetIds) await env.DB.prepare("UPDATE media_video_assets SET usage_count = usage_count + 1 WHERE tenant_id = ? AND asset_id = ?").bind(REEL_ENGINE_TENANT_ID, assetId).run();
  await env.DB.prepare("INSERT INTO reel_engine_audit_logs (id, tenant_id, reel_id, action, detail_json) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), REEL_ENGINE_TENANT_ID, reelId, "reel.created", JSON.stringify({ sourceContentId, platform, duration: reelDuration })).run();
  return Response.json({ ok: true, reelId, status: "planned", script, scenes: composition.scenes, textLayers: composition.textLayers, backgroundAssetIds }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const reelId = clean(body.reel_id ?? body.reelId, 120);
  const status = clean(body.status, 40);
  if (!reelId || !status) return Response.json({ error: "reel_id and status are required." }, { status: 400 });
  const allowed = new Set(["draft", "planned", "rendering", "rendered", "approved", "scheduled", "published", "failed"]);
  if (!allowed.has(status)) return Response.json({ error: "Invalid reel status." }, { status: 400 });
  await env.DB.prepare("UPDATE reel_projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND reel_id = ?").bind(status, REEL_ENGINE_TENANT_ID, reelId).run();
  await env.DB.prepare("INSERT INTO reel_engine_audit_logs (id, tenant_id, reel_id, action, detail_json) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), REEL_ENGINE_TENANT_ID, reelId, "reel.status_updated", JSON.stringify({ status })).run();
  return Response.json({ ok: true, reelId, status }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const reelId = clean(body.reel_id ?? body.reelId, 120);
  const project = await env.DB.prepare("SELECT * FROM reel_projects WHERE tenant_id = ? AND reel_id = ? LIMIT 1").bind(REEL_ENGINE_TENANT_ID, reelId).first<any>();
  if (!project) return Response.json({ error: "Reel project not found." }, { status: 404 });
  const script = parseJson(project.script_json, { hook: project.title, scenes: [], cta: "", backgroundCategories: [], tempo: "medium", bgmMood: "calm" });
  const snsDraft = reelProjectToSnsDraft({ tenantId: project.tenant_id, reelId: project.reel_id, title: project.title, objective: project.objective, platform: project.platform, aspectRatio: project.aspect_ratio, duration: project.duration, status: project.status, script, scenes: parseJson(project.scenes_json, []), backgroundAssetIds: parseJson(project.background_asset_ids_json, []), textLayers: parseJson(project.text_layers_json, []), brandPresetId: project.brand_preset_id, rendererProvider: project.renderer_provider, outputAssetId: project.output_asset_id, campaignId: project.campaign_id, sourceContentId: project.source_content_id });
  const duplicateKey = `reel:${reelId}`;
  const existing = await env.DB.prepare("SELECT id FROM sns_posts WHERE tenant_id = ? AND duplicate_warning = ? LIMIT 1").bind(REEL_ENGINE_TENANT_ID, duplicateKey).first<{ id: string }>();
  if (existing) return Response.json({ ok: true, snsPostId: existing.id, duplicate: true });
  const snsPostId = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO sns_posts (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, script, status, duplicate_warning, ai_generated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(snsPostId, REEL_ENGINE_TENANT_ID, snsDraft.platform, snsDraft.postType, snsDraft.title, snsDraft.theme, snsDraft.category, snsDraft.character, snsDraft.purpose, snsDraft.cta, snsDraft.caption, snsDraft.script, "draft", duplicateKey, 1).run();
  await env.DB.prepare("INSERT INTO reel_engine_audit_logs (id, tenant_id, reel_id, action, detail_json) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), REEL_ENGINE_TENANT_ID, reelId, "reel.queued_to_sns", JSON.stringify({ snsPostId })).run();
  return Response.json({ ok: true, snsPostId }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
