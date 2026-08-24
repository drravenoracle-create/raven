import { getTenantConfig } from "./tenant-config-resolver.ts";

export const EVIDENCE_SCOPES = [
  "internal_observation",
  "external_primary",
  "external_secondary",
  "experiment_result",
  "model_inference",
  "human_input",
] as const;
export type EvidenceScope = (typeof EVIDENCE_SCOPES)[number];

export const EVIDENCE_SOURCE_TYPES = [
  "first_party_actual",
  "official_platform_data",
  "official_statistics",
  "primary_research",
  "reputable_secondary",
  "community_signal",
  "experiment_result",
  "human_input",
  "model_inference",
] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const EVIDENCE_SOURCE_STATUSES = ["active", "stale", "expired", "unavailable", "error"] as const;
export type EvidenceSourceStatus = (typeof EVIDENCE_SOURCE_STATUSES)[number];

export type EvidenceSource = {
  sourceId: string;
  tenantId: string;
  guildId?: string | null;
  sourceType: EvidenceSourceType;
  provider?: string | null;
  sourceName: string;
  sourceUrl?: string | null;
  publisher?: string | null;
  market?: string | null;
  country?: string | null;
  locale?: string | null;
  publishedAt?: string | null;
  retrievedAt?: string | null;
  observedAt?: string | null;
  validUntil?: string | null;
  qualityScore?: number | null;
  status: EvidenceSourceStatus;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

export type EvidenceClaim = {
  claimId: string;
  tenantId: string;
  sourceId: string;
  evidenceScope: EvidenceScope;
  claimType: string;
  statement: string;
  metricName?: string | null;
  metricValue?: number | null;
  unit?: string | null;
  market?: string | null;
  country?: string | null;
  locale?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  confidence?: number | null;
  createdAt?: string;
};

export type EvidenceReadContract = {
  source: EvidenceSource;
  claims: EvidenceClaim[];
};

type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

const SECRET_KEY = /(^|[_-])token$|access[_-]?token|authorization|api[_-]?key|client[_-]?secret|refresh[_-]?token|password|credential|private[_-]?key/i;
const SECRET_QUERY_KEY = /access[_-]?token|token|authorization|api[_-]?key|client[_-]?secret|refresh[_-]?token|password|credential|secret|private[_-]?key/i;

function clean(value: unknown, maxLength = 2000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function optional(value: unknown, maxLength = 500) {
  const next = clean(value, maxLength);
  return next || null;
}

function score(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.min(next, 100)) : null;
}

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? "[REDACTED]" : scrub(item)]));
  }
  if (typeof value === "string") return value.replace(/(Bearer\s+|access_token=|token=|api_key=|secret=)[^\s&]+/gi, "$1[REDACTED]");
  return value;
}

export function sanitizeEvidenceUrl(value: unknown) {
  const raw = clean(value, 2000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) if (SECRET_QUERY_KEY.test(key)) url.searchParams.delete(key);
    url.hash = "";
    return url.toString();
  } catch {
    return raw.replace(/([?&](?:access_token|token|api_key|secret|password)=[^&\s]+)/gi, (match) => `${match.slice(0, match.indexOf("="))}=[REDACTED]`);
  }
}

export function sanitizeEvidenceMetadata(value: unknown) {
  return scrub(value ?? {});
}

function assertTenant(tenantId: string) {
  const id = clean(tenantId, 120);
  if (!id || !getTenantConfig(id)) throw new Error(`Unknown tenant: ${id || "missing"}`);
  return id;
}

function assertScope(value: unknown): EvidenceScope {
  const next = clean(value, 80) as EvidenceScope;
  if (!EVIDENCE_SCOPES.includes(next)) throw new Error(`Invalid evidence scope: ${next}`);
  return next;
}

function assertSourceType(value: unknown): EvidenceSourceType {
  const next = clean(value, 80) as EvidenceSourceType;
  if (!EVIDENCE_SOURCE_TYPES.includes(next)) throw new Error(`Invalid evidence source type: ${next}`);
  return next;
}

function assertStatus(value: unknown): EvidenceSourceStatus {
  const next = clean(value || "active", 40) as EvidenceSourceStatus;
  if (!EVIDENCE_SOURCE_STATUSES.includes(next)) throw new Error(`Invalid evidence source status: ${next}`);
  return next;
}

function parseJson(value: unknown) {
  try { return JSON.parse(String(value || "{}")); } catch { return {}; }
}

function mapSource(row: Record<string, unknown>): EvidenceSource {
  return {
    sourceId: String(row.source_id), tenantId: String(row.tenant_id), guildId: (row.guild_id as string) || null,
    sourceType: String(row.source_type) as EvidenceSourceType, provider: (row.provider as string) || null,
    sourceName: String(row.source_name), sourceUrl: (row.source_url as string) || null, publisher: (row.publisher as string) || null,
    market: (row.market as string) || null, country: (row.country as string) || null, locale: (row.locale as string) || null,
    publishedAt: (row.published_at as string) || null, retrievedAt: (row.retrieved_at as string) || null,
    observedAt: (row.observed_at as string) || null, validUntil: (row.valid_until as string) || null,
    qualityScore: row.quality_score === null || row.quality_score === undefined ? null : Number(row.quality_score),
    status: String(row.status) as EvidenceSourceStatus, metadata: parseJson(row.metadata_json),
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  };
}

function mapClaim(row: Record<string, unknown>): EvidenceClaim {
  return {
    claimId: String(row.claim_id), tenantId: String(row.tenant_id), sourceId: String(row.source_id),
    evidenceScope: String(row.evidence_scope) as EvidenceScope, claimType: String(row.claim_type), statement: String(row.statement),
    metricName: (row.metric_name as string) || null, metricValue: row.metric_value === null || row.metric_value === undefined ? null : Number(row.metric_value),
    unit: (row.unit as string) || null, market: (row.market as string) || null, country: (row.country as string) || null,
    locale: (row.locale as string) || null, periodStart: (row.period_start as string) || null, periodEnd: (row.period_end as string) || null,
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence), createdAt: row.created_at as string,
  };
}

export class EvidenceRepository {
  private readonly db: D1;

  constructor(db: D1) {
    this.db = db;
  }

  async createSource(input: Omit<EvidenceSource, "createdAt" | "updatedAt">) {
    const tenantId = assertTenant(input.tenantId);
    const sourceId = clean(input.sourceId, 160) || crypto.randomUUID();
    const sourceName = clean(input.sourceName, 300);
    if (!sourceName) throw new Error("Evidence source name is required.");
    await this.db.prepare(`INSERT INTO growth_evidence_sources
      (source_id, tenant_id, guild_id, source_type, provider, source_name, source_url, publisher, market, country, locale,
       published_at, retrieved_at, observed_at, valid_until, quality_score, status, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(sourceId, tenantId, optional(input.guildId), assertSourceType(input.sourceType), optional(input.provider), sourceName,
        sanitizeEvidenceUrl(input.sourceUrl), optional(input.publisher), optional(input.market), optional(input.country), optional(input.locale),
        optional(input.publishedAt, 80), optional(input.retrievedAt, 80), optional(input.observedAt, 80), optional(input.validUntil, 80),
        score(input.qualityScore), assertStatus(input.status), JSON.stringify(sanitizeEvidenceMetadata(input.metadata)))
      .run();
    return this.getSource(tenantId, sourceId);
  }

  async getSource(tenantId: string, sourceId: string) {
    const id = assertTenant(tenantId);
    const row = await this.db.prepare("SELECT * FROM growth_evidence_sources WHERE tenant_id = ? AND source_id = ? LIMIT 1").bind(id, clean(sourceId, 160)).first<Record<string, unknown>>();
    return row ? mapSource(row) : undefined;
  }

  async listSources(tenantId: string, filters: { sourceType?: string; status?: string; market?: string; locale?: string; limit?: number } = {}) {
    const id = assertTenant(tenantId);
    const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 100);
    const rows = await this.db.prepare(`SELECT * FROM growth_evidence_sources
      WHERE tenant_id = ? AND (? = '' OR source_type = ?) AND (? = '' OR status = ?)
        AND (? = '' OR market = ?) AND (? = '' OR locale = ?)
      ORDER BY COALESCE(retrieved_at, observed_at, created_at) DESC LIMIT ?`)
      .bind(id, clean(filters.sourceType, 80), clean(filters.sourceType, 80), clean(filters.status, 40), clean(filters.status, 40),
        clean(filters.market, 80), clean(filters.market, 80), clean(filters.locale, 80), clean(filters.locale, 80), limit).all<Record<string, unknown>>();
    return (rows.results || []).map(mapSource);
  }

  async createClaim(input: Omit<EvidenceClaim, "createdAt">) {
    const tenantId = assertTenant(input.tenantId);
    const source = await this.getSource(tenantId, input.sourceId);
    if (!source) throw new Error("Evidence source not found for tenant.");
    const claimType = clean(input.claimType, 120);
    const statement = clean(input.statement, 4000);
    if (!claimType || !statement) throw new Error("Evidence claim type and statement are required.");
    const claimId = clean(input.claimId, 160) || crypto.randomUUID();
    await this.db.prepare(`INSERT INTO growth_evidence_claims
      (claim_id, tenant_id, source_id, evidence_scope, claim_type, statement, metric_name, metric_value, unit, market, country, locale, period_start, period_end, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(claimId, tenantId, source.sourceId, assertScope(input.evidenceScope), claimType, statement,
        optional(input.metricName, 160), input.metricValue === null || input.metricValue === undefined ? null : Number(input.metricValue), optional(input.unit, 80),
        optional(input.market), optional(input.country), optional(input.locale), optional(input.periodStart, 80), optional(input.periodEnd, 80),
        score(input.confidence)).run();
    return this.getClaim(tenantId, claimId);
  }

  async getClaim(tenantId: string, claimId: string) {
    const id = assertTenant(tenantId);
    const row = await this.db.prepare("SELECT * FROM growth_evidence_claims WHERE tenant_id = ? AND claim_id = ? LIMIT 1").bind(id, clean(claimId, 160)).first<Record<string, unknown>>();
    return row ? mapClaim(row) : undefined;
  }

  async listClaimsForSource(tenantId: string, sourceId: string) {
    const id = assertTenant(tenantId);
    const rows = await this.db.prepare("SELECT * FROM growth_evidence_claims WHERE tenant_id = ? AND source_id = ? ORDER BY datetime(created_at) DESC").bind(id, clean(sourceId, 160)).all<Record<string, unknown>>();
    return (rows.results || []).map(mapClaim);
  }

  async listClaimsForTenant(tenantId: string, filters: { scope?: string; market?: string; locale?: string; limit?: number } = {}) {
    const id = assertTenant(tenantId);
    const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 200);
    const rows = await this.db.prepare(`SELECT * FROM growth_evidence_claims
      WHERE tenant_id = ? AND (? = '' OR evidence_scope = ?) AND (? = '' OR market = ?) AND (? = '' OR locale = ?)
      ORDER BY datetime(created_at) DESC LIMIT ?`)
      .bind(id, clean(filters.scope, 80), clean(filters.scope, 80), clean(filters.market, 80), clean(filters.market, 80), clean(filters.locale, 80), clean(filters.locale, 80), limit).all<Record<string, unknown>>();
    return (rows.results || []).map(mapClaim);
  }
}
