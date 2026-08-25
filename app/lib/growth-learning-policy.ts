export const LEARNING_MATURITY = ["PROVISIONAL", "EMERGING", "ESTABLISHED", "DECAYING"] as const;
export type LearningMaturity = (typeof LEARNING_MATURITY)[number];

export const LEARNING_POLICY = {
  halfLifeDays: 90,
  establishedExperiments: 3,
  establishedSampleSize: 90,
  establishedConfidence: 0.75,
  establishedConsistency: 0.67,
  emergingExperiments: 2,
  emergingConfidence: 0.5,
} as const;

export function calculateDecay(lastTestedAt: string | null | undefined, now = new Date(), halfLifeDays = LEARNING_POLICY.halfLifeDays) {
  if (!lastTestedAt) return 0;
  const timestamp = Date.parse(lastTestedAt);
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86400000);
  return Math.max(0, Math.min(1, Math.pow(0.5, ageDays / halfLifeDays)));
}

export function calculateConfidence(input: {
  experimentCount: number;
  sampleSize: number;
  consistency: number;
  evidenceSufficiency: "STRONG" | "MODERATE" | "WEAK" | "INSUFFICIENT" | string;
  measurementAvailability: "AVAILABLE" | "MIXED" | "UNAVAILABLE" | string;
  guardrailStatus: "PASS" | "WARNING" | "FAIL" | "UNKNOWN" | string;
  scopeMatch: number;
  decayScore: number;
}) {
  const evidence = { STRONG: 0.9, MODERATE: 0.65, WEAK: 0.35, INSUFFICIENT: 0 }[input.evidenceSufficiency] ?? 0;
  const availability = { AVAILABLE: 1, MIXED: 0.5, UNAVAILABLE: 0 }[input.measurementAvailability] ?? 0;
  const guardrail = { PASS: 1, WARNING: 0.7, FAIL: 0.2, UNKNOWN: 0 }[input.guardrailStatus] ?? 0;
  const factors = [
    Math.min(1, Math.max(0, input.experimentCount) / 3),
    Math.min(1, Math.max(0, input.sampleSize) / 100),
    Math.max(0, Math.min(1, input.consistency)),
    evidence,
    availability,
    guardrail,
    Math.max(0, Math.min(1, input.scopeMatch)),
    Math.max(0, Math.min(1, input.decayScore)),
  ];
  const average = factors.reduce((sum, value) => sum + value, 0) / factors.length;
  // A single result is useful evidence, but never a mature/high-confidence pattern.
  return Math.round(Math.min(input.experimentCount < 2 ? 0.45 : 1, average) * 100) / 100;
}

export function classifyMaturity(input: { experimentCount: number; sampleSize: number; confidence: number; consistency: number; decayScore: number; evidenceSufficiency: string }): LearningMaturity {
  if (input.experimentCount > 0 && input.decayScore < 0.5) return "DECAYING";
  if (input.experimentCount >= LEARNING_POLICY.establishedExperiments && input.sampleSize >= LEARNING_POLICY.establishedSampleSize && input.confidence >= LEARNING_POLICY.establishedConfidence && input.consistency >= LEARNING_POLICY.establishedConsistency && input.evidenceSufficiency === "STRONG") return "ESTABLISHED";
  if (input.experimentCount >= LEARNING_POLICY.emergingExperiments && input.confidence >= LEARNING_POLICY.emergingConfidence) return "EMERGING";
  return "PROVISIONAL";
}
