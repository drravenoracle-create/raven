import { resolveRuntimeContext } from "../app/lib/studioos-runtime-adapter.ts";

interface Env {
  DB: D1Database;
  GUILD_MEMBER_API_BASE_URL?: string;
  STUDIOOS_TENANT_ID: string;
  STUDIOOS_CHARACTER_ID: string;
  STUDIOOS_GUILD_ID: string;
  STUDIOOS_ENVIRONMENT: string;
}

const LUNA_TENANT_ID = "luna-oracle";
const LUNA_CHARACTER_ID = "luna";
const LUNA_GUILD_ID = "raven-guild";

export function memberReadPath(pathname: string) {
  return pathname === "/api/member/session" || pathname === "/api/member/readings" || pathname.startsWith("/api/member/readings/") ? pathname : null;
}

function memberCoreBaseUrl(env: Pick<Env, "GUILD_MEMBER_API_BASE_URL">) {
  if (!env.GUILD_MEMBER_API_BASE_URL) return null;
  try {
    const url = new URL(env.GUILD_MEMBER_API_BASE_URL);
    if (url.protocol !== "https:" || url.hostname !== "guild-member-core.fortune-kanri.workers.dev" || url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function memberHeaders(request: Request) {
  const headers = new Headers({
    accept: "application/json",
    "x-tenant-id": LUNA_TENANT_ID,
    "x-guild-id": LUNA_GUILD_ID,
    "x-character-id": LUNA_CHARACTER_ID,
  });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  return headers;
}

export async function forwardMemberRead(request: Request, env: Pick<Env, "GUILD_MEMBER_API_BASE_URL">) {
  const path = memberReadPath(new URL(request.url).pathname);
  const baseUrl = memberCoreBaseUrl(env);
  if (!path || request.method !== "GET") return json({ ok: false, error: "Member read-only endpoint required.", code: "member_read_only" }, { status: 403 });
  if (!baseUrl) return json({ ok: false, error: "Member Core is temporarily unavailable.", code: "member_core_unavailable" }, { status: 503 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${baseUrl}${path}${new URL(request.url).search}`, {
      method: "GET",
      headers: memberHeaders(request),
      signal: controller.signal,
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return json({ ok: false, error: "Member Core is temporarily unavailable.", code: "member_core_unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}

function trialDisabledResponse() {
  return json({ ok: false, error: "Trial is disabled in Preview.", code: "trial_disabled" }, { status: 403 });
}

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, {
  ...init,
  headers: { "cache-control": "no-store", ...init.headers },
});

async function count(db: D1Database, table: string, tenantId: string) {
  const allowed = new Set([
    "analytics_events", "studioos_reading_feedback", "blog_engine_settings", "blog_engine_articles", "sns_posts", "reel_assets",
    "growth_metric_points", "growth_evidence_sources", "growth_evidence_claims", "growth_hypotheses",
    "growth_proposals", "growth_experiments", "growth_knowledge_items", "growth_memory", "growth_precision_snapshots",
  ]);
  if (!allowed.has(table)) return 0;
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE tenant_id = ?`).bind(tenantId).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const tenantId = String(env.STUDIOOS_TENANT_ID || "").trim();
    const context = resolveRuntimeContext({ tenantHint: tenantId });
    if (context.config.identity.primaryCharacterId !== env.STUDIOOS_CHARACTER_ID || context.config.guildId !== env.STUDIOOS_GUILD_ID) {
      return json({ error: "runtime identity mismatch" }, { status: 500 });
    }

    const url = new URL(request.url);
    if (memberReadPath(url.pathname)) return forwardMemberRead(request, env);
    if (url.pathname.startsWith("/api/member/trials/") || url.pathname === "/api/member/events" || url.pathname.startsWith("/api/member/auth/")) return trialDisabledResponse();
    if (url.pathname === "/api/preview/status") {
      const [analyticsRows, blogRows, growthRows] = await Promise.all([
        count(env.DB, "analytics_events", tenantId),
        count(env.DB, "blog_engine_articles", tenantId),
        count(env.DB, "growth_metric_points", tenantId),
      ]);
      return json({
        tenantId: context.tenantId,
        characterId: context.character.characterId,
        guildId: context.config.guildId,
        locale: context.localization.locale,
        environment: env.STUDIOOS_ENVIRONMENT,
        schemaVersion: context.config.schemaVersion,
        activation: { coreSite: true, member: env.GUILD_MEMBER_API_BASE_URL ? "read-only" : "unavailable", analyticsInternal: true, blog: true, blogScheduler: false, sns: false, reel: false, growth: "read-only", openingCampaign: false, trial: false },
        member: { mode: env.GUILD_MEMBER_API_BASE_URL ? "read_only" : "unavailable", trial: "disabled" },
        growthSafety: { executionAllowed: false, requiresStartApproval: true, autoStart: false },
        runtime: { tenantResolver: true, characterCore: true, marketPersona: true, engineSlices: true },
        data: { analyticsRows, blogRows, growthRows },
        externalWrites: false,
        ravenContamination: false,
      });
    }
    if (url.pathname === "/api/preview/analytics") {
      return json({ tenantId, eventCount: await count(env.DB, "analytics_events", tenantId), readOnly: true });
    }
    if (url.pathname === "/api/preview/feedback") {
      return json({ tenantId, feedbackCount: await count(env.DB, "studioos_reading_feedback", tenantId), readOnly: true });
    }
    if (url.pathname === "/api/health") return json({ ok: true, tenantId, environment: env.STUDIOOS_ENVIRONMENT });
    if (url.pathname.startsWith("/blog/")) {
      const slug = decodeURIComponent(url.pathname.slice("/blog/".length));
      const article = await env.DB.prepare("SELECT slug, title, locale, status, created_at, published_at FROM blog_engine_articles WHERE tenant_id = ? AND slug = ? LIMIT 1").bind(tenantId, slug).first();
      if (!article) return json({ error: "article not found" }, { status: 404 });
      return json({ tenantId, article, readOnly: true });
    }
    if (url.pathname !== "/" && url.pathname !== "/blog") return json({ error: "not found" }, { status: 404 });

    const html = `<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><title>Luna Preview</title></head><body><main><p>StudioOS Luna Preview</p><h1>${context.character.displayName}</h1><p>${context.localization.locale} / ${env.STUDIOOS_ENVIRONMENT}</p><p>Blog preview is enabled. Scheduler, SNS, Reel, Campaign, Trial, and Growth actions are disabled.</p></main></body></html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  },
};
