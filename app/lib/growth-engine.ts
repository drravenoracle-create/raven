export const GROWTH_ENGINE_TENANT_ID = "raven-oracle";
export const GROWTH_ENGINE_VERSION = "growth-engine-v3.0";

const allowedConversionEvents = new Set([
  "page_view",
  "article_engaged",
  "cta_click",
  "line_click",
  "ai_trial_start",
  "ai_trial_complete",
  "service_view",
  "booking_start",
  "booking_complete",
  "purchase_complete",
  "repeat_purchase",
]);

export function normalizeAttribution(value: unknown) {
  const next = String(value ?? "unknown");
  return next === "direct" || next === "assisted" || next === "unknown" ? next : "unknown";
}

export function normalizeConversionEvent(value: unknown) {
  const next = String(value ?? "").trim();
  return allowedConversionEvents.has(next) ? next : "page_view";
}

export function buildGrowthEvent(input: {
  eventType: string;
  sourceEngine: string;
  entityRefs?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  return {
    eventId: crypto.randomUUID(),
    tenantId: GROWTH_ENGINE_TENANT_ID,
    eventType: input.eventType,
    sourceEngine: input.sourceEngine,
    entityRefs: input.entityRefs || {},
    payload: input.payload || {},
    idempotencyKey: input.idempotencyKey || `${input.sourceEngine}:${input.eventType}:${Date.now()}`,
  };
}

export function calculateGrowthScore(input: {
  organicScore?: number;
  socialScore?: number;
  engagementScore?: number;
  conversionScore?: number;
  revenueScore?: number;
  retentionScore?: number;
  freshnessScore?: number;
  confidenceScore?: number;
  brandScore?: number;
  safetyScore?: number;
}) {
  if ((input.brandScore ?? 100) < 80) return { allowed: false, score: 0, reason: "brand_score_below_threshold" };
  if ((input.safetyScore ?? 100) < 90) return { allowed: false, score: 0, reason: "safety_score_below_threshold" };
  const score =
    Math.min(input.organicScore || 0, 100) * 0.18 +
    Math.min(input.socialScore || 0, 100) * 0.12 +
    Math.min(input.engagementScore || 0, 100) * 0.14 +
    Math.min(input.conversionScore || 0, 100) * 0.22 +
    Math.min(input.revenueScore || 0, 100) * 0.12 +
    Math.min(input.retentionScore || 0, 100) * 0.08 +
    Math.min(input.freshnessScore || 0, 100) * 0.06 +
    Math.min(input.confidenceScore || 0, 100) * 0.08;
  return { allowed: true, score: Math.round(score * 10) / 10, reason: "ok" };
}

export function evaluateInsightGuard(input: {
  sampleSize: number;
  confidence: number;
  riskLevel: string;
  sensitiveAttributeUsed?: boolean;
}) {
  if (input.sensitiveAttributeUsed) return { allowed: false, reason: "sensitive_attribute_not_allowed" };
  if (input.sampleSize < 30) return { allowed: false, reason: "insufficient_sample_size" };
  if (input.confidence < 0.5) return { allowed: false, reason: "low_confidence" };
  if (input.riskLevel === "high" || input.riskLevel === "locked") return { allowed: false, reason: "human_approval_required" };
  return { allowed: true, reason: "ok" };
}

export function deriveJourneyStage(eventName: string) {
  if (eventName === "repeat_purchase") return "repeat_customer";
  if (eventName === "purchase_complete") return "customer";
  if (eventName === "booking_complete") return "customer";
  if (eventName === "booking_start") return "booking_started";
  if (eventName === "service_view") return "service_interested";
  if (eventName === "ai_trial_complete" || eventName === "ai_trial_start") return "trial_user";
  if (eventName === "line_click") return "line_registered";
  if (eventName === "cta_click") return "lead";
  if (eventName === "article_engaged") return "engaged_visitor";
  return "visitor";
}

export function evaluateAutonomousAction(input: {
  riskLevel: string;
  costEstimate?: number;
  emergencyStopped?: boolean;
  optOut?: boolean;
  externalAction?: boolean;
}) {
  if (input.emergencyStopped) return { result: "deny", requiresApproval: true, reason: "emergency_stop_enabled" };
  if (input.optOut && input.externalAction) return { result: "deny", requiresApproval: true, reason: "opt_out_external_action_denied" };
  if ((input.costEstimate || 0) > 0 && input.riskLevel !== "LOW") return { result: "require_approval", requiresApproval: true, reason: "paid_or_costly_action_requires_approval" };
  if (input.riskLevel === "HIGH" || input.riskLevel === "CRITICAL") return { result: "require_approval", requiresApproval: true, reason: "high_risk_requires_human_approval" };
  if (input.riskLevel === "MEDIUM") return { result: "require_approval", requiresApproval: true, reason: "medium_risk_assisted" };
  return { result: "allow", requiresApproval: false, reason: "low_risk_allowed" };
}

export function classifyExecutiveEvidence(kind: string) {
  if (kind === "measured") return "fact";
  if (kind === "estimated") return "estimate";
  return "hypothesis";
}
