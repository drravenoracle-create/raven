import { env } from "cloudflare:workers";
import { REEL_ENGINE_TENANT_ID } from "@/app/lib/reel-engine";

export async function GET() {
  const assets = await env.DB.prepare("SELECT * FROM media_video_assets WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY usage_count ASC, performance_score DESC, datetime(created_at) DESC LIMIT 100")
    .bind(REEL_ENGINE_TENANT_ID)
    .all();
  const settings = await env.DB.prepare("SELECT * FROM reel_engine_settings WHERE tenant_id = ? LIMIT 1")
    .bind(REEL_ENGINE_TENANT_ID)
    .first();
  return Response.json({ settings, assets: assets.results || [] }, { headers: { "Cache-Control": "no-store" } });
}
