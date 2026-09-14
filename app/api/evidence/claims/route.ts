import { createClaim } from "@/app/lib/evidence-layer";
import { env, jsonObject, requireEvidenceAdmin, tenantFrom, text } from "@/app/api/evidence/_shared";

export async function POST(request: Request) {
  try {
    await requireEvidenceAdmin();
    const body = (await request.json()) as Record<string, unknown>;
    const tenantId = tenantFrom(body.tenantId ?? body.tenant_id);
    const relevance = body.relevanceScore ?? body.relevance_score;
    const confidence = body.confidence;
    const claim = await createClaim(env.DB, {
      claimId: text(body.claimId ?? body.claim_id, 120) || crypto.randomUUID(), sourceId: text(body.sourceId ?? body.source_id, 120), tenantId,
      guildId: text(body.guildId ?? body.guild_id, 120) || null, market: text(body.market, 80) || null, country: text(body.country, 80) || null, locale: text(body.locale, 40) || null,
      claimType: text(body.claimType ?? body.claim_type, 80) || "observation", statement: text(body.statement, 3000), relevanceScore: relevance === undefined ? null : Number(relevance), confidence: confidence === undefined ? null : Number(confidence), metadata: jsonObject(body.metadata),
    });
    return Response.json({ ok: true, claim }, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create evidence claim." }, { status: 400 });
  }
}
