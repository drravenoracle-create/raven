import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { resolveAllFeatures } from "@/app/lib/feature-entitlements";
import { tenantConfigResolver } from "@/app/lib/tenant-config-resolver";

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  const tenant = tenantConfigResolver.requireTenantConfig("raven-oracle");
  return Response.json({ ok: true, tenantId: tenant.tenantId, plan: tenant.plan.planId || "PREMIUM", entitlements: resolveAllFeatures(tenant.tenantId) }, { headers: { "Cache-Control": "no-store" } });
}
