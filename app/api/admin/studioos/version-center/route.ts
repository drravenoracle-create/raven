import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { buildVersionCenterEntries } from "@/app/lib/studioos-registry";

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  return Response.json({ ok: true, entries: buildVersionCenterEntries() }, { headers: { "Cache-Control": "no-store" } });
}
