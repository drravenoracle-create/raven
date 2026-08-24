import { env } from "cloudflare:workers";
import { EvidenceRepository } from "@/app/lib/growth-evidence";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId")?.trim();
  if (!tenantId) return Response.json({ ok: false, error: "tenantId is required." }, { status: 400 });
  try {
    const sources = await new EvidenceRepository(env.DB).listSources(tenantId, {
      sourceType: url.searchParams.get("sourceType") || undefined,
      status: url.searchParams.get("status") || undefined,
      market: url.searchParams.get("market") || undefined,
      locale: url.searchParams.get("locale") || undefined,
      limit: Number(url.searchParams.get("limit") || 50),
    });
    return Response.json({ ok: true, sources }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Evidence source lookup failed." }, { status: 404 });
  }
}
