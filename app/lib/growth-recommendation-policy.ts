export const RECOMMENDATION_TYPES = ["PROVEN_REUSE", "EMERGING_TEST", "IMPROVEMENT_TEST", "RETEST_DECAYING", "COLLECT_MORE_EVIDENCE", "AVOID_FOR_NOW"] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];
export const PRIMARY_GOALS = ["VIRAL", "CONVERSION", "REVENUE", "LEARNING"] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

type Pattern = { resultClass: string; maturity: string; confidence: number; evidenceSufficiency: string; experimentCount: number; sampleSize: number; consistency: number; decayScore: number; metricAvailability: string; revenueKinds: string[]; scope: Record<string, string>; lastTestedAt: string | null; resultDistribution?: Record<string, number> };

export function primaryGoal(pattern: Pattern): PrimaryGoal {
  const metric = String(pattern.scope.metric || "").toLowerCase();
  if (/(view|reach|impression|share|save|watch|completion|viral)/.test(metric)) return "VIRAL";
  if (/(conversion|click|ctr|registration|trial|follow|profile)/.test(metric)) return "CONVERSION";
  if (/(revenue|sales|purchase|ltv)/.test(metric) && pattern.revenueKinds.includes("MEASURED")) return "REVENUE";
  return "LEARNING";
}

export function isFatigued(pattern: Pattern, now = new Date()) {
  if (!pattern.lastTestedAt || pattern.experimentCount < 5) return false;
  const timestamp = Date.parse(pattern.lastTestedAt);
  return Number.isFinite(timestamp) && (now.getTime() - timestamp) / 86400000 <= 30;
}

export function recommendationType(pattern: Pattern, now = new Date()): RecommendationType {
  if (pattern.resultClass === "insufficient_learning" || pattern.evidenceSufficiency === "INSUFFICIENT" || pattern.metricAvailability === "UNAVAILABLE") return "COLLECT_MORE_EVIDENCE";
  if (pattern.maturity === "DECAYING") return "RETEST_DECAYING";
  if (pattern.resultClass === "negative") return "IMPROVEMENT_TEST";
  if (pattern.maturity === "ESTABLISHED" && pattern.confidence >= 0.75 && !isFatigued(pattern, now)) return "PROVEN_REUSE";
  if (pattern.maturity === "ESTABLISHED" && isFatigued(pattern, now)) return "IMPROVEMENT_TEST";
  if (pattern.maturity === "EMERGING") return "EMERGING_TEST";
  return "COLLECT_MORE_EVIDENCE";
}

export function recommendationPriority(pattern: Pattern, now = new Date()) {
  const freshness = Math.max(0, Math.min(1, pattern.decayScore));
  const evidence = { STRONG: 1, MODERATE: .7, WEAK: .4, INSUFFICIENT: 0 }[pattern.evidenceSufficiency] ?? 0;
  const sample = Math.min(1, Math.max(0, pattern.sampleSize) / 100);
  const count = Math.min(1, Math.max(0, pattern.experimentCount) / 3);
  const consistency = Math.max(0, Math.min(1, pattern.consistency));
  const goalWeight = primaryGoal(pattern) === "LEARNING" ? .7 : 1;
  const type = recommendationType(pattern, now);
  const urgency = type === "RETEST_DECAYING" || type === "IMPROVEMENT_TEST" ? 1 : .8;
  return Math.round(Math.min(1, (evidence * .2 + pattern.confidence * .2 + count * .15 + sample * .1 + consistency * .15 + freshness * .1 + goalWeight * .1) * urgency) * 100) / 100;
}

export function stateFingerprint(pattern: Pattern) {
  return [pattern.resultClass, pattern.maturity, pattern.confidence, pattern.experimentCount, pattern.sampleSize, pattern.consistency, pattern.decayScore, pattern.evidenceSufficiency, pattern.metricAvailability, pattern.lastTestedAt || ""].join("|");
}
