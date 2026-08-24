import { env } from "cloudflare:workers";
import { POST as previewThreeChoice } from "@/app/api/sns/videos/three-choice/preview/route";
import { POST as renderThreeChoice } from "@/app/api/sns/videos/three-choice/render/route";
import { captionFromThreeChoice } from "@/app/lib/three-choice-video";
import { resolveSnsConfig } from "@/app/lib/tenant-config-resolver";

const SNS_CONFIG = resolveSnsConfig();
const TENANT_ID = SNS_CONFIG.tenantId;
const DEFAULT_RENDER_BACKGROUND = "https://raven.fortunestudios.jp/api/reel-engine/assets?assetId=98ce1cea-851a-4811-8751-fe128d179702";
function text(value: unknown, max = 4000) { return String(value ?? "").trim().slice(0, max); }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tenantId = new URL(request.url).searchParams.get("tenantId") || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const template = await env.DB.prepare("SELECT * FROM sns_post_templates WHERE tenant_id = ? AND id = ? LIMIT 1").bind(tenantId, id).first();
  if (!template) return Response.json({ error: "Template not found." }, { status: 404 });
  const versions = await env.DB.prepare("SELECT * FROM sns_post_template_versions WHERE tenant_id = ? AND template_id = ? ORDER BY version DESC").bind(tenantId, id).all();
  return Response.json({ template, versions: versions.results || [] });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const tenantId = text(body?.tenant_id ?? body?.tenantId, 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const current = await env.DB.prepare("SELECT * FROM sns_post_templates WHERE tenant_id = ? AND id = ? LIMIT 1").bind(tenantId, id).first<any>();
  if (!current) return Response.json({ error: "Template not found." }, { status: 404 });
  const version = Number(current.version || 1) + 1;
  await env.DB.prepare("UPDATE sns_post_templates SET name=?, description=?, category=?, status=?, duration_seconds=?, aspect_ratio=?, scene_schema=?, content_schema=?, default_cta=?, supported_platforms=?, supported_characters=?, tags=?, version=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?")
    .bind(text(body?.name ?? current.name, 160), text(body?.description ?? current.description), text(body?.category ?? current.category, 60), text(body?.status ?? current.status, 30), Number(body?.duration_seconds ?? body?.durationSeconds ?? current.duration_seconds), text(body?.aspect_ratio ?? body?.aspectRatio ?? current.aspect_ratio, 20), text(body?.scene_schema ?? body?.sceneSchema ?? current.scene_schema), text(body?.content_schema ?? body?.contentSchema ?? current.content_schema), text(body?.default_cta ?? body?.defaultCta ?? current.default_cta, 240), text(body?.supported_platforms ?? body?.supportedPlatforms ?? current.supported_platforms), text(body?.supported_characters ?? body?.supportedCharacters ?? current.supported_characters), text(body?.tags ?? current.tags), version, tenantId, id).run();
  await env.DB.prepare("INSERT INTO sns_post_template_versions (id,tenant_id,template_id,version,snapshot,created_by) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), tenantId, id, version, JSON.stringify({ ...current, ...body, version }), text(body?.created_by ?? body?.createdBy, 120) || "admin").run();
  return Response.json({ ok: true, id, version });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const tenantId = text(body?.tenant_id ?? body?.tenantId, 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const template = await env.DB.prepare("SELECT * FROM sns_post_templates WHERE tenant_id = ? AND id = ? AND status != 'archived' LIMIT 1").bind(tenantId, id).first<any>();
  if (!template) return Response.json({ error: "Template not found." }, { status: 404 });
  const action = text(body?.action, 40) || "preview";
  if (action === "duplicate") {
    const copyId = crypto.randomUUID();
    const slug = `${template.slug}-copy-${copyId.slice(0, 6)}`;
    await env.DB.prepare("INSERT INTO sns_post_templates (id,tenant_id,name,slug,format_type,format_key,category,description,version,status,duration_seconds,supported_durations,aspect_ratio,renderer_type,scene_schema,content_schema,default_media,default_cta,supported_platforms,supported_characters,tags,hook_schema,cta_schema,comment_prompt_schema,character_compatibility,required_assets,required_divination_systems,is_system_preset,enabled,ai_enabled,growth_enabled) SELECT ?,tenant_id,name || ' コピー',?,format_type,? || '-copy',category,description,1,'active',duration_seconds,supported_durations,aspect_ratio,renderer_type,scene_schema,content_schema,default_media,default_cta,supported_platforms,supported_characters,tags,hook_schema,cta_schema,comment_prompt_schema,character_compatibility,required_assets,required_divination_systems,0,1,ai_enabled,growth_enabled FROM sns_post_templates WHERE tenant_id=? AND id=?").bind(copyId, slug, slug, tenantId, id).run();
    return Response.json({ ok: true, id: copyId, slug }, { status: 201 });
  }
  if (action === "toggle") {
    const enabled = body?.enabled === false ? 0 : 1;
    await env.DB.prepare("UPDATE sns_post_templates SET enabled=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?")
      .bind(enabled, enabled ? "active" : "disabled", tenantId, id).run();
    return Response.json({ ok: true, id, enabled: Boolean(enabled) });
  }
  if (action === "create_post") {
    const content = body?.content && typeof body.content === "object" ? body.content as Record<string, unknown> : {};
    if (template.format_key === "next_72_hours_three_choice" || template.format_type === "three_choice_reading") {
      const deckId = text(content.deckId ?? content.deck_id, 120) || "85790ef8-3824-4969-a4e8-c85cacf4b931";
      const previewRequest = new Request(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        tenant_id: tenantId,
        deck_id: deckId,
        theme: text(content.theme, 180) || "72時間以内に起こること",
        category: text(content.category, 80) || "near_future",
        hook: text(content.hook, 80) || "72時間以内、あなたに起こること。",
        character: text(content.characterId, 80) || "raven",
        cta: text(content.cta, 160) || template.default_cta || SNS_CONFIG.defaultCta,
      }) });
      const previewResponse = await previewThreeChoice(previewRequest);
      const preview = await previewResponse.json().catch(() => ({})) as { ok?: boolean; payload?: Record<string, unknown>; error?: string };
      if (!previewResponse.ok || !preview.ok || !preview.payload) return Response.json({ ok: false, error: preview.error || "3択動画の構成を作成できませんでした。" }, { status: 422 });
      const rendererPayload = {
        ...preview.payload,
        background: /^https:\/\//i.test(text(preview.payload.background, 1000)) ? preview.payload.background : DEFAULT_RENDER_BACKGROUND,
      };
      const renderRequest = new Request(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenant_id: tenantId, job_payload: rendererPayload, allow_duplicate: true }) });
      const renderResponse = await renderThreeChoice(renderRequest);
      const renderResult = await renderResponse.json().catch(() => ({})) as { ok?: boolean; status?: string; jobId?: string; outputUrl?: string; thumbnailUrl?: string; error?: string };
      if (!renderResponse.ok || !renderResult.ok || renderResult.status === "failed") return Response.json({ ok: false, error: renderResult.error || "動画レンダリングに失敗しました。", render: renderResult }, { status: 502 });
      if (!renderResult.outputUrl) return Response.json({ ok: true, status: "rendering", renderJobId: renderResult.jobId, message: "動画レンダリング中です。完成後にSNS下書きへ紐付けてください。" }, { status: 202 });
      const postId = crypto.randomUUID();
      const platform = text(content.platform, 30) || "instagram";
      const payload = rendererPayload as { theme?: string; hook?: string; cta?: string; character?: string; timeline?: unknown; cards?: unknown[] };
      const caption = captionFromThreeChoice(payload as any);
      await env.DB.prepare("INSERT INTO sns_posts (id,tenant_id,platform,post_type,title,theme,category,character,purpose,cta,caption,hashtags,script,media_type,media_url,thumbnail_url,status,ai_generated,duplicate_warning) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(postId, tenantId, platform, platform === "youtube" ? "short" : "reel", text(content.title, 180) || template.name, payload.theme || template.name, template.category, payload.character || SNS_CONFIG.displayName, "テンプレートからレンダリングした動画を投稿する", payload.cta || template.default_cta || SNS_CONFIG.defaultCta, caption, SNS_CONFIG.hashtags.join(" "), JSON.stringify(payload.timeline || []), "video", renderResult.outputUrl, renderResult.thumbnailUrl || "", "draft", 1, `template:${template.id}:${template.version}:${postId}`).run();
      return Response.json({ ok: true, status: "draft", postId, renderJobId: renderResult.jobId, outputUrl: renderResult.outputUrl, templateId: template.id, templateVersion: template.version });
    }
    const postId = crypto.randomUUID();
    const platform = text(content.platform, 30) || "instagram";
    const title = text(content.title, 180) || template.name;
    const postType = template.format_type === "three_choice_reading" ? "reel" : "reel";
    const metadata = { formatId: template.format_key || template.slug, formatVersion: template.version, templateId: template.id, hookId: content.hookId || null, ctaId: content.ctaId || null, characterId: content.characterId || null, divinationSystem: content.divinationSystem || null, deckId: content.deckId || null, campaignId: content.campaignId || null, experimentId: content.experimentId || null };
    await env.DB.prepare("INSERT INTO sns_posts (id,tenant_id,platform,post_type,title,theme,category,character,cta,caption,script,status,ai_generated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(postId, tenantId, platform, postType, title, text(content.theme, 180), template.category, text(content.characterId, 80), text(content.cta, 240) || template.default_cta, text(content.caption, 4000), JSON.stringify(content.script || { templateId: template.id, templateVersion: template.version, content }), "draft", 0).run();
    await env.DB.prepare("INSERT INTO sns_post_format_metadata (post_id,tenant_id,format_id,format_version,visual_template_id,character_id,hook_id,cta_id,platform,category,divination_system,deck_id,campaign_id,experiment_id,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(postId, tenantId, String(metadata.formatId), template.version, text(content.visualTemplateId, 120) || null, text(content.characterId, 80) || null, text(content.hookId, 120) || null, text(content.ctaId, 120) || null, platform, template.category, text(content.divinationSystem, 80) || null, text(content.deckId, 120) || null, text(content.campaignId, 120) || null, text(content.experimentId, 120) || null, JSON.stringify(metadata)).run();
    return Response.json({ ok: true, postId, status: "draft", metadata });
  }
  const content = body?.content && typeof body.content === "object" ? body.content : {};
  const sceneSchema = JSON.parse(template.scene_schema || "{}");
  const plan = { templateId: id, templateVersion: template.version, formatType: template.format_type, rendererType: template.renderer_type, duration: template.duration_seconds, aspectRatio: template.aspect_ratio, scenes: sceneSchema.scenes || [], content, supportedPlatforms: JSON.parse(template.supported_platforms || "[]") };
  if (action === "render") return Response.json({ ok: true, status: "planned", renderPlan: plan, message: "Render Planを作成しました。既存Rendererへ渡せます。" });
  return Response.json({ ok: true, status: "preview", preview: plan });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tenantId = new URL(request.url).searchParams.get("tenantId") || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  await env.DB.prepare("UPDATE sns_post_templates SET status='archived', archived_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?").bind(tenantId, id).run();
  return Response.json({ ok: true, id, status: "archived" });
}
