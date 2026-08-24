import { GrowthMemoryRepository, type GrowthMemoryItem } from "./growth-memory.ts";
import { getTenantConfig } from "./tenant-config-resolver.ts";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }>; first<T = unknown>(): Promise<T | null>; run(): Promise<unknown> } } };
function tenantId(value: string) { const id = String(value || "").trim(); if (!id || !getTenantConfig(id)) throw new Error(`Unknown tenant: ${id || "missing"}`); return id; }
function n(value: unknown) { const x = Number(value); return Number.isFinite(x) ? x : null; }
export type CalibrationBucket = { range: string; midpoint: number; sampleSize: number; observedSuccessRate: number | null; calibrationError: number | null; reliable: boolean; reliability: string };
export type GrowthPrecisionReport = { tenantId: string; sampleSize: number; proposalAcceptanceRate: number | null; experimentSuccessRate: number | null; meanAbsoluteError: number | null; meanRelativeError: number | null; directionAccuracy: number | null; repeatedFailureCount: number; reuseCount: number; suppressedCount: number; calibration: CalibrationBucket[] };

export class GrowthPrecisionService {
  private readonly db: D1;
  private readonly memories: GrowthMemoryRepository;
  constructor(db: D1, memories = new GrowthMemoryRepository(db)) { this.db = db; this.memories = memories; }
  async buildReport(tenant: string, options: { market?: string; locale?: string; actionSignature?: string } = {}): Promise<GrowthPrecisionReport> {
    const t = tenantId(tenant); const memories = await this.memories.list(t, { limit: 100, market: options.market, locale: options.locale, actionSignature: options.actionSignature });
    const experimentRows = await this.db.prepare("SELECT status, result_status FROM growth_experiments WHERE tenant_id = ?").bind(t).all<{ status: string; result_status: string }>();
    const proposalRows = await this.db.prepare("SELECT status FROM growth_proposals WHERE tenant_id = ?").bind(t).all<{ status: string }>();
    const reviewed = (proposalRows.results || []).filter((x) => ["approved", "rejected", "deferred"].includes(x.status)); const approved = reviewed.filter((x) => x.status === "approved").length;
    const completed = (experimentRows.results || []).filter((x) => ["WIN", "LOSS", "NEUTRAL", "INCONCLUSIVE"].includes(x.result_status)); const wins = completed.filter((x) => x.result_status === "WIN").length;
    const errors = memories.map((x) => n(x.absoluteError)).filter((x): x is number => x !== null); const relative = memories.map((x) => n(x.relativeError)).filter((x): x is number => x !== null); const directional = memories.filter((x) => x.directionCorrect !== null); const signatures = new Map<string, number>(); memories.filter((x) => x.successLevel === "failure" && x.actionSignature).forEach((x) => signatures.set(x.actionSignature as string, (signatures.get(x.actionSignature as string) || 0) + 1));
    const buckets: CalibrationBucket[] = [[0, 20], [21, 40], [41, 60], [61, 80], [81, 100]].map(([lo, hi]) => { const rows = memories.filter((x) => x.confidenceAtProposal !== null && Number(x.confidenceAtProposal) >= lo && Number(x.confidenceAtProposal) <= hi && ["success", "failure"].includes(x.successLevel)); const success = rows.filter((x) => x.successLevel === "success").length; const observed = rows.length ? success / rows.length : null; const midpoint = (lo + hi) / 2 / 100; return { range: `${lo}-${hi}`, midpoint, sampleSize: rows.length, observedSuccessRate: observed, calibrationError: observed === null ? null : Math.abs(observed - midpoint), reliable: rows.length >= 5, reliability: rows.length >= 5 ? "reliable" : "calibration_unreliable_small_sample" }; });
    return { tenantId: t, sampleSize: memories.length, proposalAcceptanceRate: reviewed.length ? approved / reviewed.length : null, experimentSuccessRate: completed.length ? wins / completed.length : null, meanAbsoluteError: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null, meanRelativeError: relative.length ? relative.reduce((a, b) => a + b, 0) / relative.length : null, directionAccuracy: directional.length ? directional.filter((x) => x.directionCorrect).length / directional.length : null, repeatedFailureCount: [...signatures.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0), reuseCount: memories.reduce((sum, x) => sum + x.reuseCount, 0), suppressedCount: memories.filter((x) => x.suppressed).length, calibration: buckets };
  }
  async createSnapshot(tenant: string, options: { market?: string; locale?: string; actionSignature?: string; actor?: string } = {}) { const report = await this.buildReport(tenant, options); await this.memories.createSnapshot(tenant, report, options.actor); return report; }
}
