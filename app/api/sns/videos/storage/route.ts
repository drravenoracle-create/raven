import { env } from "cloudflare:workers";
import { uploadDriveVideo } from "@/app/lib/drive-import";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { source_url?: string; file_name?: string; content_type?: string; folder_id?: string } | null;
  if (!body?.source_url) return Response.json({ error: "source_url is required." }, { status: 400 });
  let sourceUrl: URL;
  try { sourceUrl = new URL(body.source_url); } catch { return Response.json({ error: "source_url must be a valid URL." }, { status: 400 }); }
  if (sourceUrl.protocol !== "https:" || !["raven.fortunestudios.jp", "raven-oracle.dr-ravenoracle.workers.dev"].includes(sourceUrl.hostname)) return Response.json({ error: "source_url host is not allowed." }, { status: 400 });
  const folderId = String(body.folder_id || (env as any).GOOGLE_DRIVE_VIDEO_FOLDER_ID || "").trim();
  if (!folderId) return Response.json({ error: "GOOGLE_DRIVE_VIDEO_FOLDER_ID is not configured." }, { status: 503 });
  const source = await fetch(sourceUrl);
  if (!source.ok) return Response.json({ error: `Source video returned ${source.status}.` }, { status: 502 });
  const buffer = await source.arrayBuffer();
  try {
    const uploaded = await uploadDriveVideo(env, { fileName: body.file_name || "raven-video.mp4", contentType: body.content_type || source.headers.get("content-type") || "video/mp4", body: buffer, folderId });
    return Response.json({ ok: true, storage: "google_drive", ...uploaded }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Google Drive upload failed." }, { status: 502 });
  }
}
