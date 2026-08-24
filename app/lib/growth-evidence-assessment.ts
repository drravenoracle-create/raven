import {
  EVIDENCE_SCOPES,
  EVIDENCE_SOURCE_TYPES,
  type EvidenceClaim,
  type EvidenceScope,
  type EvidenceSource,
  type EvidenceSourceType,
} from "./growth-evidence.ts";
import { getTenantConfig } from "./tenant-config-resolver.ts";

export const EVIDENCE_FRESHNESS_STATES = ["fresh", "aging", "stale", "expired", "unknown"] as const;
export type EvidenceFreshnessState = (typeof EVIDENCE_FRESHNESS_STATES)[number];

export const SUFFICIENCY_LEVELS = ["INSUFFICIENT", "WEAK", "MODERATE", "STRONG"] as const;
export type SufficiencyLevel = (typeof SUFFICIENCY_LEVELS)[number];

export const DECISION_RISK_CLASSES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type DecisionRiskClass = (typeof DECISION_RISK_CLASSES)[number];

export type EvidenceDecisionContext = {
  tenantId: string;
  guildId?: string | null;
  market?: string | null;
  country?: string | null;
  locale?: string | null;
  characterId?: string | null;
  menuId?: string | null;
  targetSegment?: string | null;
  asOf?: string;
};

export type EvidenceAssessmentConfig = {
  freshnessDays: Partial<Record<EvidenceSourceType, number>>;
  sourceReliability: Partial<Record<EvidenceSourceType, number>>;
  minimumEvidenceCount: number;
  moderateScopeCount: number;
  strongScopeCount: number;
  relevanceThreshold: number;
  qualityThreshold: number;
};

export const DEFAULT_EVIDENCE_ASSESSMENT_CONFIG: EvidenceAssessmentConfig = {
  freshnessDays: {
    first_party_actual: 30,
    official_platform_data: 14,
    official_statistics: 365,
    primary_research: 365,
    reputable_secondary: 180,
    community_signal: 30,
    experiment_result: 90,
    human_input: 90,
    model_inference: 30,
  },
  sourceReliability: {
    first_party_actual: 90,
    official_platform_data: 90,
    official_statistics: 85,
    primary_research: 80,
    reputable_secondary: 70,
    community_signal: 45,
    experiment_result: 85,
    human_input: 60,
    model_inference: 30,
  },
  minimumEvidenceCount: 2,
  moderateScopeCount: 2,
  strongScopeCount: 3,
  relevanceThreshold: 0.75,
  qualityThreshold: 70,
};

const RISK_REQUIREMENTS: Record<DecisionRiskClass, SufficiencyLevel> = {
  LOW: "MODERATE",
  MEDIUM: "MODERATE",
  HIGH: "STRONG",
  CRITICAL: "STRONG",
};

export type EvidenceMissingCode =
  | "need_internal_observation"
  | "need_experiment_result"
  | "need_external_primary"
  | "need_fresher_source"
  | "need_target_market_evidence"
  | "need_larger_sample"
  | "need_scope_diversity";

export type EvidenceQualityAssessment = {
  sourceReliability: number | null;
  freshness: EvidenceFreshnessState;
  claimRelevance: number;
  tenantRelevance: number;
  guildRelevance: number;
  marketRelevance: number;
  localeRelevance: number;
  dataCompleteness: number;
  scope: EvidenceScope | null;
  provenanceAvailable: boolean;
  reasons: string[];
  warnings: string[];
};

export type EvidenceDiversityAssessment = {
  scopes: EvidenceScope[];
  sourceTypes: EvidenceSourceType[];
  scopeCount: number;
  sourceTypeCount: number;
  score: number;
  reasons: string[];
};

export type EvidenceAssessment = {
  tenantId: string;
  riskClass: DecisionRiskClass;
  quality: EvidenceQualityAssessment[];
  freshness: Array<{ sourceId: string; state: EvidenceFreshnessState; ageDays: number | null }>;
  diversity: EvidenceDiversityAssessment;
  relevance: { score: number; reasons: string[]; warnings: string[] };
  sufficiency: SufficiencyLevel;
  sufficiencyScore: number;
  reasons: string[];
  missingEvidence: EvidenceMissingCode[];
  warnings: string[];
  recommendedMinimum: SufficiencyLevel;
  meetsRiskRequirement: boolean;
  humanApprovalRequired: boolean;
  executionAllowed: false;
  decisionMode: "assessment_only";
};

function asOfDate(value?: string) {
  const date = new Date(value || new Date().toISOString());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function daysBetween(later: Date, earlier: Date) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 86_400_000));
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sameOrUnknown(expected?: string | null, actual?: string | null) {
  if (!expected) return 1;
  if (!actual) return 0.5;
  return expected === actual ? 1 : 0;
}

function metadataValue(source: EvidenceSource, key: string) {
  const metadata = source.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  return (metadata as Record<string, unknown>)[key];
}

export function assessFreshness(source: EvidenceSource, asOf: Date, config = DEFAULT_EVIDENCE_ASSESSMENT_CONFIG) {
  const validUntil = source.validUntil ? new Date(source.validUntil) : null;
  if (validUntil && !Number.isNaN(validUntil.getTime()) && validUntil < asOf) {
    return { state: "expired" as const, ageDays: null };
  }
  const dates = [source.observedAt, source.retrievedAt, source.publishedAt]
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  if (!dates.length) return { state: "unknown" as const, ageDays: null };
  const ageDays = daysBetween(asOf, dates[0]);
  const threshold = config.freshnessDays[source.sourceType] ?? 30;
  if (ageDays <= Math.max(1, Math.floor(threshold / 2))) return { state: "fresh" as const, ageDays };
  if (ageDays <= threshold) return { state: "aging" as const, ageDays };
  return { state: "stale" as const, ageDays };
}

function sourceQuality(source: EvidenceSource, context: EvidenceDecisionContext, asOf: Date, config: EvidenceAssessmentConfig, scope: EvidenceScope | null, claim?: EvidenceClaim): EvidenceQualityAssessment {
  const freshness = assessFreshness(source, asOf, config);
  const configured = config.sourceReliability[source.sourceType];
  const sourceReliability = numberOrNull(source.qualityScore) ?? numberOrNull(configured);
  const tenantRelevance = source.tenantId === context.tenantId ? 1 : 0;
  const guildRelevance = sameOrUnknown(context.guildId, source.guildId);
  const marketRelevance = sameOrUnknown(context.market, claim?.market || source.market);
  const localeRelevance = sameOrUnknown(context.locale, claim?.locale || source.locale);
  const countryRelevance = sameOrUnknown(context.country, claim?.country || source.country);
  const claimRelevance = (marketRelevance + localeRelevance + countryRelevance) / 3;
  const fields = [source.sourceId, source.tenantId, source.sourceType, source.sourceName, source.status];
  const dataCompleteness = fields.filter(Boolean).length / fields.length;
  const provenanceAvailable = Boolean(source.sourceUrl || source.provider || source.publisher);
  const reasons = [`source reliability ${sourceReliability ?? "unknown"}`, `freshness ${freshness.state}`, `claim relevance ${claimRelevance.toFixed(2)}`];
  const warnings: string[] = [];
  if (freshness.state === "expired" || freshness.state === "stale") warnings.push(`source ${source.sourceId} is ${freshness.state}`);
  if (freshness.state === "unknown") warnings.push(`source ${source.sourceId} has no usable freshness date`);
  if (!provenanceAvailable) warnings.push(`source ${source.sourceId} provenance is incomplete`);
  if (context.characterId && metadataValue(source, "character_id") !== context.characterId) warnings.push("character relevance is not confirmed");
  if (context.menuId && metadataValue(source, "menu_id") !== context.menuId) warnings.push("menu relevance is not confirmed");
  return { sourceReliability, freshness: freshness.state, claimRelevance, tenantRelevance, guildRelevance, marketRelevance, localeRelevance, dataCompleteness, scope, provenanceAvailable, reasons, warnings };
}

function levelRank(level: SufficiencyLevel) {
  return SUFFICIENCY_LEVELS.indexOf(level);
}

export class EvidenceAssessmentService {
  private readonly config: EvidenceAssessmentConfig;

  constructor(config: Partial<EvidenceAssessmentConfig> = {}) {
    this.config = {
      ...DEFAULT_EVIDENCE_ASSESSMENT_CONFIG,
      ...config,
      freshnessDays: { ...DEFAULT_EVIDENCE_ASSESSMENT_CONFIG.freshnessDays, ...(config.freshnessDays || {}) },
      sourceReliability: { ...DEFAULT_EVIDENCE_ASSESSMENT_CONFIG.sourceReliability, ...(config.sourceReliability || {}) },
    };
  }

  assess(input: { sources: readonly EvidenceSource[]; claims: readonly EvidenceClaim[]; context: EvidenceDecisionContext; riskClass: DecisionRiskClass }): EvidenceAssessment {
    const { sources, claims, context, riskClass } = input;
    if (!DECISION_RISK_CLASSES.includes(riskClass)) throw new Error(`Invalid decision risk class: ${riskClass}`);
    if (!getTenantConfig(context.tenantId)) throw new Error(`Unknown tenant: ${context.tenantId}`);
    if (sources.some((source) => source.tenantId !== context.tenantId) || claims.some((claim) => claim.tenantId !== context.tenantId)) {
      throw new Error("Evidence tenant mixing is not allowed.");
    }
    const sourceMap = new Map(sources.map((source) => [source.sourceId, source]));
    const asOf = asOfDate(context.asOf);
    const quality: EvidenceQualityAssessment[] = [];
    const freshness: EvidenceAssessment["freshness"] = [];
    const warnings: string[] = [];
    const usableClaims: EvidenceClaim[] = [];
    for (const claim of claims) {
      const source = sourceMap.get(claim.sourceId);
      if (!source) {
        warnings.push(`claim ${claim.claimId} references an unavailable source`);
        continue;
      }
      const evaluated = sourceQuality(source, context, asOf, this.config, claim.evidenceScope, claim);
      quality.push(evaluated);
      const currentFreshness = assessFreshness(source, asOf, this.config);
      freshness.push({ sourceId: source.sourceId, ...currentFreshness });
      warnings.push(...evaluated.warnings);
      if (currentFreshness.state !== "expired" && source.status !== "error" && source.status !== "unavailable") usableClaims.push(claim);
    }
    const scopes = [...new Set(usableClaims.map((claim) => claim.evidenceScope))];
    const sourceTypes = [...new Set(usableClaims.map((claim) => sourceMap.get(claim.sourceId)?.sourceType).filter(Boolean))] as EvidenceSourceType[];
    const diversityScore = Math.min(1, scopes.length / Math.max(this.config.strongScopeCount, 1));
    const diversity: EvidenceDiversityAssessment = {
      scopes, sourceTypes, scopeCount: scopes.length, sourceTypeCount: sourceTypes.length, score: diversityScore,
      reasons: [`${scopes.length} evidence scope(s)`, `${sourceTypes.length} source type(s)`],
    };
    const relevanceValues = quality.map((item) => (item.tenantRelevance + item.guildRelevance + item.claimRelevance) / 3);
    const relevanceScore = relevanceValues.length ? relevanceValues.reduce((sum, value) => sum + value, 0) / relevanceValues.length : 0;
    const relevanceWarnings: string[] = [];
    if (context.market && !usableClaims.some((claim) => claim.market === context.market || sourceMap.get(claim.sourceId)?.market === context.market)) relevanceWarnings.push("target market evidence is missing");
    if (context.country && !usableClaims.some((claim) => claim.country === context.country || sourceMap.get(claim.sourceId)?.country === context.country)) relevanceWarnings.push("target country evidence is missing");
    if (context.locale && !usableClaims.some((claim) => claim.locale === context.locale || sourceMap.get(claim.sourceId)?.locale === context.locale)) relevanceWarnings.push("target locale evidence is missing");
    const relevance = { score: relevanceScore, reasons: [`average relevance ${relevanceScore.toFixed(2)}`], warnings: relevanceWarnings };
    const reasons: string[] = [];
    const missingEvidence = new Set<EvidenceMissingCode>();
    if (!usableClaims.length) missingEvidence.add("need_internal_observation");
    if (!scopes.includes("internal_observation")) missingEvidence.add("need_internal_observation");
    if (!scopes.includes("experiment_result")) missingEvidence.add("need_experiment_result");
    if (!scopes.includes("external_primary")) missingEvidence.add("need_external_primary");
    if (usableClaims.length < this.config.minimumEvidenceCount) missingEvidence.add("need_larger_sample");
    if (scopes.length < this.config.moderateScopeCount) missingEvidence.add("need_scope_diversity");
    if (relevanceScore < this.config.relevanceThreshold) missingEvidence.add("need_target_market_evidence");
    if (freshness.some((item) => item.state === "stale" || item.state === "expired")) missingEvidence.add("need_fresher_source");
    const averageQuality = quality.length ? quality.reduce((sum, item) => sum + (item.sourceReliability || 0), 0) / quality.length : 0;
    const freshCount = freshness.filter((item) => item.state === "fresh" || item.state === "aging").length;
    const hasStrongScopes = scopes.includes("internal_observation") && scopes.includes("experiment_result") && scopes.includes("external_primary");
    let sufficiency: SufficiencyLevel = "INSUFFICIENT";
    if (usableClaims.length >= this.config.minimumEvidenceCount) sufficiency = "WEAK";
    if (usableClaims.length >= this.config.minimumEvidenceCount && scopes.length >= this.config.moderateScopeCount && relevanceScore >= this.config.relevanceThreshold && freshCount > 0) sufficiency = "MODERATE";
    if (usableClaims.length >= Math.max(this.config.minimumEvidenceCount, 3) && hasStrongScopes && scopes.length >= this.config.strongScopeCount && relevanceScore >= this.config.relevanceThreshold && averageQuality >= this.config.qualityThreshold && freshCount === freshness.length) sufficiency = "STRONG";
    if (sufficiency === "INSUFFICIENT") reasons.push("usable evidence is missing or insufficient");
    if (sufficiency === "WEAK") reasons.push("evidence exists but diversity, freshness, or relevance is limited");
    if (sufficiency === "MODERATE") reasons.push("multiple relevant evidence items support a cautious decision");
    if (sufficiency === "STRONG") reasons.push("internal, experiment, and external primary evidence agree with current context");
    reasons.push(`${usableClaims.length} usable claim(s)`, `${scopes.length} distinct scope(s)`, `fresh evidence ${freshCount}/${freshness.length}`);
    const recommendedMinimum = RISK_REQUIREMENTS[riskClass];
    const meetsRiskRequirement = levelRank(sufficiency) >= levelRank(recommendedMinimum);
    const humanApprovalRequired = riskClass === "HIGH" || riskClass === "CRITICAL";
    if (humanApprovalRequired) warnings.push(`${riskClass} decisions require human approval even with strong evidence`);
    warnings.push(...relevance.warnings);
    return {
      tenantId: context.tenantId, riskClass, quality, freshness, diversity, relevance, sufficiency,
      sufficiencyScore: Math.round((Math.min(1, (usableClaims.length / Math.max(3, this.config.minimumEvidenceCount)) * 0.35 + diversityScore * 0.25 + relevanceScore * 0.2 + (averageQuality / 100) * 0.2)) * 100),
      reasons, missingEvidence: [...missingEvidence], warnings, recommendedMinimum, meetsRiskRequirement,
      humanApprovalRequired, executionAllowed: false, decisionMode: "assessment_only",
    };
  }
}

export const evidenceAssessmentService = new EvidenceAssessmentService();
