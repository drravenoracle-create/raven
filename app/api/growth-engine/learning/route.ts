import { env } from "cloudflare:workers";
import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";
import { getLearningPatterns, getLearningSummary } from "@/app/lib/growth-learning";

async function requireAdmin() { const session = await getAdminSession(); return session && session.email.toLowerCase() === adminEmail().toLowerCase(); }
export async function GET(request: Request) {
  if (!(await requireAdmin())) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  const url = new URL(request.url); const tenantId = url.searchParams.get("tenantId") || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 });
  const filters = Object.fromEntries(["guildId", "market", "country", "locale", "characterId", "platform", "targetSegment", "metric", "resultClass", "maturity"].map((key) => [key, url.searchParams.get(key)]));
  const patterns = await getLearningPatterns(env.DB, tenantId, filters);
  const patternKey = url.searchParams.get("patternKey");
  const selected = patternKey ? patterns.find((item) => item.patternKey === patternKey) || null : null;
  return Response.json({ ok: true, summary: await getLearningSummary(env.DB, tenantId), patterns: selected ? [selected] : patterns.slice(0, Math.min(100, Number(url.searchParams.get("limit") || 100))), detail: selected }, { headers: { "Cache-Control": "no-store" } });
}
