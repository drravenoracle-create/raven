import { env } from "cloudflare:workers";
import { resolvePilotSnsConfig } from "@/app/lib/studioos-pilot";
import { resolveRuntimeTenantId } from "@/app/lib/studioos-runtime-adapter";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let tenantId: string;
  try {
    tenantId = resolveRuntimeTenantId({ host: url.hostname, tenantHint: url.searchParams.get("tenantId") || undefined });
    resolvePilotSnsConfig(tenantId);
  } catch {
    return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  }
  const result = await env.DB.prepare("SELECT id, platform, platform_account_id, display_name, status, scopes_json, token_expires_at, last_validated_at FROM sns_platform_accounts WHERE tenant_id = ? ORDER BY platform").bind(tenantId).all().catch(() => ({ results: [] }));
  return Response.json({ accounts: result.results || [] }, { headers: { "Cache-Control": "no-store" } });
}
