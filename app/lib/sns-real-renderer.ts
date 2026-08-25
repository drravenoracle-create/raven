type ArtifactBucket = { put(key: string, value: ArrayBuffer, options?: Record<string, unknown>): Promise<unknown> };
type RendererEnv = Record<string, unknown> & { MEDIA_BUCKET?: ArtifactBucket };
export type RealRenderResult = { rendererJobId: string; bytes: ArrayBuffer; width: number; height: number; duration: number; videoCodec: string; audioCodec: string; contentType: string; provider: "real_http" };
const clean = (value: unknown, max = 1000) => String(value ?? "").trim().slice(0, max);
export function configuredRealRendererUrl(runtime: RendererEnv) {
  const value = clean(runtime.SNS_REAL_RENDERER_URL); if (!value) return "";
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("REAL_RENDERER_URL must use HTTPS or localhost.");
  if (url.hostname.endsWith("run.app")) throw new Error("Production Cloud Run Renderer is not eligible for this non-production integration check.");
  return value.replace(/\/+$/, "");
}
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); } }
function assertMp4(bytes: ArrayBuffer) { if (bytes.byteLength <= 32) throw new Error("REAL_RENDERER_INVALID_ARTIFACT: empty MP4 artifact."); const header = new TextDecoder().decode(bytes.slice(4, 12)); if (!header.includes("ftyp")) throw new Error("REAL_RENDERER_INVALID_ARTIFACT: response is not an MP4."); }
export async function renderWithRealProvider(runtime: RendererEnv, jobId: string, payload: Record<string, unknown>): Promise<RealRenderResult> {
  const base = configuredRealRendererUrl(runtime); if (!base) throw new Error("REAL_RENDERER_UNAVAILABLE: SNS_REAL_RENDERER_URL is not configured."); const token = clean(runtime.SNS_REAL_RENDERER_TOKEN, 500);
  const response = await fetchWithTimeout(`${base}/jobs`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jobId, payload }) }, 30_000);
  const body = await response.json().catch(() => ({})) as { rendererJobId?: string; outputUrl?: string; artifactUrl?: string; width?: number; height?: number; duration?: number; videoCodec?: string; audioCodec?: string; error?: string };
  if (!response.ok) throw new Error(`REAL_RENDERER_HTTP_${response.status}: ${clean(body.error, 240) || "renderer request failed."}`);
  const artifactUrl = clean(body.artifactUrl || body.outputUrl); if (!artifactUrl) throw new Error("REAL_RENDERER_INVALID_RESPONSE: artifact URL is missing."); const parsed = new URL(artifactUrl, base); if (parsed.origin !== new URL(base).origin) throw new Error("REAL_RENDERER_SSRF_BLOCKED: artifact origin is not the configured renderer.");
  const artifactResponse = await fetchWithTimeout(parsed.toString(), { headers: token ? { Authorization: `Bearer ${token}` } : {} }, 30_000); if (!artifactResponse.ok) throw new Error(`REAL_RENDERER_ARTIFACT_${artifactResponse.status}: artifact fetch failed.`); const bytes = await artifactResponse.arrayBuffer(); assertMp4(bytes);
  return { rendererJobId: clean(body.rendererJobId || jobId, 200), bytes, width: Number(body.width || 1080), height: Number(body.height || 1920), duration: Number(body.duration || 0), videoCodec: clean(body.videoCodec || "h264", 40), audioCodec: clean(body.audioCodec || "aac", 40), contentType: "video/mp4", provider: "real_http" };
}
export async function storeRealArtifact(runtime: RendererEnv, tenantId: string, draftId: string, draftVersion: number, jobId: string, artifact: RealRenderResult) {
  const bucket = runtime.MEDIA_BUCKET; if (!bucket) throw new Error("ARTIFACT_STORAGE_UNAVAILABLE: MEDIA_BUCKET is not configured."); const digest = await crypto.subtle.digest("SHA-256", artifact.bytes); const checksum = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""); const key = `sns-render-artifacts/${tenantId}/${draftId}/v${draftVersion}/${jobId}.mp4`;
  await bucket.put(key, artifact.bytes, { httpMetadata: { contentType: artifact.contentType }, customMetadata: { tenant_id: tenantId, draft_id: draftId, draft_version: String(draftVersion), render_job_id: jobId, checksum, size_bytes: String(artifact.bytes.byteLength) } }); return { key, checksum, sizeBytes: artifact.bytes.byteLength };
}
