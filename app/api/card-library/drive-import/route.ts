import { env } from "cloudflare:workers";
import { adminEmail, getAdminSession } from "@/app/lib/google-admin-auth";
import { CARD_LIBRARY_TENANT_ID } from "@/app/lib/card-library";
import {
  bulkImportDriveImages,
  listDriveFolders,
  listDriveImages,
  listDriveImportJobs,
  parseCardFilename,
  validateImportCandidate,
  type DriveImportCandidate,
} from "@/app/lib/drive-import";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

async function requireApiAdmin() {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) {
    return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  }
  return null;
}

function assertTenant(value: unknown) {
  const tenantId = clean(value, 80) || CARD_LIBRARY_TENANT_ID;
  if (tenantId !== CARD_LIBRARY_TENANT_ID) throw new Error("Invalid tenant_id.");
  return tenantId;
}

export async function GET(request: Request) {
  const denied = await requireApiAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  let tenantId = CARD_LIBRARY_TENANT_ID;
  try {
    tenantId = assertTenant(url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id"));
  } catch {
    return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 });
  }

  const resource = clean(url.searchParams.get("resource"), 40) || "jobs";
  try {
    if (resource === "folders") {
      const folders = await listDriveFolders(env, { q: clean(url.searchParams.get("q"), 120) });
      return Response.json({ ok: true, folders }, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "images") {
      const images = await listDriveImages(env, { folderId: clean(url.searchParams.get("folderId") ?? url.searchParams.get("folder_id"), 160) });
      return Response.json({ ok: true, images }, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "parse") {
      return Response.json({ ok: true, parsed: parseCardFilename(clean(url.searchParams.get("fileName") ?? url.searchParams.get("file_name"), 240)) });
    }
    return Response.json({ ok: true, jobs: await listDriveImportJobs(env.DB, tenantId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Drive import API failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireApiAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });

  let tenantId = CARD_LIBRARY_TENANT_ID;
  try {
    tenantId = assertTenant(body.tenant_id ?? body.tenantId);
  } catch {
    return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 });
  }

  try {
    const action = clean(body.action, 40);
    if (action === "validate") {
      const files = Array.isArray(body.files) ? (body.files as DriveImportCandidate[]) : [];
      return Response.json({
        ok: true,
        candidates: files.map((file) => ({ ...file, validation: validateImportCandidate(file) })),
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "importBulk") {
      const files = Array.isArray(body.files) ? (body.files as DriveImportCandidate[]) : [];
      const result = await bulkImportDriveImages(env.DB, env, {
        tenantId,
        deckId: clean(body.deck_id ?? body.deckId, 120),
        folderId: clean(body.folder_id ?? body.folderId, 200),
        folderName: clean(body.folder_name ?? body.folderName, 240),
        duplicatePolicy: clean(body.duplicate_policy ?? body.duplicatePolicy, 40) || "skip",
        files,
      });
      return Response.json({ ok: true, ...result }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Drive import action failed." }, { status: 400 });
  }
}
