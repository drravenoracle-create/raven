import { listClaimsBySource } from "@/app/lib/evidence-layer";
import { env, requireEvidenceAdmin, tenantFrom, text } from "@/app/api/evidence/_shared";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireEvidenceAdmin();
    const url = new URL(request.url);
    const tenantId = tenantFrom(url.searchParams.get("tenantId"));
    const claims = await listClaimsBySource(env.DB, tenantId, text((await context.params).id, 120));
    return Response.json({ ok: true, claims });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unable to list evidence claims." }, { status: 400 });
  }
}
