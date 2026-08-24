import { env } from "cloudflare:workers";
import { EvidenceRepository } from "@/app/lib/growth-evidence";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId")?.trim();
  if (!tenantId) return Response.json({ ok: false, error: "tenantId is required." }, { status: 400 });
  try {
    const repository = new EvidenceRepository(env.DB);
    const sourceId = url.searchParams.get("sourceId")?.trim();
    const claims = sourceId
      ? await repository.listClaimsForSource(tenantId, sourceId)
      : await repository.listClaimsForTenant(tenantId, {
          scope: url.searchParams.get("scope") || undefined,
          market: url.searchParams.get("market") || undefined,
          locale: url.searchParams.get("locale") || undefined,
          limit: Number(url.searchParams.get("limit") || 100),
        });
    return Response.json({ ok: true, claims }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Evidence claim lookup failed." }, { status: 404 });
  }
}
