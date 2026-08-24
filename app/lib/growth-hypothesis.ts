import {
  EvidenceAssessmentService,
  type DecisionRiskClass,
  type EvidenceAssessment,
  type EvidenceDecisionContext,
} from "./growth-evidence-assessment.ts";
import type { EvidenceClaim, EvidenceSource } from "./growth-evidence.ts";
import { getTenantConfig } from "./tenant-config-resolver.ts";

export const HYPOTHESIS_STATUSES = ["draft", "needs_evidence", "archived"] as const;
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

export type GrowthHypothesis = {
  hypothesisId: string;
  tenantId: string;
  guildId?: string | null;
  market?: string | null;
  country?: string | null;
  locale?: string | null;
  observation: string;
  hypothesis: string;
  expectedOutcome: string;
  targetMetric: string;
  evidenceIds: string[];
  confidence: number | null;
  evidenceSufficiency: "MODERATE" | "STRONG";
  riskClass: DecisionRiskClass;
  missingEvidence: string[];
  status: HypothesisStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type HypothesisAssessmentResult = {
  created: boolean;
  hypothesis?: GrowthHypothesis;
  assessment: EvidenceAssessment;
  reason?: "insufficient_evidence";
  missingEvidence: string[];
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

function clean(value: unknown, maxLength = 4000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function mapHypothesis(row: Record<string, unknown>): GrowthHypothesis {
  const parse = (value: unknown) => {
    try {
      const parsed = JSON.parse(String(value || "[]"));
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };
  return {
    hypothesisId: String(row.hypothesis_id), tenantId: String(row.tenant_id), guildId: (row.guild_id as string) || null,
    market: (row.market as string) || null, country: (row.country as string) || null, locale: (row.locale as string) || null,
    observation: String(row.observation), hypothesis: String(row.hypothesis), expectedOutcome: String(row.expected_outcome),
    targetMetric: String(row.target_metric), evidenceIds: parse(row.evidence_ids_json),
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    evidenceSufficiency: String(row.evidence_sufficiency) as "MODERATE" | "STRONG", riskClass: String(row.risk_class) as DecisionRiskClass,
    missingEvidence: parse(row.missing_evidence_json), status: String(row.status) as HypothesisStatus,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  };
}

export class HypothesisRepository {
  private readonly db: D1;

  constructor(db: D1) {
    this.db = db;
  }

  async create(input: Omit<GrowthHypothesis, "createdAt" | "updatedAt">) {
    if (!getTenantConfig(input.tenantId)) throw new Error(`Unknown tenant: ${input.tenantId}`);
    await this.db.prepare(`INSERT INTO growth_hypotheses
      (hypothesis_id, tenant_id, guild_id, market, country, locale, observation, hypothesis, expected_outcome, target_metric,
       evidence_ids_json, confidence, evidence_sufficiency, risk_class, missing_evidence_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(input.hypothesisId, input.tenantId, input.guildId || null, input.market || null, input.country || null, input.locale || null,
        clean(input.observation), clean(input.hypothesis), clean(input.expectedOutcome), clean(input.targetMetric), JSON.stringify(input.evidenceIds),
        input.confidence, input.evidenceSufficiency, input.riskClass, JSON.stringify(input.missingEvidence), input.status)
      .run();
    return this.get(input.tenantId, input.hypothesisId);
  }

  async get(tenantId: string, hypothesisId: string) {
    if (!getTenantConfig(tenantId)) throw new Error(`Unknown tenant: ${tenantId}`);
    const row = await this.db.prepare("SELECT * FROM growth_hypotheses WHERE tenant_id = ? AND hypothesis_id = ? LIMIT 1").bind(tenantId, hypothesisId).first<Record<string, unknown>>();
    return row ? mapHypothesis(row) : undefined;
  }

  async list(tenantId: string, options: { market?: string; locale?: string; status?: HypothesisStatus; limit?: number } = {}) {
    if (!getTenantConfig(tenantId)) throw new Error(`Unknown tenant: ${tenantId}`);
    const limit = Math.min(Math.max(Number(options.limit || 50), 1), 100);
    const market = options.market || "";
    const locale = options.locale || "";
    const status = options.status || "";
    const rows = await this.db.prepare(`SELECT * FROM growth_hypotheses
      WHERE tenant_id = ? AND (? = '' OR market = ?) AND (? = '' OR locale = ?) AND (? = '' OR status = ?)
      ORDER BY datetime(created_at) DESC LIMIT ?`)
      .bind(tenantId, market, market, locale, locale, status, status, limit).all<Record<string, unknown>>();
    return (rows.results || []).map(mapHypothesis);
  }
}

export class GrowthHypothesisService {
  private readonly repository: HypothesisRepository;
  private readonly assessmentService: EvidenceAssessmentService;

  constructor(repository: HypothesisRepository, assessmentService = new EvidenceAssessmentService()) {
    this.repository = repository;
    this.assessmentService = assessmentService;
  }

  async createDraft(input: {
    hypothesisId: string;
    observation: string;
    hypothesis: string;
    expectedOutcome: string;
    targetMetric: string;
    sources: readonly EvidenceSource[];
    claims: readonly EvidenceClaim[];
    context: EvidenceDecisionContext;
    riskClass: DecisionRiskClass;
  }): Promise<HypothesisAssessmentResult> {
    const assessment = this.assessmentService.assess({ sources: input.sources, claims: input.claims, context: input.context, riskClass: input.riskClass });
    if (assessment.sufficiency === "INSUFFICIENT" || assessment.sufficiency === "WEAK") {
      return { created: false, assessment, reason: "insufficient_evidence", missingEvidence: assessment.missingEvidence };
    }
    const hypothesis: Omit<GrowthHypothesis, "createdAt" | "updatedAt"> = {
      hypothesisId: input.hypothesisId, tenantId: input.context.tenantId, guildId: input.context.guildId || null,
      market: input.context.market || null, country: input.context.country || null, locale: input.context.locale || null,
      observation: clean(input.observation), hypothesis: clean(input.hypothesis), expectedOutcome: clean(input.expectedOutcome), targetMetric: clean(input.targetMetric),
      evidenceIds: [...new Set(input.claims.map((claim) => claim.claimId))], confidence: assessment.sufficiency === "MODERATE" ? Math.min(60, assessment.sufficiencyScore) : Math.min(85, assessment.sufficiencyScore),
      evidenceSufficiency: assessment.sufficiency, riskClass: input.riskClass, missingEvidence: assessment.missingEvidence, status: "draft",
    };
    return { created: true, hypothesis: await this.repository.create(hypothesis), assessment, missingEvidence: assessment.missingEvidence };
  }
}
