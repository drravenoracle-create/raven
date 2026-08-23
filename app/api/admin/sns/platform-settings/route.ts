import { env } from "cloudflare:workers";

const TENANT_ID = "raven-oracle";
const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;

function normalize(value: unknown) {
  if (!value || typeof value !== "object") return {} as Record<string, boolean>;
  const input = value as Record<string, unknown>;
  return Object.fromEntries(PLATFORMS.map((platform) => [platform, input[platform] !== false])) as Record<string, boolean>;
}

export async function GET() {
  const row = await env.DB.prepare("SELECT emergency_stop_platforms FROM sns_automation_settings WHERE tenant_id = ? LIMIT 1")
    .bind(TENANT_ID).first<{ emergency_stop_platforms?: string }>().catch(() => null);
  let stored: unknown = {};
  try { stored = JSON.parse(row?.emergency_stop_platforms || "{}"); } catch {}
  const stopped = stored && typeof stored === "object" ? stored as Record<string, unknown> : {};
  const hasStoredValue = PLATFORMS.some((platform) => Object.prototype.hasOwnProperty.call(stopped, platform));
  return Response.json({ platforms: Object.fromEntries(PLATFORMS.map((platform) => [platform, hasStoredValue ? stopped[platform] !== true : true])) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { platforms?: unknown } | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const platforms = normalize(body.platforms);
  await env.DB.prepare("UPDATE sns_automation_settings SET emergency_stop_platforms = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?")
    .bind(JSON.stringify(Object.fromEntries(PLATFORMS.map((platform) => [platform, !platforms[platform]]))), TENANT_ID).run();
  return Response.json({ ok: true, platforms });
}
