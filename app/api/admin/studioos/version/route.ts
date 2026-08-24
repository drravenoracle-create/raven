import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { getStudioOSSnapshot } from "@/app/lib/studioos-system";

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  const snapshot = getStudioOSSnapshot("raven-oracle", { environment: "production" });
  return Response.json({ ok: true, ...snapshot }, { headers: { "Cache-Control": "no-store" } });
}
