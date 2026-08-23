import { env } from "cloudflare:workers";
import { RAVEN_TENANT_CONFIG } from "@/app/lib/tenant-config";

const allowedFormats = new Set(["three_choice_reading", "yes_no", "one_card", "ranking", "card_meaning", "guild_dialogue", "multi_divination", "community_prompt", "behind_scenes", "custom"]);
const TENANT_ID = RAVEN_TENANT_CONFIG.id;

function tenant(value: string | null | undefined) {
  if ((value || TENANT_ID) !== TENANT_ID) throw new Error("Invalid tenant_id");
  return TENANT_ID;
}

function text(value: unknown, max = 4000) { return String(value ?? "").trim().slice(0, max); }
function json(value: unknown, fallback: unknown) { return value === undefined ? JSON.stringify(fallback) : typeof value === "string" ? value : JSON.stringify(value); }

function parseFlags(value: unknown) {
  try { return JSON.parse(String(value || "{}")) as Record<string, unknown>; } catch { return {}; }
}

export async function GET(request: Request) {
  try {
    const tenantId = tenant(new URL(request.url).searchParams.get("tenantId"));
    const result = await env.DB.prepare("SELECT * FROM sns_post_templates WHERE tenant_id = ? AND status != 'archived' ORDER BY category, name").bind(tenantId).all();
    const settings = await env.DB.prepare("SELECT * FROM sns_template_settings WHERE tenant_id = ? LIMIT 1").bind(tenantId).first();
    const flags = parseFlags((settings as { feature_flags?: unknown } | null)?.feature_flags);
    const presetsEnabled = flags.sns_format_presets_v1_enabled !== false;
    const templates = (result.results || []).filter((item: any) => !item.is_system_preset || presetsEnabled);
    return Response.json({ templates, settings, flags: { sns_format_presets_v1_enabled: presetsEnabled } }, { headers: { "Cache-Control": "no-store" } });
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
    await env.DB.prepare(`INSERT INTO sns_post_templates (id,tenant_id,name,slug,format_type,format_key,category,description,version,status,duration_seconds,supported_durations,aspect_ratio,renderer_type,scene_schema,content_schema,default_media,default_cta,supported_platforms,supported_characters,tags,hook_schema,cta_schema,comment_prompt_schema,character_compatibility,required_assets,required_divination_systems,is_system_preset,enabled,ai_enabled,growth_enabled) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, tenantId, text(body?.name, 160) || slug, slug, formatType, text(body?.format_key ?? body?.formatKey, 120) || slug, text(body?.category, 60) || "custom", text(body?.description), 1, "active", Number(body?.duration_seconds ?? body?.durationSeconds ?? 20), json(body?.supported_durations ?? body?.supportedDurations, [20]), text(body?.aspect_ratio ?? body?.aspectRatio, 20) || "9:16", text(body?.renderer_type ?? body?.rendererType, 40) || "video", json(body?.scene_schema ?? body?.sceneSchema, {}), json(body?.content_schema ?? body?.contentSchema, {}), json(body?.default_media ?? body?.defaultMedia, {}), text(body?.default_cta ?? body?.defaultCta, 240), json(body?.supported_platforms ?? body?.supportedPlatforms, ["instagram"]), json(body?.supported_characters ?? body?.supportedCharacters, []), json(body?.tags, []), json(body?.hook_schema ?? body?.hookSchema, {}), json(body?.cta_schema ?? body?.ctaSchema, {}), json(body?.comment_prompt_schema ?? body?.commentPromptSchema, {}), json(body?.character_compatibility ?? body?.characterCompatibility, {}), json(body?.required_assets ?? body?.requiredAssets, []), json(body?.required_divination_systems ?? body?.requiredDivinationSystems, []), body?.is_system_preset ? 1 : 0, body?.enabled === false ? 0 : 1, body?.ai_enabled ? 1 : 0, body?.growth_enabled === false ? 0 : 1).run();
    await env.DB.prepare("INSERT INTO sns_post_template_versions (id,tenant_id,template_id,version,snapshot,created_by) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), tenantId, id, 1, JSON.stringify(snapshot), text(body?.created_by ?? body?.createdBy, 120) || "admin").run();
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Template create failed." }, { status: 400 }); }
}
