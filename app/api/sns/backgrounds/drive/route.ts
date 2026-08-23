import { env } from "cloudflare:workers";
import { listDriveVideos } from "@/app/lib/drive-import";
import { RAVEN_TENANT_CONFIG } from "@/app/lib/tenant-config";

const tenantId = RAVEN_TENANT_CONFIG.id;
export async function GET(request: Request) {
  const folderId = new URL(request.url).searchParams.get("folderId") || String((env as any).GOOGLE_DRIVE_VIDEO_FOLDER_ID || "");
  try { return Response.json({ ok: true, videos: await listDriveVideos(env, { folderId }) }); }
  catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Drive video list failed." }, { status: 502 }); }
}
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.file_id) return Response.json({ ok: false, error: "file_id is required." }, { status: 400 });
  const id = String(body.file_id).slice(0, 200);
  const name = String(body.name || id).slice(0, 180);
  const backgroundId = `drive-${id}`;
  const file = `/api/sns/backgrounds/drive/${encodeURIComponent(id)}`;
  await (env as any).DB.prepare(`INSERT INTO sns_video_backgrounds (background_id, tenant_id, file, category, tags, duration, resolution, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(background_id) DO UPDATE SET file=excluded.file, category=excluded.category, tags=excluded.tags, duration=excluded.duration, resolution=excluded.resolution, enabled=1, updated_at=CURRENT_TIMESTAMP`).bind(backgroundId, tenantId, file, String(body.category || "Drive").slice(0, 80), String(body.tags || name).slice(0, 240), Number(body.duration || 20), String(body.resolution || "1080x1920").slice(0, 40)).run();
  return Response.json({ ok: true, background_id: backgroundId, file });
}
