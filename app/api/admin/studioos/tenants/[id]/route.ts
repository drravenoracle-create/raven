import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { buildVersionCenterEntries, UnknownRegistryRecordError } from "@/app/lib/studioos-registry";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  const { id } = await context.params;
  const entry = buildVersionCenterEntries().find((item) => item.tenant.tenantId === id);
  if (!entry) return Response.json({ ok: false, error: new UnknownRegistryRecordError("tenant", id).message }, { status: 404 });
  return Response.json({ ok: true, entry }, { headers: { "Cache-Control": "no-store" } });
}
