import { env } from "cloudflare:workers";

const TENANT_ID = "raven-oracle";

function boolValue(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function updateAutomationLevels(current: string | null | undefined, articleGeneration: boolean, autoPublish: boolean) {
  const fallback = {
    analytics_collection: true,
    recommendation_generation: true,
    article_generation: false,
    refresh_generation: false,
    internal_link_application: false,
    schedule_optimization: false,
    auto_publish: false,
  };
  const parsed = current ? JSON.parse(current) : fallback;
  return JSON.stringify({
    ...fallback,
    ...parsed,
    article_generation: articleGeneration,
    auto_publish: autoPublish,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });

  const tenantId = String(body.tenant_id ?? body.tenantId ?? TENANT_ID);
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });

  const settings = await env.DB.prepare("SELECT automation_levels_json FROM blog_engine_settings WHERE tenant_id = ? LIMIT 1")
    .bind(TENANT_ID)
    .first<{ automation_levels_json: string }>();
  if (!settings) return Response.json({ error: "Blog Engine settings not found." }, { status: 404 });

  const articleGeneration = boolValue(body.article_generation ?? body.articleGeneration);
  const autoPublish = boolValue(body.auto_publish ?? body.autoPublish);
  const enabled = boolValue(body.enabled);
  const killSwitch = boolValue(body.kill_switch ?? body.killSwitch);
  const automationLevels = updateAutomationLevels(settings.automation_levels_json, articleGeneration, autoPublish);

  await env.DB.prepare(
    "UPDATE blog_engine_settings SET enabled = ?, kill_switch = ?, auto_post_enabled = ?, posting_mode = ?, automation_levels_json = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?",
  )
    .bind(enabled ? 1 : 0, killSwitch ? 1 : 0, autoPublish ? 1 : 0, autoPublish ? "auto" : "approval", automationLevels, TENANT_ID)
    .run();

  return Response.json({ ok: true, enabled, kill_switch: killSwitch, article_generation: articleGeneration, auto_publish: autoPublish });
}
