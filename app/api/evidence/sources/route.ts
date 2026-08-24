import { createSource, listSources } from "@/app/lib/evidence-layer";
import { env, jsonObject, requireEvidenceAdmin, tenantFrom, text } from "@/app/api/evidence/_shared";

export async function GET(request: Request) {
  try {
    await requireEvidenceAdmin();
    const url = new URL(request.url);
    const tenantId = tenantFrom(url.searchParams.get("tenantId"));
    const sources = await listSources(env.DB, { tenantId, guildId: url.searchParams.get("guildId"), market: url.searchParams.get("market"), country: url.searchParams.get("country"), locale: url.searchParams.get("locale") });
    return Response.json({ ok: true, sources });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unable to list evidence sources." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    await requireEvidenceAdmin();
    const body = (await request.json()) as Record<string, unknown>;
    const tenantId = tenantFrom(body.tenantId ?? body.tenant_id);
    const source = await createSource(env.DB, {
      sourceId: text(body.sourceId ?? body.source_id, 120) || crypto.randomUUID(), tenantId,
      guildId: text(body.guildId ?? body.guild_id, 120) || null, market: text(body.market, 80) || null, country: text(body.country, 80) || null, locale: text(body.locale, 40) || null,
      sourceType: text(body.sourceType ?? body.source_type, 80) || "manual_input", title: text(body.title, 500), uri: text(body.uri, 1000) || null, provider: text(body.provider, 200) || null,
      observedAt: text(body.observedAt ?? body.observed_at, 80) || null, publishedAt: text(body.publishedAt ?? body.published_at, 80) || null, retrievedAt: text(body.retrievedAt ?? body.retrieved_at, 80) || null, validUntil: text(body.validUntil ?? body.valid_until, 80) || null, metadata: jsonObject(body.metadata),
    });
    return Response.json({ ok: true, source }, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create evidence source." }, { status: 400 });
  }
}
