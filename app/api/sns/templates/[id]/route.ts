import { env } from "cloudflare:workers";

const TENANT_ID = "raven-oracle";
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

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tenantId = new URL(request.url).searchParams.get("tenantId") || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  await env.DB.prepare("UPDATE sns_post_templates SET status='archived', archived_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?").bind(tenantId, id).run();
  return Response.json({ ok: true, id, status: "archived" });
}
