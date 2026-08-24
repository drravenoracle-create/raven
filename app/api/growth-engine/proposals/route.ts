import { env } from "cloudflare:workers";
import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";
import { EvidenceRepository, type EvidenceClaim, type EvidenceSource } from "@/app/lib/growth-evidence";
import { HypothesisRepository } from "@/app/lib/growth-hypothesis";
import { GrowthProposalRepository, GrowthProposalService, type ProposalReviewAction } from "@/app/lib/growth-proposal";
import { GrowthProposalExperimentService } from "@/app/lib/growth-proposal-experiment";

function clean(value: unknown, maxLength = 240) { return String(value ?? "").trim().slice(0, maxLength); }
function tenant(value: unknown) {
  const tenantId = clean(value, 80) || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) throw new Error("Invalid tenant_id.");
  return tenantId;
}
async function requireApiAdmin() {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) return { denied: Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 }), actor: "" };
  return { denied: null, actor: session.email };
}

export async function GET(request: Request) {
  const auth = await requireApiAdmin(); if (auth.denied) return auth.denied;
  const url = new URL(request.url); let tenantId: string;
  try { tenantId = tenant(url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id")); } catch { return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 }); }
  try {
    const proposals = await new GrowthProposalRepository(env.DB).listProposals(tenantId, {
      status: (clean(url.searchParams.get("status"), 40) || undefined) as never,
      riskClass: (clean(url.searchParams.get("riskClass"), 40) || undefined) as never,
      hypothesisId: clean(url.searchParams.get("hypothesisId"), 160) || undefined, limit: Number(url.searchParams.get("limit") || 50),
    });
    return Response.json({ ok: true, proposals }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Proposal read failed." }, { status: 400 }); }
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(); if (auth.denied) return auth.denied;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  let tenantId: string; try { tenantId = tenant(body.tenant_id ?? body.tenantId); } catch { return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 }); }
  try {
    const hypothesisId = clean(body.hypothesis_id ?? body.hypothesisId, 160); if (!hypothesisId) throw new Error("hypothesis_id is required.");
    const hypothesis = await new HypothesisRepository(env.DB).get(tenantId, hypothesisId); if (!hypothesis) throw new Error("Hypothesis not found.");
    const evidence = new EvidenceRepository(env.DB); const claims = (Array.isArray(body.claims) ? body.claims : []) as EvidenceClaim[];
    const sources: EvidenceSource[] = []; for (const sourceId of new Set(claims.map((claim) => claim.sourceId))) { const source = await evidence.getSource(tenantId, sourceId); if (source) sources.push(source); }
    const result = await new GrowthProposalService(new GrowthProposalRepository(env.DB)).createCandidate({
      proposalId: clean(body.proposal_id ?? body.proposalId, 160), hypothesis, sources, claims,
      context: { tenantId, market: hypothesis.market, country: hypothesis.country, locale: hypothesis.locale, asOf: clean(body.as_of ?? body.asOf, 80) || undefined },
      title: clean(body.title, 500), summary: clean(body.summary), rationale: clean(body.rationale), expectedOutcome: clean(body.expected_outcome ?? body.expectedOutcome), targetMetric: clean(body.target_metric ?? body.targetMetric),
      proposalType: clean(body.proposal_type ?? body.proposalType, 120), actor: auth.actor,
    });
    return Response.json({ ok: true, result }, { status: result.created ? 201 : 422 });
  } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Proposal creation failed." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const auth = await requireApiAdmin(); if (auth.denied) return auth.denied;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  let tenantId: string; try { tenantId = tenant(body.tenant_id ?? body.tenantId); } catch { return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 }); }
  const proposalId = clean(body.proposal_id ?? body.proposalId, 160); const action = clean(body.action, 40) as ProposalReviewAction | "createExperimentDraft";
  if (!proposalId || !["approve", "reject", "defer", "createExperimentDraft"].includes(action)) return Response.json({ ok: false, error: "proposal_id and a supported action are required." }, { status: 400 });
  try {
    if (action === "createExperimentDraft") {
      const result = await new GrowthProposalExperimentService(env.DB).createDraftFromApprovedProposal(tenantId, proposalId, auth.actor);
      return Response.json({ ok: result.created || result.duplicate, result });
    }
    const proposal = await new GrowthProposalRepository(env.DB).updateReviewStatus(tenantId, proposalId, action, auth.actor, clean(body.review_note ?? body.reviewNote, 2000));
    return Response.json({ ok: true, proposal });
  } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Proposal review failed." }, { status: 400 }); }
}
