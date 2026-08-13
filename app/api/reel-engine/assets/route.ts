import { env } from "cloudflare:workers";
import { REEL_ENGINE_TENANT_ID } from "@/app/lib/reel-engine";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
]);

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function bucket() {
  return (env as any).MEDIA_BUCKET as {
    put(key: string, value: ArrayBuffer | Blob | ReadableStream, options?: Record<string, unknown>): Promise<unknown>;
    get(key: string): Promise<{ body: ReadableStream; size?: number; httpMetadata?: { contentType?: string } } | null>;
    delete(key: string): Promise<void>;
  } | undefined;
}

function extFromMime(mimeType: string) {
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/wav") return "wav";
  return "bin";
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const mediaBucket = bucket();
  if (!mediaBucket) return Response.json({ error: "R2 MEDIA_BUCKET is not configured. Enable R2 and add the binding before uploading assets." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid form data." }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "file is required." }, { status: 400 });
  if (!allowedMimeTypes.has(file.type)) return Response.json({ error: `Unsupported MIME type: ${file.type || "unknown"}` }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "File must be between 1 byte and 100 MB." }, { status: 413 });

  const assetId = crypto.randomUUID();
  const source = clean(form.get("source"), 40) || "uploaded";
  const category = clean(form.get("category"), 120) || "uploaded";
  const mood = clean(form.get("mood"), 120) || "neutral";
  const licenseType = clean(form.get("license_type") ?? form.get("licenseType"), 120) || "owned";
  const duration = Number(form.get("duration") || 0);
  const width = Number(form.get("width") || 0);
  const height = Number(form.get("height") || 0);
  const tags = clean(form.get("tags"), 500).split(",").map((tag) => tag.trim()).filter(Boolean);
  const buffer = await file.arrayBuffer();
  const checksum = await sha256Hex(buffer);
  const storageKey = `reel-assets/${REEL_ENGINE_TENANT_ID}/${assetId}.${extFromMime(file.type)}`;

  await mediaBucket.put(storageKey, buffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      tenant_id: REEL_ENGINE_TENANT_ID,
      asset_id: assetId,
      original_name: file.name.slice(0, 240),
      checksum,
    },
  });

  await env.DB.prepare(
    `INSERT INTO media_video_assets
      (asset_id, tenant_id, source, storage_key, duration, width, height, tags_json, category, mood, license_type, mime_type, size_bytes, checksum, performance_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(assetId, REEL_ENGINE_TENANT_ID, source, storageKey, duration || 0, width || 0, height || 0, JSON.stringify(tags), category, mood, licenseType, file.type, file.size, checksum, 0)
    .run();

  await env.DB.prepare("INSERT INTO reel_engine_audit_logs (id, tenant_id, action, detail_json) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), REEL_ENGINE_TENANT_ID, "asset.uploaded", JSON.stringify({ assetId, storageKey, size: file.size, mimeType: file.type }))
    .run();

  return Response.json({ ok: true, assetId, storageKey, mimeType: file.type, sizeBytes: file.size, checksum }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const mediaBucket = bucket();
  if (!mediaBucket) return Response.json({ error: "R2 MEDIA_BUCKET is not configured." }, { status: 503 });
  const url = new URL(request.url);
  const assetId = clean(url.searchParams.get("assetId"), 120);
  if (!assetId) return Response.json({ error: "assetId is required." }, { status: 400 });
  const asset = await env.DB.prepare("SELECT storage_key, mime_type FROM media_video_assets WHERE tenant_id = ? AND asset_id = ? AND deleted_at IS NULL LIMIT 1")
    .bind(REEL_ENGINE_TENANT_ID, assetId)
    .first<{ storage_key: string; mime_type: string }>();
  if (!asset) return Response.json({ error: "Asset not found." }, { status: 404 });
  const object = await mediaBucket.get(asset.storage_key);
  if (!object) return Response.json({ error: "R2 object not found." }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || asset.mime_type || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      ...(object.size ? { "Content-Length": String(object.size) } : {}),
    },
  });
}

export async function DELETE(request: Request) {
  const mediaBucket = bucket();
  if (!mediaBucket) return Response.json({ error: "R2 MEDIA_BUCKET is not configured." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const assetId = clean(body?.asset_id ?? body?.assetId, 120);
  if (!assetId) return Response.json({ error: "asset_id is required." }, { status: 400 });
  const asset = await env.DB.prepare("SELECT storage_key, source FROM media_video_assets WHERE tenant_id = ? AND asset_id = ? AND deleted_at IS NULL LIMIT 1")
    .bind(REEL_ENGINE_TENANT_ID, assetId)
    .first<{ storage_key: string; source: string }>();
  if (!asset) return Response.json({ error: "Asset not found." }, { status: 404 });
  if (asset.source !== "uploaded") return Response.json({ error: "Only uploaded assets can be deleted from this screen." }, { status: 409 });

  await mediaBucket.delete(asset.storage_key);
  await env.DB.prepare("UPDATE media_video_assets SET deleted_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND asset_id = ?")
    .bind(REEL_ENGINE_TENANT_ID, assetId)
    .run();
  await env.DB.prepare("INSERT INTO reel_engine_audit_logs (id, tenant_id, action, detail_json) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), REEL_ENGINE_TENANT_ID, "asset.deleted", JSON.stringify({ assetId, storageKey: asset.storage_key }))
    .run();
  return Response.json({ ok: true, assetId }, { headers: { "Cache-Control": "no-store" } });
}
