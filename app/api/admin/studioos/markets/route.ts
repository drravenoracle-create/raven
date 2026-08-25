import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { marketRegistry } from "@/app/lib/studioos-market";

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  return Response.json({ ok: true, markets: marketRegistry.listMarkets() }, { headers: { "Cache-Control": "no-store" } });
}
