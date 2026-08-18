import { env } from "cloudflare:workers";

const TENANT_ID = "raven-oracle";

export async function GET(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenantId") || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const result = await env.DB.prepare("SELECT id, platform, platform_account_id, display_name, status, scopes_json, token_expires_at, last_validated_at FROM sns_platform_accounts WHERE tenant_id = ? ORDER BY platform").bind(tenantId).all().catch(() => ({ results: [] }));
  return Response.json({ accounts: result.results || [] }, { headers: { "Cache-Control": "no-store" } });
}
