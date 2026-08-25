import { evaluateEvidence, getSource, listClaimsBySource, type EvidenceClaim, type EvidenceSource } from "./evidence-layer.ts";
import { GROWTH_ENGINE_TENANT_ID } from "./growth-engine.ts";
import { calculateConfidence, calculateDecay, classifyMaturity } from "./growth-learning-policy.ts";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }>; first<T = unknown>(): Promise<T | null> } } };
type Feedback = Record<string, unknown> & { feedback_id: string; tenant_id: string; experiment_id: string; evaluation_id: string; evidence_source_id: string; result: string; payload_json?: string | null; created_at?: string };
type Scope = { tenantId: string; guildId: string; market: string; country: string; locale: string; characterId: string; platform: string; targetSegment: string; metric: string; topic: string; topicCategory: string; hookStyle: string; cta: string; template: string };

const UNKNOWN = "__unknown__";
const clean = (value: unknown, max = 160) => String(value ?? "").trim().slice(0, max) || UNKNOWN;
const parse = (value: unknown): Record<string, unknown> => { try { const result = typeof value === "string" ? JSON.parse(value) : value; return result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : {}; } catch { return {}; } };

export function resultClass(result: unknown) {
  const value = String(result ?? "").toUpperCase();
  return value === "WIN" ? "positive" : value === "LOSS" ? "negative" : value === "NEUTRAL" ? "neutral" : "insufficient_learning";
}

export function patternScope(payload: Record<string, unknown>, tenantId: string): Scope {
  return {
    tenantId: clean(tenantId), guildId: clean(payload.guildId ?? payload.guild_id), market: clean(payload.market), country: clean(payload.country), locale: clean(payload.locale), characterId: clean(payload.characterId ?? payload.character_id), platform: clean(payload.platform), targetSegment: clean(payload.targetSegment ?? payload.target_segment), metric: clean(payload.primaryMetric ?? payload.primary_metric ?? payload.metric), topic: clean(payload.topic), topicCategory: clean(payload.topicCategory ?? payload.topic_category), hookStyle: clean(payload.hookStyle ?? payload.hook_style), cta: clean(payload.cta), template: clean(payload.template ?? payload.templateId ?? payload.template_id),
  };
}

export function patternKey(scope: Scope) {
  return Object.keys(scope).sort().map((key) => `${key}=${encodeURIComponent(String(scope[key as keyof Scope]))}`).join("&");
}

function numberOrNull(value: unknown) { const n = Number(value); return value === null || value === undefined || value === "" || !Number.isFinite(n) ? null : n; }
function metricAvailability(payload: Record<string, unknown>) { const value = String(payload.availability ?? payload.metricAvailability ?? "").toUpperCase(); return value === "UNAVAILABLE" || value === "ERROR" || value === "NOT_SUPPORTED" ? "UNAVAILABLE" : value === "MIXED" ? "MIXED" : "AVAILABLE"; }
function revenueKind(payload: Record<string, unknown>) { const value = String(payload.revenueKind ?? payload.revenue_kind ?? "").toLowerCase(); const revenue = payload.revenue; if (value === "measured") return "MEASURED"; if (value === "estimated") return "ESTIMATED"; if (revenue === 0 || revenue === "0") return "ACTUAL_ZERO"; return "UNAVAILABLE"; }

async function evidenceFor(db: D1, feedback: Feedback, scope: Scope) {
  const source = await getSource(db, feedback.tenant_id, feedback.evidence_source_id) as EvidenceSource | null;
  const claims = source ? await listClaimsBySource(db, feedback.tenant_id, feedback.evidence_source_id) as EvidenceClaim[] : [];
  const evaluation = source ? evaluateEvidence([{ source, claims }], { tenantId: feedback.tenant_id, guildId: scope.guildId === UNKNOWN ? null : scope.guildId, market: scope.market === UNKNOWN ? null : scope.market, country: scope.country === UNKNOWN ? null : scope.country, locale: scope.locale === UNKNOWN ? null : scope.locale }, new Date()) : null;
  return { source, claims, evaluation };
}

export async function getLearningPatterns(db: D1, tenantId = GROWTH_ENGINE_TENANT_ID, filters: Record<string, string | null> = {}) {
  const rows = await db.prepare("SELECT * FROM growth_experiment_feedback WHERE tenant_id = ? ORDER BY datetime(created_at) DESC").bind(tenantId).all<Feedback>();
  const grouped = new Map<string, { scope: Scope; feedback: Feedback[]; evidenceSourceIds: Set<string>; claimIds: Set<string>; evidenceRecords: Array<{ source: EvidenceSource; claims: EvidenceClaim[] }>; evidence: Array<{ sourceId: string; claimIds: string[]; sufficiency: string; missing: string[] }>; }>();
  for (const feedback of rows.results || []) {
    const payload = parse(feedback.payload_json);
    const scope = patternScope(payload, tenantId);
    const key = patternKey(scope);
    const group = grouped.get(key) || { scope, feedback: [], evidenceSourceIds: new Set<string>(), claimIds: new Set<string>(), evidenceRecords: [], evidence: [] };
    group.feedback.push(feedback);
    if (feedback.evidence_source_id) {
      const evidence = await evidenceFor(db, feedback, scope);
      group.evidenceSourceIds.add(feedback.evidence_source_id);
      evidence.claims.forEach((claim) => group.claimIds.add(claim.claimId));
      if (evidence.source) group.evidenceRecords.push({ source: evidence.source, claims: evidence.claims });
      group.evidence.push({ sourceId: feedback.evidence_source_id, claimIds: evidence.claims.map((claim) => claim.claimId), sufficiency: evidence.evaluation?.level || "INSUFFICIENT", missing: (evidence.evaluation?.missingEvidence || []).map((item) => item.type) });
    }
  }
  const now = new Date();
  const patterns = [...grouped.entries()].map(([key, group]) => {
    const feedback = group.feedback;
    const payloads = feedback.map((item) => parse(item.payload_json));
    const classes = feedback.map((item) => resultClass(item.result));
    const usable = classes.filter((item) => item !== "insufficient_learning");
    const counts = usable.reduce<Record<string, number>>((acc, item) => { acc[item] = (acc[item] || 0) + 1; return acc; }, {});
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "insufficient_learning";
    const sampleValues = payloads.map((item) => numberOrNull(item.sampleSize ?? item.sample_size)).filter((item): item is number => item !== null);
    const sampleSize = sampleValues.reduce((sum, value) => sum + value, 0);
    const dates = payloads.map((item) => String(item.measuredAt ?? item.measured_at ?? item.confirmedAt ?? item.confirmed_at ?? "")).filter(Boolean).sort();
    const lastTestedAt = dates.at(-1) || null;
    const decayScore = calculateDecay(lastTestedAt, now);
    const consistency = usable.length ? (counts[dominant] || 0) / usable.length : 0;
    const aggregateEvidence = group.evidenceRecords.length ? evaluateEvidence(group.evidenceRecords, { tenantId, guildId: group.scope.guildId === UNKNOWN ? null : group.scope.guildId, market: group.scope.market === UNKNOWN ? null : group.scope.market, country: group.scope.country === UNKNOWN ? null : group.scope.country, locale: group.scope.locale === UNKNOWN ? null : group.scope.locale }, now) : null;
    const sufficiency = aggregateEvidence?.level || "INSUFFICIENT";
    const availabilityValues = payloads.map(metricAvailability);
    const availability = availabilityValues.every((item) => item === "AVAILABLE") ? "AVAILABLE" : availabilityValues.every((item) => item === "UNAVAILABLE") ? "UNAVAILABLE" : "MIXED";
    const guardrail = payloads.map((item) => String(item.guardrailStatus ?? item.guardrail_status ?? "UNKNOWN").toUpperCase()).sort()[0] || "UNKNOWN";
    const confidence = calculateConfidence({ experimentCount: new Set(feedback.map((item) => item.experiment_id)).size, sampleSize, consistency, evidenceSufficiency: sufficiency, measurementAvailability: availability, guardrailStatus: guardrail, scopeMatch: 1, decayScore });
    const maturity = classifyMaturity({ experimentCount: feedback.length, sampleSize, confidence, consistency, decayScore, evidenceSufficiency: sufficiency });
    const revenueKinds = [...new Set(payloads.map(revenueKind))];
    return { patternKey: key, scope: group.scope, resultClass: dominant, resultDistribution: counts, conflictingResults: Object.keys(counts).length > 1, experimentCount: new Set(feedback.map((item) => item.experiment_id)).size, sampleSize, sampleAvailability: sampleValues.length === payloads.length ? "AVAILABLE" : sampleValues.length ? "MIXED" : "UNAVAILABLE", confidence, consistency: Math.round(consistency * 100) / 100, maturity, lastTestedAt, lastConfirmedAt: payloads.map((item) => String(item.confirmedAt ?? item.confirmed_at ?? "")).filter(Boolean).sort().at(-1) || null, decayScore: Math.round(decayScore * 100) / 100, sourceEvidenceCount: group.evidenceSourceIds.size, claimCount: group.claimIds.size, evidenceSufficiency: sufficiency, missingEvidence: [...new Set([...(aggregateEvidence?.missingEvidence || []).map((item) => item.type), ...group.evidence.flatMap((item) => item.missing)])], metricAvailability: availability, revenueKinds, viralScores: payloads.map((item) => numberOrNull(item.viralScore ?? item.viral_score)).filter((item): item is number => item !== null), conversionScores: payloads.map((item) => numberOrNull(item.conversionScore ?? item.conversion_score)).filter((item): item is number => item !== null), supportingEvidence: group.evidence, feedbackIds: feedback.map((item) => item.feedback_id) };
  }).filter((item) => Object.entries(filters).every(([key, value]) => !value || String((item.scope as Record<string, unknown>)[key] ?? item[key as keyof typeof item]) === value));
  return patterns;
}

export async function getLearningSummary(db: D1, tenantId = GROWTH_ENGINE_TENANT_ID) {
  const patterns = await getLearningPatterns(db, tenantId);
  return { tenantId, patternCount: patterns.length, resultDistribution: patterns.reduce<Record<string, number>>((a, p) => { a[p.resultClass] = (a[p.resultClass] || 0) + 1; return a; }, {}), maturityDistribution: patterns.reduce<Record<string, number>>((a, p) => { a[p.maturity] = (a[p.maturity] || 0) + 1; return a; }, {}), latestTestedAt: patterns.map((p) => p.lastTestedAt).filter(Boolean).sort().at(-1) || null };
}
