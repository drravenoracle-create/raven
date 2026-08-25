import { GROWTH_ENGINE_TENANT_ID } from "./growth-engine.ts";
import { getContentDraft } from "./sns-content-draft.ts";
import { buildDraftPreview } from "./sns-draft-preview.ts";
import { renderWithRealProvider, storeRealArtifact } from "./sns-real-renderer.ts";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }>; first<T = unknown>(): Promise<T | null>; run(): Promise<unknown> } } };
type RenderRow = Record<string, unknown> & { render_job_id: string; tenant_id: string; draft_id: string; draft_version: number; render_revision: number; status: string };
const PROFILES = { instagram: { width: 1080, height: 1920, videoCodec: "h264", audioCodec: "aac", fps: 30, bitrate: "8Mbps" }, tiktok: { width: 1080, height: 1920, videoCodec: "h264", audioCodec: "aac", fps: 30, bitrate: "8Mbps" }, youtube: { width: 1080, height: 1920, videoCodec: "h264", audioCodec: "aac", fps: 30, bitrate: "8Mbps" } } as const;
const json = (value: unknown) => JSON.stringify(value ?? {});
const toHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

function rowToJob(row: RenderRow) { return { renderJobId: row.render_job_id, tenant: row.tenant_id, draftId: row.draft_id, draftVersion: row.draft_version, renderRevision: row.render_revision, platform: row.platform, locale: row.locale, rendererProvider: row.renderer_provider, status: row.status, startedAt: row.started_at, completedAt: row.completed_at, errorCode: row.error_code, error: row.error_message, artifact: row.artifact_id ? { artifactId: row.artifact_id, fileReference: row.file_reference, storageKey: row.storage_key, width: row.width, height: row.height, duration: row.duration, videoCodec: row.video_codec, audioCodec: row.audio_codec, fileSize: row.file_size, checksum: row.checksum, mimeType: "video/mp4", testOnly: row.renderer_provider === "mock" } : null }; }

export async function listDraftRenderJobs(db: D1, draftId: string, tenantId = GROWTH_ENGINE_TENANT_ID) { const result = await db.prepare("SELECT * FROM sns_draft_render_jobs WHERE tenant_id = ? AND draft_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(tenantId, draftId).all<RenderRow>(); return (result.results || []).map(rowToJob); }

export async function renderDraftToMp4(db: D1, draftId: string, input: { platform?: string; rerender?: boolean } = {}, tenantId = GROWTH_ENGINE_TENANT_ID, runtime?: Record<string, unknown>) {
  const draft = await getContentDraft(db, draftId, tenantId);
  if (!draft) throw new Error("Draft not found for this tenant.");
  const platform = String(input.platform || draft.scope?.platform || "instagram").toLowerCase();
  const profile = PROFILES[platform as keyof typeof PROFILES];
  if (!profile) throw new Error("RENDERER_UNAVAILABLE: unsupported platform profile.");
  const preview = buildDraftPreview(draft as never, platform);
  if (preview.warnings.length) throw new Error(`VALIDATION_FAILED: ${preview.warnings.map((warning) => warning.code).join(",")}`);
  const latest = await db.prepare("SELECT * FROM sns_draft_render_jobs WHERE tenant_id = ? AND draft_id = ? AND draft_version = ? AND platform = ? ORDER BY render_revision DESC LIMIT 1").bind(tenantId, draftId, draft.version, platform).first<RenderRow>();
  if (latest && !input.rerender) return { ...rowToJob(latest), duplicate: true };
  const revision = (latest?.render_revision || 0) + 1;
  const provider = runtime && String(runtime.SNS_REAL_RENDERER_URL || "").trim() ? "real_http" : "mock";
  const jobId = crypto.randomUUID(); const artifactId = crypto.randomUUID(); const payload = { draftId, draftVersion: draft.version, platform, locale: draft.scope?.locale, profile, previewContract: preview, provider };
  await db.prepare("INSERT INTO sns_draft_render_jobs (render_job_id, tenant_id, draft_id, draft_version, render_revision, platform, locale, renderer_provider, status, started_at, request_json, attempt_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RENDERING', CURRENT_TIMESTAMP, ?, 1)").bind(jobId, tenantId, draftId, draft.version, revision, platform, String(draft.scope?.locale || "ja"), provider, json(payload)).run();
  if (provider === "real_http") {
    try {
      const artifact = await renderWithRealProvider(runtime || {}, jobId, payload); const stored = await storeRealArtifact(runtime || {}, tenantId, draftId, draft.version, jobId, artifact); const fileReference = `/api/sns/drafts/${encodeURIComponent(draftId)}/render/artifact?jobId=${encodeURIComponent(jobId)}`;
      await db.prepare("UPDATE sns_draft_render_jobs SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, artifact_id = ?, file_reference = ?, storage_key = ?, width = ?, height = ?, duration = ?, video_codec = ?, audio_codec = ?, file_size = ?, checksum = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND render_job_id = ?").bind(artifactId, fileReference, stored.key, artifact.width, artifact.height, artifact.duration || Number(draft.recommendedDuration), artifact.videoCodec, artifact.audioCodec, stored.sizeBytes, stored.checksum, tenantId, jobId).run();
    } catch (error) { await db.prepare("UPDATE sns_draft_render_jobs SET status = 'FAILED', error_code = 'real_renderer_failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND render_job_id = ?").bind(error instanceof Error ? error.message : "Real renderer failed.", tenantId, jobId).run(); }
  } else {
    const checksum = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json(payload)))); const fileReference = `mock://sns-render-artifacts/${artifactId}.mp4`;
    await db.prepare("UPDATE sns_draft_render_jobs SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, artifact_id = ?, file_reference = ?, width = ?, height = ?, duration = ?, video_codec = ?, audio_codec = ?, file_size = NULL, checksum = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND render_job_id = ?").bind(artifactId, fileReference, profile.width, profile.height, Number(draft.recommendedDuration), profile.videoCodec, profile.audioCodec, checksum, tenantId, jobId).run();
  }
  const row = await db.prepare("SELECT * FROM sns_draft_render_jobs WHERE tenant_id = ? AND render_job_id = ? LIMIT 1").bind(tenantId, jobId).first<RenderRow>();
  if (!row) throw new Error("Render Job was not persisted.");
  return rowToJob(row);
}
