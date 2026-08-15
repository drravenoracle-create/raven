import { CARD_LIBRARY_TENANT_ID, createCard, getDeck } from "@/app/lib/card-library";

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const MAX_DRIVE_IMAGE_BYTES = 25 * 1024 * 1024;

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

type RuntimeEnv = Record<string, unknown>;

type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

type MediaBucket = {
  put(key: string, value: ArrayBuffer | Blob | ReadableStream, options?: Record<string, unknown>): Promise<unknown>;
};

export type DriveImageFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailUrl: string;
  webViewLink: string;
  card_number: number;
  card_name: string;
};

export type DriveImportCandidate = {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  card_number: number;
  name: string;
  name_ja?: string;
};

export type DriveImportResult = {
  fileId: string;
  fileName: string;
  status: "imported" | "skipped" | "failed" | "replaced";
  cardId?: string;
  assetId?: string;
  storageKey?: string;
  error?: string;
};

function envValue(env: unknown, name: string) {
  return String((env as RuntimeEnv)?.[name] || "").trim();
}

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function base64Url(input: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizePrivateKey(raw: string) {
  let value = raw.trim();
  if (value.startsWith("{") && value.includes("private_key")) {
    try {
      value = (JSON.parse(value) as { private_key?: string }).private_key || value;
    } catch {}
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  value = value.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const match = value.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
  if (match) value = match[0];
  const base64 = value.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  if (!base64 || base64.length % 4 === 1) throw new Error("Invalid private key base64 content.");
  return base64;
}

function pemToArrayBuffer(pem: string) {
  const binary = atob(normalizePrivateKey(pem));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function googleAccessToken(env: unknown) {
  const directToken = envValue(env, "GOOGLE_DRIVE_ACCESS_TOKEN");
  if (directToken) return directToken;

  const clientEmail = envValue(env, "GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = envValue(env, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!clientEmail || !privateKey) throw new Error("Google Drive service account is not configured.");

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: clientEmail,
    scope: DRIVE_READONLY_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64Url(signature)}` }),
  });
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || `google_token_${response.status}`);
  return payload.access_token;
}

async function driveFetch(env: unknown, path: string, init?: RequestInit) {
  const token = await googleAccessToken(env);
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(payload.error?.message || `drive_${response.status}`);
  }
  return response;
}

function driveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function extFromMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "bin";
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function detectImageMime(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return "";
}

export function parseCardFilename(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const match = stem.match(/^\s*0*(\d{1,3})(?:[\s_-]+(.+))?$/);
  if (!match) return { card_number: 0, card_name: "" };
  const cardName = clean((match[2] || "").replace(/[_-]+/g, " "), 180).toLowerCase();
  return { card_number: Number(match[1]) || 0, card_name: cardName };
}

export async function listDriveFolders(env: unknown, input: { q?: string }) {
  const q = clean(input.q, 120);
  const filter = [`mimeType = 'application/vnd.google-apps.folder'`, "trashed = false"];
  if (q) filter.push(`name contains '${driveQuery(q)}'`);
  const params = new URLSearchParams({
    q: filter.join(" and "),
    pageSize: "50",
    fields: "files(id,name,webViewLink,modifiedTime)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    orderBy: "modifiedTime desc",
  });
  const response = await driveFetch(env, `files?${params.toString()}`);
  const payload = (await response.json()) as { files?: Array<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }> };
  return payload.files || [];
}

export async function listDriveImages(env: unknown, input: { folderId: string }) {
  const folderId = clean(input.folderId, 160);
  if (!folderId) throw new Error("folderId is required.");
  const params = new URLSearchParams({
    q: `'${driveQuery(folderId)}' in parents and trashed = false and (mimeType = 'image/png' or mimeType = 'image/jpeg' or mimeType = 'image/webp')`,
    pageSize: "100",
    fields: "files(id,name,mimeType,size,thumbnailLink,webViewLink)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    orderBy: "name",
  });
  const response = await driveFetch(env, `files?${params.toString()}`);
  const payload = (await response.json()) as { files?: Array<{ id: string; name: string; mimeType: string; size?: string; thumbnailLink?: string; webViewLink?: string }> };
  return (payload.files || []).map<DriveImageFile>((file) => {
    const parsed = parseCardFilename(file.name);
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: Number(file.size || 0),
      thumbnailUrl: file.thumbnailLink || `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w320`,
      webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      card_number: parsed.card_number,
      card_name: parsed.card_name,
    };
  });
}

async function getDriveImageMetadata(env: unknown, fileId: string) {
  const params = new URLSearchParams({ fields: "id,name,mimeType,size,webViewLink", supportsAllDrives: "true" });
  const response = await driveFetch(env, `files/${encodeURIComponent(fileId)}?${params.toString()}`);
  return (await response.json()) as { id: string; name: string; mimeType: string; size?: string; webViewLink?: string };
}

async function downloadDriveImage(env: unknown, fileId: string) {
  const response = await driveFetch(env, `files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`);
  return response.arrayBuffer();
}

export function validateImportCandidate(candidate: DriveImportCandidate) {
  const errors: string[] = [];
  if (!candidate.fileId) errors.push("file_id_required");
  if (!allowedImageTypes.has(candidate.mimeType)) errors.push("unsupported_mime");
  if (candidate.sizeBytes < 0 || candidate.sizeBytes > MAX_DRIVE_IMAGE_BYTES) errors.push("file_too_large");
  if (!candidate.card_number || candidate.card_number < 1 || candidate.card_number > 999) errors.push("invalid_card_number");
  if (!clean(candidate.name, 180)) errors.push("card_name_required");
  return { valid: errors.length === 0, errors };
}

export async function bulkImportDriveImages(db: D1, env: unknown, input: { deckId: string; folderId?: string; folderName?: string; duplicatePolicy?: string; files: DriveImportCandidate[]; tenantId?: string }) {
  const tenantId = clean(input.tenantId, 80) || CARD_LIBRARY_TENANT_ID;
  if (tenantId !== CARD_LIBRARY_TENANT_ID) throw new Error("Invalid tenant_id.");
  const deckId = clean(input.deckId, 120);
  if (!deckId) throw new Error("deck_id is required.");
  const deck = await getDeck(db, deckId, tenantId);
  if (!deck) throw new Error("Deck not found.");

  const bucket = (env as RuntimeEnv).MEDIA_BUCKET as MediaBucket | undefined;
  if (!bucket) throw new Error("R2 MEDIA_BUCKET is not configured. Drive images cannot be copied to operation storage yet.");

  const duplicatePolicy = clean(input.duplicatePolicy, 40) || "skip";
  if (!["skip", "replace", "create_new"].includes(duplicatePolicy)) throw new Error("Invalid duplicate_policy.");
  const files = (input.files || []).slice(0, 20);
  if (!files.length) throw new Error("No import candidates.");

  const jobId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO card_drive_import_jobs
      (id, tenant_id, deck_id, source_folder_id, source_folder_name, status, duplicate_policy, total_count)
      VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`,
  )
    .bind(jobId, tenantId, deckId, clean(input.folderId, 200), clean(input.folderName, 240), duplicatePolicy, files.length)
    .run();

  const results: DriveImportResult[] = [];
  for (const candidate of files) {
    const itemId = crypto.randomUUID();
    try {
      const safeCandidate = {
        ...candidate,
        fileId: clean(candidate.fileId, 200),
        fileName: clean(candidate.fileName, 240),
        mimeType: clean(candidate.mimeType, 80),
        sizeBytes: Number(candidate.sizeBytes || 0),
        card_number: Number(candidate.card_number || 0),
        name: clean(candidate.name, 180),
        name_ja: clean(candidate.name_ja, 180),
      };
      const validation = validateImportCandidate(safeCandidate);
      if (!validation.valid) throw new Error(validation.errors.join(", "));

      const previousImport = await db.prepare("SELECT card_id FROM card_drive_import_items WHERE tenant_id = ? AND deck_id = ? AND drive_file_id = ? AND status IN ('imported','replaced') LIMIT 1")
        .bind(tenantId, deckId, safeCandidate.fileId)
        .first<{ card_id?: string }>();
      if (previousImport && duplicatePolicy === "skip") {
        results.push({ fileId: safeCandidate.fileId, fileName: safeCandidate.fileName, status: "skipped", cardId: previousImport.card_id, error: "same_drive_file_already_imported" });
        await insertImportItem(db, itemId, tenantId, jobId, deckId, safeCandidate, "skipped", "", "", previousImport.card_id || "", "same_drive_file_already_imported");
        continue;
      }

      const existingNumber = await db.prepare("SELECT id FROM card_library_cards WHERE tenant_id = ? AND deck_id = ? AND card_number = ? LIMIT 1")
        .bind(tenantId, deckId, safeCandidate.card_number)
        .first<{ id: string }>();
      if (existingNumber && duplicatePolicy === "skip") {
        results.push({ fileId: safeCandidate.fileId, fileName: safeCandidate.fileName, status: "skipped", cardId: existingNumber.id, error: "card_number_already_exists" });
        await insertImportItem(db, itemId, tenantId, jobId, deckId, safeCandidate, "skipped", "", "", existingNumber.id, "card_number_already_exists");
        continue;
      }

      const metadata = await getDriveImageMetadata(env, safeCandidate.fileId);
      if (!allowedImageTypes.has(metadata.mimeType) || metadata.mimeType !== safeCandidate.mimeType) throw new Error("Drive metadata MIME does not match an allowed image type.");
      const declaredSize = Number(metadata.size || safeCandidate.sizeBytes || 0);
      if (declaredSize <= 0 || declaredSize > MAX_DRIVE_IMAGE_BYTES) throw new Error("Drive image size is outside the allowed range.");

      const buffer = await downloadDriveImage(env, safeCandidate.fileId);
      if (buffer.byteLength <= 0 || buffer.byteLength > MAX_DRIVE_IMAGE_BYTES) throw new Error("Downloaded image size is outside the allowed range.");
      const actualMime = detectImageMime(buffer);
      if (!allowedImageTypes.has(actualMime) || actualMime !== metadata.mimeType) throw new Error("Downloaded file MIME validation failed.");

      const checksum = await sha256Hex(buffer);
      const assetId = crypto.randomUUID();
      const storageKey = `card-library/${tenantId}/${deckId}/${safeCandidate.fileId}-${checksum.slice(0, 16)}.${extFromMime(actualMime)}`;
      await bucket.put(storageKey, buffer, {
        httpMetadata: { contentType: actualMime },
        customMetadata: { tenant_id: tenantId, deck_id: deckId, source_provider: "google_drive", source_file_id: safeCandidate.fileId, checksum },
      });
      await db.prepare(
        `INSERT INTO media_video_assets
          (asset_id, tenant_id, source, storage_key, duration, width, height, tags_json, category, mood, license_type, mime_type, size_bytes, checksum, performance_score)
          VALUES (?, ?, 'google_drive', ?, 0, 0, 0, ?, 'card-library', 'deck-card', 'owned', ?, ?, ?, 0)`,
      )
        .bind(assetId, tenantId, storageKey, JSON.stringify(["card-library", "google-drive", deckId]), actualMime, buffer.byteLength, checksum)
        .run();

      const imageUrl = `/api/reel-engine/assets?assetId=${encodeURIComponent(assetId)}`;
      let cardId = existingNumber?.id || "";
      let status: DriveImportResult["status"] = "imported";
      if (existingNumber && duplicatePolicy === "replace") {
        await db.prepare(
          "UPDATE card_library_cards SET card_number = ?, name = ?, name_ja = ?, image_url = ?, storage_provider = 'r2', storage_key = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?",
        )
          .bind(safeCandidate.card_number, safeCandidate.name, safeCandidate.name_ja || safeCandidate.name, imageUrl, storageKey, safeCandidate.card_number * 10, tenantId, existingNumber.id)
          .run();
        status = "replaced";
      } else {
        const card = await createCard(db, {
          deck_id: deckId,
          card_number: safeCandidate.card_number,
          name: safeCandidate.name,
          name_ja: safeCandidate.name_ja || safeCandidate.name,
          image_url: imageUrl,
          storage_provider: "r2",
          storage_key: storageKey,
          upright_meaning: "",
          reversed_meaning: "",
          sns_summary: "",
          keywords: ["google-drive"],
          tags: ["imported", "card-library"],
          sns_use_allowed: true,
          enabled: true,
          sort_order: safeCandidate.card_number * 10,
        }, tenantId);
        cardId = card?.id || "";
      }
      await insertImportItem(db, itemId, tenantId, jobId, deckId, safeCandidate, status, storageKey, assetId, cardId, "");
      results.push({ fileId: safeCandidate.fileId, fileName: safeCandidate.fileName, status, cardId, assetId, storageKey });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      const fallback = {
        fileId: clean(candidate.fileId, 200),
        fileName: clean(candidate.fileName, 240),
        mimeType: clean(candidate.mimeType, 80),
        sizeBytes: Number(candidate.sizeBytes || 0),
        card_number: Number(candidate.card_number || 0),
        name: clean(candidate.name, 180),
      };
      await insertImportItem(db, itemId, tenantId, jobId, deckId, fallback, "failed", "", "", "", message);
      results.push({ fileId: fallback.fileId, fileName: fallback.fileName, status: "failed", error: message });
    }
  }

  const success = results.filter((item) => item.status === "imported" || item.status === "replaced").length;
  const skipped = results.filter((item) => item.status === "skipped").length;
  const failed = results.filter((item) => item.status === "failed").length;
  await db.prepare(
    "UPDATE card_drive_import_jobs SET status = ?, success_count = ?, skipped_count = ?, failed_count = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?",
  )
    .bind(failed ? "partial_failed" : "completed", success, skipped, failed, tenantId, jobId)
    .run();
  return { jobId, total: files.length, success, skipped, failed, results };
}

async function insertImportItem(db: D1, itemId: string, tenantId: string, jobId: string, deckId: string, candidate: DriveImportCandidate, status: string, storageKey: string, assetId: string, cardId: string, errorMessage: string) {
  await db.prepare(
    `INSERT INTO card_drive_import_items
      (id, tenant_id, job_id, deck_id, drive_file_id, drive_file_name, mime_type, size_bytes, card_number, card_name, status, storage_key, asset_id, card_id, error_message, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IN ('imported','replaced') THEN CURRENT_TIMESTAMP ELSE NULL END)`,
  )
    .bind(itemId, tenantId, jobId, deckId, candidate.fileId, candidate.fileName, candidate.mimeType, candidate.sizeBytes, candidate.card_number, candidate.name, status, storageKey, assetId, cardId, errorMessage, status)
    .run();
}

export async function listDriveImportJobs(db: D1, tenantId = CARD_LIBRARY_TENANT_ID) {
  const result = await db.prepare("SELECT * FROM card_drive_import_jobs WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(tenantId).all();
  return result.results || [];
}
