type Scope = { guild_id: string; tenant_id: string; character_id: string; market: string; locale: string };

type Env = {
  GUILD_MEMBER_CORE?: Fetcher;
  CARD_LIBRARY_SERVICE_TOKEN?: string;
  BLOG_SERVICE_TOKEN?: string;
  GROWTH_SERVICE_TOKEN?: string;
};

function clean(value: unknown, max = 120) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

export function renderSharedBlogIndex(title: string, intro: string, articles: Array<{ slug: string; title: string; excerpt?: string; published_at?: string }>) {
  const items = articles.length ? articles.map((article) => `<article><p>${escapeHtml(article.published_at || "公開記事")}</p><h2><a href="/blog/${encodeURIComponent(article.slug)}">${escapeHtml(article.title)}</a></h2><p>${escapeHtml(article.excerpt || "")}</p></article>`).join("") : "<p>公開記事は準備中です。</p>";
  return `<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#f5f7f1;color:#26352d;font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;line-height:1.8}main{width:min(900px,calc(100% - 32px));margin:0 auto;padding:56px 0}a{color:#345a43}article{margin-top:18px;padding:22px;border:1px solid #d8e2d3;background:#fffdf8}article p{margin:6px 0;color:#637066}h1,h2{line-height:1.25}</style></head><body><main><p>StudioOS Blog</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p>${items}</main></body></html>`;
}

export async function proxySharedCardLibrary(request: Request, env: Env, scope: Scope) {
  if (!env.GUILD_MEMBER_CORE || !env.CARD_LIBRARY_SERVICE_TOKEN) {
    return Response.json({ ok: false, error: "Shared card library is not configured." }, { status: 503 });
  }
  const incoming = new URL(request.url);
  const target = new URL(`https://guild-member-core.internal/api/card-library${incoming.search}`);
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${env.CARD_LIBRARY_SERVICE_TOKEN}`);
  headers.set("x-guild-id", clean(scope.guild_id));
  headers.set("x-tenant-id", clean(scope.tenant_id));
  headers.set("x-character-id", clean(scope.character_id));
  headers.set("x-market", clean(scope.market || "jp", 20));
  headers.set("x-locale", clean(scope.locale || "ja-JP", 20));
  return env.GUILD_MEMBER_CORE.fetch(new Request(target, { method: request.method, headers, body: request.method === "GET" ? undefined : request.body }));
}

export async function proxySharedBlog(request: Request, env: Env, scope: Scope) {
  if (!env.GUILD_MEMBER_CORE || !env.BLOG_SERVICE_TOKEN) return Response.json({ ok: false, error: "Shared blog is not configured." }, { status: 503 });
  const incoming = new URL(request.url);
  const target = new URL(`https://guild-member-core.internal/api/blog${incoming.search}`);
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${env.BLOG_SERVICE_TOKEN}`);
  headers.set("x-guild-id", clean(scope.guild_id));
  headers.set("x-tenant-id", clean(scope.tenant_id));
  headers.set("x-character-id", clean(scope.character_id));
  headers.set("x-market", clean(scope.market || "jp", 20));
  headers.set("x-locale", clean(scope.locale || "ja-JP", 20));
  return env.GUILD_MEMBER_CORE.fetch(new Request(target, { method: request.method, headers, body: request.method === "GET" ? undefined : request.body }));
}

export async function proxySharedGrowth(request: Request, env: Env, scope: Scope) {
  if (!env.GUILD_MEMBER_CORE || !env.GROWTH_SERVICE_TOKEN) return Response.json({ ok: false, error: "Shared growth is not configured." }, { status: 503 });
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${env.GROWTH_SERVICE_TOKEN}`);
  headers.set("x-guild-id", clean(scope.guild_id));
  headers.set("x-tenant-id", clean(scope.tenant_id));
  headers.set("x-character-id", clean(scope.character_id));
  headers.set("x-market", clean(scope.market || "jp", 20));
  headers.set("x-locale", clean(scope.locale || "ja-JP", 20));
  return env.GUILD_MEMBER_CORE.fetch(new Request("https://guild-member-core.internal/api/growth", { method: "GET", headers }));
}
