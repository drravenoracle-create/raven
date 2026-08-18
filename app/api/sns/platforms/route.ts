import { env } from "cloudflare:workers";
import { platformCapabilities } from "@/app/lib/social-platforms";

const TENANT_ID = "raven-oracle";

export async function GET(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenantId") || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const settings = await env.DB.prepare("SELECT platform, enabled, mode FROM sns_platform_settings WHERE tenant_id = ? ORDER BY platform").bind(tenantId).all().catch(() => ({ results: [] }));
  const configured = new Map((settings.results || []).map((row: any) => [row.platform, row]));
  const flags = Object.fromEntries((settings.results || []).map((row: any) => [row.platform, Boolean(row.enabled)]));
  return Response.json({ tenantId, platforms: platformCapabilities(env as unknown as Record<string, unknown>, flags), settings: [...configured.values()] }, { headers: { "Cache-Control": "no-store" } });
}
