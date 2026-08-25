import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { getWorkerRegistryRecord, UnknownRegistryRecordError } from "@/app/lib/studioos-registry";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  const { id } = await context.params;
  try { return Response.json({ ok: true, worker: getWorkerRegistryRecord(id) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { const message = error instanceof UnknownRegistryRecordError ? error.message : "Worker not found."; return Response.json({ ok: false, error: message }, { status: 404 }); }
}
