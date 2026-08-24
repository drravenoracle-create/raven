import { getSource } from "@/app/lib/evidence-layer";
import { env, requireEvidenceAdmin, tenantFrom, text } from "@/app/api/evidence/_shared";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireEvidenceAdmin();
    const url = new URL(request.url);
    const tenantId = tenantFrom(url.searchParams.get("tenantId"));
    const source = await getSource(env.DB, tenantId, text((await context.params).id, 120));
    if (!source) return Response.json({ ok: false, error: "Evidence source not found." }, { status: 404 });
    return Response.json({ ok: true, source });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unable to get evidence source." }, { status: 400 });
  }
}
