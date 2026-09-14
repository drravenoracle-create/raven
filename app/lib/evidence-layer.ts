export const EVIDENCE_SOURCE_TYPES = [
  "analytics",
  "sns_metric",
  "experiment",
  "experiment_result",
  "user_feedback",
  "external_primary",
  "external_secondary",
  "external_research",
  "internal_observation",
  "internal_data",
  "model_inference",
  "manual_input",
] as const;

export const EVIDENCE_SUFFICIENCY = ["INSUFFICIENT", "WEAK", "MODERATE", "STRONG"] as const;
export const EVIDENCE_RISK_CLASSES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const EVIDENCE_DECISIONS = ["GO", "HOLD", "REQUIRE_APPROVAL", "INSUFFICIENT_EVIDENCE"] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number] | string;
export type EvidenceSufficiency = (typeof EVIDENCE_SUFFICIENCY)[number];
export type EvidenceRiskClass = (typeof EVIDENCE_RISK_CLASSES)[number];

export type EvidenceScope = {
  tenantId: string;
  guildId?: string | null;
  market?: string | null;
  country?: string | null;
  locale?: string | null;
};

export type EvidenceSource = EvidenceScope & {
  sourceId: string;
  sourceType: EvidenceSourceType;
  title: string;
  uri?: string | null;
  provider?: string | null;
  observedAt?: string | null;
  publishedAt?: string | null;
  retrievedAt?: string | null;
  validUntil?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type EvidenceClaim = EvidenceScope & {
  claimId: string;
  sourceId: string;
  claimType: string;
  statement: string;
  relevanceScore?: number | null;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type EvidenceRecord = { source: EvidenceSource; claims: EvidenceClaim[] };

export type MissingEvidence = {
  type: string;
  reason: string;
  market?: string | null;
  country?: string | null;
  locale?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
};

export type EvidenceEvaluation = {
  level: EvidenceSufficiency;
  freshness: { score: number; status: "fresh" | "stale" | "expired" | "unknown"; usableCount: number };
  diversity: { score: number; sourceTypes: string[]; modelInferenceRatio: number; nonModelCount: number };
  relevance: { score: number; applicableCount: number; excludedCount: number };
  sourceQuality: { score: number; scoreByType: Record<string, number> };
  evidenceCount: number;
  reasons: string[];
  warnings: string[];
  missingEvidence: MissingEvidence[];
};

export type EvidenceDecisionContext = {
  sufficiency: EvidenceEvaluation;
  riskClass: EvidenceRiskClass;
  authorizationRequired: boolean;
  authorizationStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
  evidence: EvidenceRecord[];
  missingEvidence: MissingEvidence[];
  decision: (typeof EVIDENCE_DECISIONS)[number];
  canProceed: boolean;
};

const SOURCE_QUALITY: Record<string, number> = {
  experiment_result: 0.95,
  experiment: 0.9,
  external_primary: 0.9,
  analytics: 0.85,
  sns_metric: 0.85,
  internal_observation: 0.8,
  internal_data: 0.8,
  user_feedback: 0.7,
  external_secondary: 0.65,
  external_research: 0.65,
  manual_input: 0.5,
  model_inference: 0.35,
};

const NON_MODEL_TYPES = new Set(Object.keys(SOURCE_QUALITY).filter((value) => value !== "model_inference"));

function finiteScore(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(number > 1 ? number / 100 : number, 1)) : fallback;
}

function dateValue(value: unknown) {
  if (!value) return null;
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
}

function scopeMatches(source: EvidenceSource, target: EvidenceScope, crossMarket = false) {
  if (source.tenantId !== target.tenantId) return false;
  if (target.guildId && source.guildId && source.guildId !== target.guildId) return false;
  if (!crossMarket && target.market && source.market && source.market !== target.market) return false;
  if (target.country && source.country && source.country !== target.country) return false;
  if (target.locale && source.locale && source.locale !== target.locale) return false;
  return true;
}

export function assertEvidenceTenant(tenantId: string, allowedTenantId: string) {
  if (!tenantId || tenantId !== allowedTenantId) throw new Error("Unknown or invalid tenant.");
  return tenantId;
}

export function isEvidenceApplicable(source: EvidenceSource, target: EvidenceScope, options: { crossMarket?: boolean } = {}) {
  return scopeMatches(source, target, Boolean(options.crossMarket));
}

export function evaluateEvidence(records: EvidenceRecord[], target: EvidenceScope, now = new Date()): EvidenceEvaluation {
  const applicable = records.filter((record) => scopeMatches(record.source, target));
  const excludedCount = records.length - applicable.length;
  const sources = applicable.map((record) => record.source);
  const claims = applicable.flatMap((record) => record.claims);
  const nowMs = now.getTime();
  let fresh = 0;
  let stale = 0;
  let expired = 0;
  for (const source of sources) {
    const validUntil = dateValue(source.validUntil);
    if (validUntil !== null && validUntil < nowMs) {
      expired += 1;
      continue;
    }
    const reference = dateValue(source.observedAt) ?? dateValue(source.retrievedAt) ?? dateValue(source.publishedAt);
    if (reference === null) continue;
    if (nowMs - reference <= 90 * 24 * 60 * 60 * 1000) fresh += 1;
    else stale += 1;
  }
  const usableCount = Math.max(0, fresh + stale);
  const freshnessScore = usableCount ? fresh / usableCount : 0;
  const freshnessStatus = expired === sources.length && sources.length > 0 ? "expired" : fresh > 0 ? "fresh" : stale > 0 ? "stale" : "unknown";
  const sourceTypes = [...new Set(sources.map((source) => source.sourceType))];
  const modelCount = sources.filter((source) => source.sourceType === "model_inference").length;
  const nonModelCount = sources.filter((source) => NON_MODEL_TYPES.has(source.sourceType)).length;
  const modelInferenceRatio = sources.length ? modelCount / sources.length : 0;
  const diversityScore = sources.length ? Math.min(1, (Math.min(sourceTypes.length, 3) / 3) * 0.6 + (nonModelCount > 0 ? 0.4 : 0)) : 0;
  const relevanceScore = claims.length ? claims.reduce((sum, claim) => sum + finiteScore(claim.relevanceScore, 0), 0) / claims.length : 0;
  const scoreByType: Record<string, number> = {};
  for (const source of sources) scoreByType[source.sourceType] = SOURCE_QUALITY[source.sourceType] ?? 0.4;
  const sourceQualityScore = sources.length ? sources.reduce((sum, source) => sum + (SOURCE_QUALITY[source.sourceType] ?? 0.4), 0) / sources.length : 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const missingEvidence: MissingEvidence[] = [];
  if (!sources.length) missingEvidence.push({ type: "need_internal_observation", reason: "適用可能なEvidenceがありません。", ...target, priority: "HIGH" });
  if (!fresh) missingEvidence.push({ type: "need_fresher_source", reason: "有効期間内のEvidenceがありません。", ...target, priority: "HIGH" });
  if (expired > 0) warnings.push(`${expired}件のEvidenceが期限切れです。`);
  if (modelInferenceRatio >= 0.5 || nonModelCount === 0) {
    warnings.push("model_inferenceへの偏りがあり、非モデルEvidenceが不足しています。");
    missingEvidence.push({ type: "need_non_model_evidence", reason: "モデル推論以外の観測・実験・一次情報が必要です。", ...target, priority: "HIGH" });
  }
  if (target.market && (sources.length === 0 || records.some((record) => record.source.market && record.source.market !== target.market))) {
    missingEvidence.push({ type: "need_target_market_evidence", reason: "対象市場に一致するEvidenceが不足しています。", ...target, priority: "HIGH" });
  }
  if (target.locale && (sources.length === 0 || records.some((record) => record.source.locale && record.source.locale !== target.locale))) {
    missingEvidence.push({ type: "need_target_locale_evidence", reason: "対象Localeに一致するEvidenceが不足しています。", ...target, priority: "HIGH" });
  }
  if (sourceTypes.length < 2) missingEvidence.push({ type: "need_diverse_source", reason: "EvidenceのSource Typeが単一です。", ...target, priority: "MEDIUM" });
  if (sources.length < 3) missingEvidence.push({ type: "need_larger_sample", reason: "Evidence件数が少なく、強い判断には不十分です。", ...target, priority: "MEDIUM" });
  if (relevanceScore < 0.6) missingEvidence.push({ type: "need_relevant_evidence", reason: "対象判断への関連性が不足しています。", ...target, priority: "HIGH" });
  const strongCandidate = sources.length >= 3 && freshnessScore >= 0.67 && diversityScore >= 0.6 && relevanceScore >= 0.75 && sourceQualityScore >= 0.75 && nonModelCount >= 2 && modelInferenceRatio < 0.5 && expired === 0;
  const moderateCandidate = sources.length >= 2 && freshnessScore > 0 && relevanceScore >= 0.5 && nonModelCount >= 1 && modelInferenceRatio < 0.75 && expired < sources.length;
  const weakCandidate = sources.length > 0 && (freshnessScore > 0 || relevanceScore > 0);
  const level: EvidenceSufficiency = strongCandidate ? "STRONG" : moderateCandidate ? "MODERATE" : weakCandidate ? "WEAK" : "INSUFFICIENT";
  if (level === "STRONG") reasons.push("複数の非モデルSource、十分なFreshness、関連性、Source Qualityを確認しました。");
  else if (level === "MODERATE") reasons.push("一定の関連Evidenceはありますが、強い判断に必要な多様性または件数が不足しています。");
  else if (level === "WEAK") reasons.push("Evidenceは存在しますが、Freshness・多様性・関連性のいずれかが不足しています。");
  else reasons.push("適用可能で有効なEvidenceが不足しています。");
  if (excludedCount) warnings.push(`${excludedCount}件はtenantまたは適用範囲不一致のため除外しました。`);
  return {
    level,
    freshness: { score: Math.round(freshnessScore * 100) / 100, status: freshnessStatus, usableCount },
    diversity: { score: Math.round(diversityScore * 100) / 100, sourceTypes, modelInferenceRatio: Math.round(modelInferenceRatio * 100) / 100, nonModelCount },
    relevance: { score: Math.round(relevanceScore * 100) / 100, applicableCount: applicable.length, excludedCount },
    sourceQuality: { score: Math.round(sourceQualityScore * 100) / 100, scoreByType },
    evidenceCount: sources.length,
    reasons,
    warnings,
    missingEvidence: [...new Map(missingEvidence.map((item) => [item.type, item])).values()],
  };
}

export function buildEvidenceDecision(records: EvidenceRecord[], target: EvidenceScope, riskClass: string, authorizationStatus: EvidenceDecisionContext["authorizationStatus"] = "NOT_REQUIRED", now = new Date()): EvidenceDecisionContext {
  const normalizedRisk = EVIDENCE_RISK_CLASSES.includes(String(riskClass).toUpperCase() as EvidenceRiskClass) ? String(riskClass).toUpperCase() as EvidenceRiskClass : "HIGH";
  const sufficiency = evaluateEvidence(records, target, now);
  const authorizationRequired = normalizedRisk === "HIGH" || normalizedRisk === "CRITICAL";
  const approved = authorizationStatus === "APPROVED";
  const decision = sufficiency.level === "INSUFFICIENT" ? "INSUFFICIENT_EVIDENCE" : authorizationRequired && !approved ? "REQUIRE_APPROVAL" : sufficiency.level === "WEAK" ? "HOLD" : "GO";
  return { sufficiency, riskClass: normalizedRisk, authorizationRequired, authorizationStatus, evidence: records, missingEvidence: sufficiency.missingEvidence, decision, canProceed: decision === "GO" };
}

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { first<T = unknown>(): Promise<T | null>; all<T = unknown>(): Promise<{ results?: T[] }>; run(): Promise<unknown> } } };

function parseJson(value: unknown, fallback: Record<string, unknown> = {}) {
  try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; }
}

function sourceFromRow(row: Record<string, unknown>): EvidenceSource {
  return {
    sourceId: String(row.source_id), tenantId: String(row.tenant_id), guildId: row.guild_id ? String(row.guild_id) : null,
    market: row.market ? String(row.market) : null, country: row.country ? String(row.country) : null, locale: row.locale ? String(row.locale) : null,
    sourceType: String(row.source_type), title: String(row.title || ""), uri: row.uri ? String(row.uri) : null, provider: row.provider ? String(row.provider) : null,
    observedAt: row.observed_at ? String(row.observed_at) : null, publishedAt: row.published_at ? String(row.published_at) : null, retrievedAt: row.retrieved_at ? String(row.retrieved_at) : null,
    validUntil: row.valid_until ? String(row.valid_until) : null, metadata: parseJson(row.metadata_json), createdAt: String(row.created_at || ""), updatedAt: String(row.updated_at || ""),
  };
}

function claimFromRow(row: Record<string, unknown>): EvidenceClaim {
  return {
    claimId: String(row.claim_id), sourceId: String(row.source_id), tenantId: String(row.tenant_id), guildId: row.guild_id ? String(row.guild_id) : null,
    market: row.market ? String(row.market) : null, country: row.country ? String(row.country) : null, locale: row.locale ? String(row.locale) : null,
    claimType: String(row.claim_type), statement: String(row.statement), relevanceScore: row.relevance_score === null ? null : Number(row.relevance_score), confidence: row.confidence === null ? null : Number(row.confidence), metadata: parseJson(row.metadata_json), createdAt: String(row.created_at || ""),
  };
}

export async function createSource(db: D1, input: EvidenceSource) {
  assertEvidenceTenant(input.tenantId, input.tenantId);
  await db.prepare(`INSERT INTO evidence_sources
    (source_id, tenant_id, guild_id, market, country, locale, source_type, title, uri, provider, observed_at, published_at, retrieved_at, valid_until, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(input.sourceId, input.tenantId, input.guildId || null, input.market || null, input.country || null, input.locale || null, input.sourceType, input.title, input.uri || null, input.provider || null, input.observedAt || null, input.publishedAt || null, input.retrievedAt || null, input.validUntil || null, JSON.stringify(input.metadata || {})).run();
  return getSource(db, input.tenantId, input.sourceId);
}

export async function getSource(db: D1, tenantId: string, sourceId: string) {
  const row = await db.prepare("SELECT * FROM evidence_sources WHERE tenant_id = ? AND source_id = ? LIMIT 1").bind(tenantId, sourceId).first<Record<string, unknown>>();
  return row ? sourceFromRow(row) : null;
}

export async function listSources(db: D1, scope: EvidenceScope, limit = 100) {
  const rows = await db.prepare("SELECT * FROM evidence_sources WHERE tenant_id = ? AND (? = '' OR guild_id = ?) AND (? = '' OR market = ?) AND (? = '' OR country = ?) AND (? = '' OR locale = ?) ORDER BY datetime(created_at) DESC LIMIT ?")
    .bind(scope.tenantId, scope.guildId || "", scope.guildId || "", scope.market || "", scope.market || "", scope.country || "", scope.country || "", scope.locale || "", scope.locale || "", Math.min(Math.max(limit, 1), 100)).all<Record<string, unknown>>();
  return (rows.results || []).map(sourceFromRow);
}

export async function createClaim(db: D1, input: EvidenceClaim) {
  const source = await getSource(db, input.tenantId, input.sourceId);
  if (!source) throw new Error("Evidence source not found for tenant.");
  await db.prepare(`INSERT INTO evidence_claims
    (claim_id, source_id, tenant_id, guild_id, market, country, locale, claim_type, statement, relevance_score, confidence, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(input.claimId, input.sourceId, input.tenantId, input.guildId || source.guildId || null, input.market || source.market || null, input.country || source.country || null, input.locale || source.locale || null, input.claimType, input.statement, input.relevanceScore ?? null, input.confidence ?? null, JSON.stringify(input.metadata || {})).run();
  return getClaim(db, input.tenantId, input.claimId);
}

export async function getClaim(db: D1, tenantId: string, claimId: string) {
  const row = await db.prepare("SELECT * FROM evidence_claims WHERE tenant_id = ? AND claim_id = ? LIMIT 1").bind(tenantId, claimId).first<Record<string, unknown>>();
  return row ? claimFromRow(row) : null;
}

export async function listClaimsBySource(db: D1, tenantId: string, sourceId: string) {
  const rows = await db.prepare("SELECT * FROM evidence_claims WHERE tenant_id = ? AND source_id = ? ORDER BY datetime(created_at) ASC").bind(tenantId, sourceId).all<Record<string, unknown>>();
  return (rows.results || []).map(claimFromRow);
}

export async function findEvidence(db: D1, scope: EvidenceScope, limit = 200) {
  const sources = await listSources(db, scope, limit);
  const records: EvidenceRecord[] = [];
  for (const source of sources) records.push({ source, claims: await listClaimsBySource(db, scope.tenantId, source.sourceId) });
  return records.filter((record) => isEvidenceApplicable(record.source, scope));
}
