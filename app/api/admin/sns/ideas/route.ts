import { env } from "cloudflare:workers";
import { generateIdeaCandidates, listIdeaPatterns, updateIdeaStatus, type IdeaMode } from "@/app/lib/sns-idea-planner";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";

const TENANT_ID = GROWTH_ENGINE_TENANT_ID;

function text(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function tenantFrom(value: unknown) {
  const tenantId = text(value, 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) throw new Error("Invalid tenant_id");
  return tenantId;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = tenantFrom(url.searchParams.get("tenantId") || url.searchParams.get("tenant_id"));
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
    const ideas = await env.DB.prepare(
      "SELECT * FROM sns_ideas WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT ?",
    ).bind(tenantId, limit).all();
    return Response.json({ ok: true, ideas: ideas.results || [], patterns: listIdeaPatterns(tenantId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Idea Planner unavailable" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const tenantId = tenantFrom(body.tenant_id ?? body.tenantId);
    const action = text(body.action, 30);
    if (action === "generate") {
      const ideas = await generateIdeaCandidates(env.DB, {
        tenantId,
        locale: text(body.locale, 12) || "ja",
        platform: text(body.platform, 40) || "auto",
        category: text(body.category, 80) || "auto",
        characterId: text(body.character_id ?? body.characterId, 80),
        mode: (text(body.mode, 20) || "BALANCED") as IdeaMode,
        count: Number(body.count || 10),
      });
      return Response.json({ ok: true, ideas }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (["save", "adopt", "reject"].includes(action)) {
      const ideaId = text(body.idea_id ?? body.ideaId, 100);
      if (!ideaId) return Response.json({ ok: false, error: "idea_id is required" }, { status: 400 });
      const result = await updateIdeaStatus(env.DB, tenantId, ideaId, action, text(body.reason, 1000));
      return Response.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ ok: false, error: "action must be generate, save, adopt, or reject" }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Idea Planner request failed" }, { status: 400 });
  }
}
