import { env, requireEvidenceAdmin, tenantFrom, text } from "@/app/api/evidence/_shared";
import { findEvidence } from "@/app/lib/evidence-layer";
import { evaluateProposal, GrowthHypothesisProposalRepository, type CreateHypothesisInput, type CreateProposalInput } from "@/app/lib/growth-hypothesis-proposal";
import { buildProposalDecision, generateHypothesisCandidate, generateProposalCandidate } from "@/app/lib/growth-intelligence-ai";
import { createExperimentDraftFromProposal, getExperimentDraftStatus } from "@/app/lib/growth-experiment-draft";

function scopeFrom(input: Record<string, unknown>) {
  return {
    tenantId: tenantFrom(input.tenantId ?? input.tenant_id),
    guildId: text(input.guildId ?? input.guild_id, 120) || null,
    market: text(input.market, 80) || null,
    country: text(input.country, 80) || null,
    locale: text(input.locale, 40) || null,
  };
}

async function evidenceFor(repo: GrowthHypothesisProposalRepository, tenantId: string, hypothesisId: string, target: ReturnType<typeof scopeFrom>) {
  const links = await repo.listHypothesisEvidence(tenantId, hypothesisId);
  const records = await findEvidence(env.DB, target);
  const sourceIds = new Set(links.map((link) => link.sourceId));
  return records.filter((record) => sourceIds.has(record.source.sourceId));
}

async function responseData(repo: GrowthHypothesisProposalRepository, target: ReturnType<typeof scopeFrom>) {
  const [hypotheses, proposals] = await Promise.all([repo.listHypotheses(target), repo.listProposals(target)]);
  const hypothesisDetails = await Promise.all(hypotheses.map(async (hypothesis) => ({ hypothesis, evidenceLinks: await repo.listHypothesisEvidence(target.tenantId, hypothesis.id), evidence: await evidenceFor(repo, target.tenantId, hypothesis.id, target) })));
  const proposalDetails = await Promise.all(proposals.map(async (proposal) => ({ ...proposal, draftEligibility: await getExperimentDraftStatus(env.DB, proposal.id, target.tenantId) })));
  return { hypotheses: hypothesisDetails, proposals: proposalDetails };
}

async function logGeneration(tenantId: string, subjectType: string, subjectId: string, generationType: string, model: string, validationResult: string, evidenceIds: string[]) {
  await env.DB.prepare("INSERT INTO growth_audit_log (id, tenant_id, actor, action, subject_type, subject_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), tenantId, "growth_intelligence_ai", "ai_candidate_generated", subjectType, subjectId, JSON.stringify({ generationType, model, evidenceIds }), JSON.stringify({ validationResult }))
    .run();
}

export async function GET(request: Request) {
  try {
    await requireEvidenceAdmin();
    const url = new URL(request.url);
    const target = scopeFrom(Object.fromEntries(url.searchParams.entries()));
    const repo = new GrowthHypothesisProposalRepository(env.DB);
    if (url.searchParams.get("hypothesisId")) {
      const hypothesis = await repo.getHypothesis(target.tenantId, text(url.searchParams.get("hypothesisId"), 160));
      if (!hypothesis) return Response.json({ ok: false, error: "Hypothesis not found." }, { status: 404 });
      return Response.json({ ok: true, hypothesis, evidenceLinks: await repo.listHypothesisEvidence(target.tenantId, hypothesis.id), evidence: await evidenceFor(repo, target.tenantId, hypothesis.id, target) }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ ok: true, ...await responseData(repo, target) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Growth Intelligenceの読み込みに失敗しました。" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    await requireEvidenceAdmin();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    const target = scopeFrom(body);
    const repo = new GrowthHypothesisProposalRepository(env.DB);
    const action = text(body.action, 40);
    if (action === "create_hypothesis") {
      const input: CreateHypothesisInput = {
        id: text(body.id, 160) || crypto.randomUUID(), ...target,
        characterId: text(body.characterId ?? body.character_id, 120) || null,
        statement: text(body.statement, 2000), targetSegment: text(body.targetSegment ?? body.target_segment, 240), targetMetric: text(body.targetMetric ?? body.target_metric, 160),
        expectedDirection: text(body.expectedDirection ?? body.expected_direction, 20).toUpperCase() as CreateHypothesisInput["expectedDirection"],
        riskClass: text(body.riskClass ?? body.risk_class, 40).toUpperCase() as CreateHypothesisInput["riskClass"], status: "DRAFT",
      };
      const hypothesis = await repo.createHypothesis(input);
      return Response.json({ ok: true, hypothesis }, { status: 201 });
    }
    if (action === "create_proposal") {
      const hypothesisId = text(body.hypothesisId ?? body.hypothesis_id, 160);
      const hypothesis = await repo.getHypothesis(target.tenantId, hypothesisId);
      if (!hypothesis) return Response.json({ ok: false, error: "Hypothesis is required and must belong to this tenant." }, { status: 400 });
      const input: CreateProposalInput = {
        id: text(body.id, 160) || crypto.randomUUID(), hypothesisId, ...target,
        characterId: text(body.characterId ?? body.character_id, 120) || hypothesis.characterId || null,
        proposedAction: text(body.proposedAction ?? body.proposed_action, 2000), expectedImpact: text(body.expectedImpact ?? body.expected_impact, 2000), targetMetric: text(body.targetMetric ?? body.target_metric, 160),
        expectedDirection: text(body.expectedDirection ?? body.expected_direction, 20).toUpperCase() as CreateProposalInput["expectedDirection"], reversible: body.reversible === true || body.reversible === 1 || body.reversible === "1",
        implementationEffort: text(body.implementationEffort ?? body.implementation_effort, 20).toUpperCase() as CreateProposalInput["implementationEffort"], riskClass: text(body.riskClass ?? body.risk_class, 40).toUpperCase() as CreateProposalInput["riskClass"], authorizationStatus: "NOT_REQUIRED",
      };
      const evidence = await evidenceFor(repo, target.tenantId, hypothesisId, target);
      const proposal = await repo.createProposal(input, evidence);
      return Response.json({ ok: true, proposal }, { status: 201 });
    }
    if (action === "generate_hypothesis") {
      const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
      if (!apiKey) return Response.json({ ok: false, errorCode: "AI_UNAVAILABLE", error: "OPENAI_API_KEY is not configured." }, { status: 503 });
      const evidence = await findEvidence(env.DB, target);
      const result = await generateHypothesisCandidate(target, evidence, apiKey, process.env.OPENAI_MODEL || undefined);
      if (!result.ok) return Response.json({ ok: false, errorCode: result.errorCode, error: result.error, evidenceDecision: result.evidenceDecision }, { status: result.errorCode === "AI_UNAVAILABLE" ? 503 : 422 });
      const hypothesisInput: CreateHypothesisInput = { id: crypto.randomUUID(), ...target, characterId: text(body.characterId ?? body.character_id, 120) || null, statement: result.candidate.statement, targetSegment: result.candidate.targetSegment, targetMetric: result.candidate.targetMetric, expectedDirection: result.candidate.expectedDirection, evidenceSufficiency: result.evidenceDecision.sufficiency.level, riskClass: "LOW", status: "DRAFT" };
      const hypothesis = await repo.createHypothesis(hypothesisInput);
      const evidenceIds: string[] = [];
      for (const record of evidence) { if (record.claims.length) for (const claim of record.claims) { await repo.attachEvidence({ id: crypto.randomUUID(), hypothesisId: hypothesis!.id, tenantId: target.tenantId, sourceId: record.source.sourceId, claimId: claim.claimId }); evidenceIds.push(claim.claimId); } else { await repo.attachEvidence({ id: crypto.randomUUID(), hypothesisId: hypothesis!.id, tenantId: target.tenantId, sourceId: record.source.sourceId }); evidenceIds.push(record.source.sourceId); } }
      await logGeneration(target.tenantId, "growth_hypothesis", hypothesis!.id, "hypothesis", result.model, "VALIDATED_DRAFT", evidenceIds);
      return Response.json({ ok: true, candidate: result.candidate, evidenceDecision: result.evidenceDecision, hypothesis: await repo.getHypothesis(target.tenantId, hypothesis!.id) }, { status: 201 });
    }
    if (action === "generate_proposal") {
      const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
      if (!apiKey) return Response.json({ ok: false, errorCode: "AI_UNAVAILABLE", error: "OPENAI_API_KEY is not configured." }, { status: 503 });
      const hypothesisId = text(body.hypothesisId ?? body.hypothesis_id, 160);
      const hypothesis = await repo.getHypothesis(target.tenantId, hypothesisId);
      if (!hypothesis) return Response.json({ ok: false, error: "Hypothesis is required and must belong to this tenant." }, { status: 400 });
      const evidence = await evidenceFor(repo, target.tenantId, hypothesisId, target);
      const result = await generateProposalCandidate(target, evidence, hypothesis, apiKey, process.env.OPENAI_MODEL || undefined);
      if (!result.ok) return Response.json({ ok: false, errorCode: result.errorCode, error: result.error, evidenceDecision: result.evidenceDecision }, { status: result.errorCode === "AI_UNAVAILABLE" ? 503 : 422 });
      const decision = buildProposalDecision(target, evidence, result.candidate, hypothesisId);
      const proposal = await repo.createProposal({ id: crypto.randomUUID(), hypothesisId, ...target, characterId: hypothesis.characterId || null, ...result.candidate, authorizationStatus: "NOT_REQUIRED", status: "DRAFT" }, evidence);
      await logGeneration(target.tenantId, "growth_proposal", proposal!.id, "proposal", result.model, `VALIDATED_DRAFT:${decision.decision}`, evidence.map((item) => item.source.sourceId));
      return Response.json({ ok: true, candidate: result.candidate, evidenceDecision: result.evidenceDecision, decision, proposal }, { status: 201 });
    }
    if (action === "approve_proposal" || action === "reject_proposal") {
      const proposalId = text(body.proposalId ?? body.proposal_id, 160);
      const proposal = await repo.getProposal(target.tenantId, proposalId);
      if (!proposal) return Response.json({ ok: false, error: "Proposal not found." }, { status: 404 });
      const hypothesis = await repo.getHypothesis(target.tenantId, proposal.hypothesisId);
      if (!hypothesis) return Response.json({ ok: false, error: "Related hypothesis not found." }, { status: 409 });
      const evidence = await evidenceFor(repo, target.tenantId, proposal.hypothesisId, { ...target, guildId: proposal.guildId, market: proposal.market, country: proposal.country, locale: proposal.locale });
      if (action === "reject_proposal") {
        const rejected = await repo.updateProposal(target.tenantId, proposalId, { status: "REJECTED", approvalStatus: "REJECTED" });
        return Response.json({ ok: true, proposal: rejected });
      }
      if (!proposal.approvalRequired) return Response.json({ ok: false, error: "このProposalは承認操作の対象ではありません。" }, { status: 400 });
      const decision = evaluateProposal({ ...proposal, authorizationStatus: "APPROVED" }, evidence);
      if (decision.decision === "INSUFFICIENT_EVIDENCE" || decision.decision === "HOLD") return Response.json({ ok: false, error: "Evidence不足のため承認できません。", decision }, { status: 400 });
      const approved = await repo.updateProposal(target.tenantId, proposalId, { status: "APPROVED", approvalStatus: "APPROVED", decision: decision.decision, evidenceSufficiency: decision.sufficiency.level, missingEvidence: decision.missingEvidence });
      return Response.json({ ok: true, proposal: approved });
    }
    if (action === "create_experiment_draft") {
      const proposalId = text(body.proposalId ?? body.proposal_id, 160);
      if (!proposalId) return Response.json({ ok: false, error: "proposalId is required." }, { status: 400 });
      const result = await createExperimentDraftFromProposal(env.DB, proposalId, {
        tenantId: target.tenantId,
        ...(Object.prototype.hasOwnProperty.call(body, "guildId") || Object.prototype.hasOwnProperty.call(body, "guild_id") ? { guildId: target.guildId } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "market") ? { market: target.market } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "country") ? { country: target.country } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "locale") ? { locale: target.locale } : {}),
      }, "admin");
      return Response.json({ ok: true, ...result }, { status: result.created ? 201 : 200 });
    }
    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Growth Intelligenceの操作に失敗しました。" }, { status: 400 });
  }
}
