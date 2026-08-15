import { env } from "cloudflare:workers";
import { CARD_LIBRARY_TENANT_ID } from "@/app/lib/card-library";
import { driveImageResponse } from "@/app/lib/drive-import";

type Params = Promise<{ id: string }>;

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const fileId = clean(id, 200);
  if (!fileId) return Response.json({ error: "file id is required." }, { status: 400 });

  const imported = await env.DB.prepare(
    `SELECT id FROM card_drive_import_items
      WHERE tenant_id = ? AND drive_file_id = ? AND status IN ('imported','replaced')
      LIMIT 1`,
  )
    .bind(CARD_LIBRARY_TENANT_ID, fileId)
    .first<{ id: string }>();
  if (!imported) return Response.json({ error: "Drive image is not imported." }, { status: 404 });

  try {
    return await driveImageResponse(env, fileId);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Drive image fetch failed." }, { status: 502 });
  }
}
