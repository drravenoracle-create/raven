import { buildEvidenceDecision, findEvidence } from "@/app/lib/evidence-layer";
import { env, requireEvidenceAdmin, tenantFrom, text } from "@/app/api/evidence/_shared";

export async function POST(request: Request) {
  try {
    await requireEvidenceAdmin();
    const body = (await request.json()) as Record<string, unknown>;
    const tenantId = tenantFrom(body.tenantId ?? body.tenant_id);
    const target = { tenantId, guildId: text(body.guildId ?? body.guild_id, 120) || null, market: text(body.market, 80) || null, country: text(body.country, 80) || null, locale: text(body.locale, 40) || null };
    const evidence = await findEvidence(env.DB, target);
    const decision = buildEvidenceDecision(evidence, target, text(body.riskClass ?? body.risk_class, 40), body.authorizationStatus === "APPROVED" ? "APPROVED" : "NOT_REQUIRED");
    return Response.json({ ok: true, ...decision });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unable to evaluate evidence." }, { status: 400 });
  }
}
