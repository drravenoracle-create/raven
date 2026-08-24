import { buildEvidenceDecision, type EvidenceDecisionContext, type EvidenceRecord, type EvidenceScope } from "./evidence-layer.ts";
import { evaluateProposal, type CreateProposalInput, type ExpectedDirection, type ImplementationEffort } from "./growth-hypothesis-proposal.ts";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";
const DIRECTIONS = new Set(["INCREASE", "DECREASE", "MAINTAIN"]);
const EFFORTS = new Set(["LOW", "MEDIUM", "HIGH"]);

export type HypothesisCandidate = { statement: string; targetSegment: string; targetMetric: string; expectedDirection: ExpectedDirection; reasoning: string };
export type ProposalCandidate = { proposedAction: string; expectedImpact: string; targetMetric: string; expectedDirection: ExpectedDirection; reversible: boolean; implementationEffort: ImplementationEffort; reasoning: string };
export type AiCandidateResult<T> = { ok: true; candidate: T; model: string; evidenceDecision: EvidenceDecisionContext } | { ok: false; errorCode: "INSUFFICIENT_EVIDENCE" | "AI_UNAVAILABLE" | "AI_INVALID_RESPONSE" | "VALIDATION_ERROR"; error: string; evidenceDecision: EvidenceDecisionContext };

type OpenAIResponse = { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { message?: string } };
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function field(value: unknown, max: number, name: string) { if (typeof value !== "string" || value.trim().length > max) throw new Error(`${name} exceeds the maximum length or is not a string.`); return value.trim(); }
function extractText(data: OpenAIResponse) { return data.output_text?.trim() || data.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n").trim() || ""; }
function parseObject(raw: string) { try { const value = JSON.parse(raw); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; } catch { return null; } }
function validDirection(value: unknown): value is ExpectedDirection { return typeof value === "string" && DIRECTIONS.has(value); }
function validEffort(value: unknown): value is ImplementationEffort { return typeof value === "string" && EFFORTS.has(value); }
function validTargetMetric(value: unknown) { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_. -]{0,119}$/.test(value.trim()); }

export function validateHypothesisCandidate(value: unknown): HypothesisCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI response must be a JSON object.");
  const item = value as Record<string, unknown>;
  const candidate = { statement: field(item.statement, 2000, "statement"), targetSegment: field(item.targetSegment, 240, "targetSegment"), targetMetric: field(item.targetMetric, 120, "targetMetric"), expectedDirection: item.expectedDirection, reasoning: field(item.reasoning, 2000, "reasoning") };
  if (!candidate.statement || !candidate.targetSegment || !candidate.reasoning) throw new Error("Hypothesis candidate has missing required fields.");
  if (!validTargetMetric(candidate.targetMetric)) throw new Error("Hypothesis targetMetric is invalid.");
  if (!validDirection(candidate.expectedDirection)) throw new Error("Hypothesis expectedDirection is invalid.");
  return candidate as HypothesisCandidate;
}

export function validateProposalCandidate(value: unknown): ProposalCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI response must be a JSON object.");
  const item = value as Record<string, unknown>;
  const candidate = { proposedAction: field(item.proposedAction, 2000, "proposedAction"), expectedImpact: field(item.expectedImpact, 2000, "expectedImpact"), targetMetric: field(item.targetMetric, 120, "targetMetric"), expectedDirection: item.expectedDirection, reversible: item.reversible, implementationEffort: item.implementationEffort, reasoning: field(item.reasoning, 2000, "reasoning") };
  if (!candidate.proposedAction || !candidate.expectedImpact || !candidate.reasoning) throw new Error("Proposal candidate has missing required fields.");
  if (!validTargetMetric(candidate.targetMetric)) throw new Error("Proposal targetMetric is invalid.");
  if (!validDirection(candidate.expectedDirection)) throw new Error("Proposal expectedDirection is invalid.");
  if (typeof candidate.reversible !== "boolean") throw new Error("Proposal reversible must be boolean.");
  if (!validEffort(candidate.implementationEffort)) throw new Error("Proposal implementationEffort is invalid.");
  return candidate as ProposalCandidate;
}

function evidenceSummary(records: EvidenceRecord[]) {
  return records.map((record) => ({ sourceId: record.source.sourceId, sourceType: record.source.sourceType, title: record.source.title.slice(0, 240), claims: record.claims.slice(0, 5).map((claim) => ({ claimId: claim.claimId, statement: claim.statement.slice(0, 500), relevanceScore: claim.relevanceScore, confidence: claim.confidence })) }));
}
function jsonSchema(kind: "hypothesis" | "proposal") {
  if (kind === "hypothesis") return { type: "object", additionalProperties: false, required: ["statement", "targetSegment", "targetMetric", "expectedDirection", "reasoning"], properties: { statement: { type: "string", maxLength: 2000 }, targetSegment: { type: "string", maxLength: 240 }, targetMetric: { type: "string", maxLength: 120 }, expectedDirection: { type: "string", enum: ["INCREASE", "DECREASE", "MAINTAIN"] }, reasoning: { type: "string", maxLength: 2000 } } };
  return { type: "object", additionalProperties: false, required: ["proposedAction", "expectedImpact", "targetMetric", "expectedDirection", "reversible", "implementationEffort", "reasoning"], properties: { proposedAction: { type: "string", maxLength: 2000 }, expectedImpact: { type: "string", maxLength: 2000 }, targetMetric: { type: "string", maxLength: 120 }, expectedDirection: { type: "string", enum: ["INCREASE", "DECREASE", "MAINTAIN"] }, reversible: { type: "boolean" }, implementationEffort: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] }, reasoning: { type: "string", maxLength: 2000 } } };
}
function decisionFor(records: EvidenceRecord[], target: EvidenceScope) { return buildEvidenceDecision(records, target, "LOW", "NOT_REQUIRED"); }
function insufficient(decision: EvidenceDecisionContext) { return decision.decision === "INSUFFICIENT_EVIDENCE" || decision.decision === "HOLD"; }

async function requestCandidate<T>(kind: "hypothesis" | "proposal", target: EvidenceScope, records: EvidenceRecord[], prompt: string, validate: (value: unknown) => T, apiKey: string, model = DEFAULT_MODEL, fetchImpl: FetchLike = fetch): Promise<AiCandidateResult<T>> {
  const evidenceDecision = decisionFor(records, target);
  if (insufficient(evidenceDecision)) return { ok: false, errorCode: "INSUFFICIENT_EVIDENCE", error: evidenceDecision.decision === "HOLD" ? "Evidence quality is insufficient for AI generation." : "Applicable Evidence is insufficient for AI generation.", evidenceDecision };
  try {
    const response = await fetchImpl(OPENAI_ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: prompt, max_output_tokens: 700, text: { format: { type: "json_schema", name: `growth_${kind}_candidate`, strict: true, schema: jsonSchema(kind) } } }) });
    const data = await response.json() as OpenAIResponse;
    if (!response.ok) return { ok: false, errorCode: "AI_UNAVAILABLE", error: data.error?.message || "AI provider request failed.", evidenceDecision };
    const parsed = parseObject(extractText(data));
    if (!parsed) return { ok: false, errorCode: "AI_INVALID_RESPONSE", error: "AI response was not valid JSON.", evidenceDecision };
    try { return { ok: true, candidate: validate(parsed), model, evidenceDecision }; } catch (error) { return { ok: false, errorCode: "VALIDATION_ERROR", error: error instanceof Error ? error.message : "AI candidate validation failed.", evidenceDecision }; }
  } catch { return { ok: false, errorCode: "AI_UNAVAILABLE", error: "AI provider is unavailable.", evidenceDecision }; }
}

export function generateHypothesisCandidate(target: EvidenceScope, records: EvidenceRecord[], apiKey: string, model = DEFAULT_MODEL, fetchImpl: FetchLike = fetch) {
  const prompt = ["Generate one structured growth hypothesis candidate from the applicable Evidence below.", "Return JSON only. Do not decide sufficiency, applicability, risk, approval, or decision.", `Target scope: ${JSON.stringify(target)}`, `Evidence: ${JSON.stringify(evidenceSummary(records))}`].join("\n");
  return requestCandidate("hypothesis", target, records, prompt, validateHypothesisCandidate, apiKey, model, fetchImpl);
}

export function generateProposalCandidate(target: EvidenceScope, records: EvidenceRecord[], hypothesis: { statement: string; targetMetric: string; expectedDirection: string }, apiKey: string, model = DEFAULT_MODEL, fetchImpl: FetchLike = fetch) {
  const prompt = ["Generate one structured proposal candidate for the existing hypothesis below.", "Return JSON only. Do not decide evidence sufficiency, risk, approval, or final decision.", `Target scope: ${JSON.stringify(target)}`, `Hypothesis: ${JSON.stringify(hypothesis)}`, `Evidence: ${JSON.stringify(evidenceSummary(records))}`].join("\n");
  return requestCandidate("proposal", target, records, prompt, validateProposalCandidate, apiKey, model, fetchImpl);
}

export function buildProposalDecision(target: EvidenceScope, records: EvidenceRecord[], candidate: ProposalCandidate, hypothesisId: string) {
  const input: CreateProposalInput = { id: "candidate", hypothesisId, ...target, proposedAction: candidate.proposedAction, expectedImpact: candidate.expectedImpact, targetMetric: candidate.targetMetric, expectedDirection: candidate.expectedDirection, reversible: candidate.reversible, implementationEffort: candidate.implementationEffort, authorizationStatus: "NOT_REQUIRED" };
  return evaluateProposal(input, records);
}
