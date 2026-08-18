import { env } from "cloudflare:workers";

const TENANT_ID = "raven-oracle";
const allowedFormats = new Set(["three_choice_reading", "yes_no", "one_card", "ranking", "card_meaning", "guild_dialogue", "custom"]);

function tenant(value: string | null | undefined) {
  if ((value || TENANT_ID) !== TENANT_ID) throw new Error("Invalid tenant_id");
  return TENANT_ID;
}

function text(value: unknown, max = 4000) { return String(value ?? "").trim().slice(0, max); }
function json(value: unknown, fallback: unknown) { return value === undefined ? JSON.stringify(fallback) : typeof value === "string" ? value : JSON.stringify(value); }

export async function GET(request: Request) {
  try {
    const tenantId = tenant(new URL(request.url).searchParams.get("tenantId"));
    const result = await env.DB.prepare("SELECT * FROM sns_post_templates WHERE tenant_id = ? AND status != 'archived' ORDER BY category, name").bind(tenantId).all();
    const settings = await env.DB.prepare("SELECT * FROM sns_template_settings WHERE tenant_id = ? LIMIT 1").bind(tenantId).first();
    return Response.json({ templates: result.results || [], settings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Template list failed." }, { status: 400 }); }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const tenantId = tenant(String(body?.tenant_id ?? body?.tenantId ?? TENANT_ID));
    const formatType = text(body?.format_type ?? body?.formatType, 60) || "custom";
    if (!allowedFormats.has(formatType)) throw new Error("Invalid format_type");
    const id = crypto.randomUUID();
    const slug = text(body?.slug, 100) || `template-${id.slice(0, 8)}`;
    const snapshot = { ...body, id, tenant_id: tenantId, version: 1, format_type: formatType };
    await env.DB.prepare(`INSERT INTO sns_post_templates (id,tenant_id,name,slug,format_type,category,description,version,status,duration_seconds,aspect_ratio,renderer_type,scene_schema,content_schema,default_media,default_cta,supported_platforms,supported_characters,tags,ai_enabled,growth_enabled) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, tenantId, text(body?.name, 160) || slug, slug, formatType, text(body?.category, 60) || "custom", text(body?.description), 1, "active", Number(body?.duration_seconds ?? body?.durationSeconds ?? 20), text(body?.aspect_ratio ?? body?.aspectRatio, 20) || "9:16", text(body?.renderer_type ?? body?.rendererType, 40) || "video", json(body?.scene_schema ?? body?.sceneSchema, {}), json(body?.content_schema ?? body?.contentSchema, {}), json(body?.default_media ?? body?.defaultMedia, {}), text(body?.default_cta ?? body?.defaultCta, 240), json(body?.supported_platforms ?? body?.supportedPlatforms, ["instagram"]), json(body?.supported_characters ?? body?.supportedCharacters, []), json(body?.tags, []), body?.ai_enabled ? 1 : 0, body?.growth_enabled === false ? 0 : 1).run();
    await env.DB.prepare("INSERT INTO sns_post_template_versions (id,tenant_id,template_id,version,snapshot,created_by) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), tenantId, id, 1, JSON.stringify(snapshot), text(body?.created_by ?? body?.createdBy, 120) || "admin").run();
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Template create failed." }, { status: 400 }); }
}
