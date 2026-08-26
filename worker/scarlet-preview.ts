import { resolveRuntimeContext } from "../app/lib/studioos-runtime-adapter.ts";

interface Env {
  DB: D1Database;
  MEMBER_CORE?: { fetch(request: Request): Promise<Response> };
  GUILD_MEMBER_API_BASE_URL?: string;
  STUDIOOS_TENANT_ID: string;
  STUDIOOS_CHARACTER_ID: string;
  STUDIOOS_GUILD_ID: string;
  STUDIOOS_ENVIRONMENT: string;
}

const TENANT_ID = "scarlet-donovan";
const CHARACTER_ID = "scarlet";
const GUILD_ID = "raven-guild";
const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { "cache-control": "no-store", ...init.headers } });

function count(db: D1Database, table: string) {
  const allowed = new Set(["analytics_events", "blog_engine_articles"]);
  if (!allowed.has(table)) return Promise.resolve(0);
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE tenant_id = ?`).bind(TENANT_ID).first<{ count: number }>().then((row) => Number(row?.count ?? 0));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (env.STUDIOOS_TENANT_ID !== TENANT_ID || env.STUDIOOS_CHARACTER_ID !== CHARACTER_ID || env.STUDIOOS_GUILD_ID !== GUILD_ID) return json({ error: "runtime identity mismatch" }, { status: 500 });
    const context = resolveRuntimeContext({ tenantHint: TENANT_ID });
    const url = new URL(request.url);
    if (url.pathname === "/api/preview/status") {
      const [analyticsRows, blogRows] = await Promise.all([count(env.DB, "analytics_events"), count(env.DB, "blog_engine_articles")]);
      return json({ tenantId: context.tenantId, characterId: context.character.characterId, guildId: context.config.guildId, locale: context.localization.locale, environment: env.STUDIOOS_ENVIRONMENT, schemaVersion: context.config.schemaVersion, activation: { coreSite: true, member: "read-only", analyticsInternal: true, blog: true, blogScheduler: false, sns: false, reel: false, growth: "read-only", openingCampaign: false, trial: false }, growthSafety: { executionAllowed: false, requiresStartApproval: true, autoStart: false }, runtime: { tenantResolver: true, characterCore: true, marketPersona: true, engineSlices: true }, data: { analyticsRows, blogRows }, externalWrites: false, ravenContamination: false, lunaContamination: false });
    }
    if (url.pathname === "/api/preview/analytics") return json({ tenantId: TENANT_ID, eventCount: await count(env.DB, "analytics_events"), readOnly: true });
    if (url.pathname === "/api/preview/posts") return json({ tenantId: TENANT_ID, postCount: await count(env.DB, "blog_engine_articles"), readOnly: true });
    if (url.pathname.startsWith("/blog/")) {
      const slug = decodeURIComponent(url.pathname.slice("/blog/".length));
      const article = await env.DB.prepare("SELECT slug, title, locale, status, created_at, published_at FROM blog_engine_articles WHERE tenant_id = ? AND slug = ? LIMIT 1").bind(TENANT_ID, slug).first();
      return article ? json({ tenantId: TENANT_ID, article, readOnly: true }) : json({ error: "article not found" }, { status: 404 });
    }
    if (url.pathname !== "/") return json({ error: "not found" }, { status: 404 });
    return new Response(`<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><title>Scarlet Donovan</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#211f1e;color:#f8f1e8;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:32px}.card{max-width:720px;border:1px solid rgba(216,183,167,.35);background:linear-gradient(135deg,#2a2d2a,#5e2430);border-radius:12px;padding:40px;box-shadow:0 24px 80px rgba(0,0,0,.28)}p{line-height:1.9;color:#e7d8cc}.eyebrow{font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#d8b7a7}h1{margin:16px 0 0;font-size:clamp(40px,7vw,72px);line-height:1.05}.lead{font-size:18px}.cta{display:inline-block;margin-top:20px;border-radius:8px;background:#d8b7a7;color:#262625;padding:12px 18px;font-weight:800;text-decoration:none}</style></head><body><main><section class="card"><p class="eyebrow">Scarlet Donovan / Sword and Flowers</p><h1>剣は抜かず、花は折らない。</h1><p class="lead">スカーレット・ドノバンは、迷いを急がせず、心の反応と現実の選択を静かに切り分けます。</p><p>マヤ暦では資質、役割、関係性、流れを。インド占星術では出生図、月、ラグナ、ハウス、ダシャーを重ね、今どの一歩を選ぶと消耗が少ないかを見ていきます。</p><a class="cta" href="https://scarlet.fortunestudios.jp/text-reading/">AIテキスト鑑定を見る</a></section></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  },
};
