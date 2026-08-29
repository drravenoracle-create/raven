type AdminContext = {
  tenantId: string;
  characterId: string;
  displayName: string;
  guildId: string;
  locale: string;
};

const esc = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character] || character));

function timingSafeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.byteLength, rightBytes.byteLength);
  const paddedLeft = new Uint8Array(length);
  const paddedRight = new Uint8Array(length);
  paddedLeft.set(leftBytes);
  paddedRight.set(rightBytes);
  return leftBytes.byteLength === rightBytes.byteLength && crypto.subtle.timingSafeEqual(paddedLeft, paddedRight);
}

/** Returns a response for unauthenticated requests, or null when Basic Auth passes. */
export function requireBasicAdmin(request: Request, configuredCredential?: string): Response | null {
  if (!configuredCredential || !configuredCredential.includes(":")) {
    return new Response("Admin authentication is not configured.", { status: 503, headers: { "cache-control": "no-store" } });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return new Response("Authentication required.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="StudioOS Admin", charset="UTF-8"', "cache-control": "no-store" },
    });
  }

  const [scheme, encoded] = authorization.split(/\s+/, 2);
  if (scheme !== "Basic" || !encoded) return new Response("Authentication required.", { status: 401, headers: { "cache-control": "no-store" } });

  let supplied: string;
  try {
    supplied = new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)));
  } catch {
    supplied = "";
  }

  if (!timingSafeEqual(supplied, configuredCredential)) {
    return new Response("Authentication required.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="StudioOS Admin", charset="UTF-8"', "cache-control": "no-store" },
    });
  }
  return null;
}

const status = (value: string, tone: "on" | "off" | "safe" = "safe") =>
  `<span class="status ${tone}">${esc(value)}</span>`;

export function renderStudioosAdmin(
  context: AdminContext,
  environment: string,
  blogRows: number,
  analyticsRows: number,
) {
  const character = esc(context.displayName);
  return `<!doctype html>
<html lang="ja-JP"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${character}｜運用コンソール</title>
<style>
:root{--ink:#252b27;--muted:#657068;--line:#d9ded7;--paper:#fffdf8;--wash:#f1f5ef;--deep:#263c31;--gold:#c99431;--ok:#356d4c;--off:#747b76}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#f8faf5,#edf3ec);color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;line-height:1.7}.shell{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:28px 0 56px}.topbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.back{color:var(--deep);font-weight:800;text-decoration:none}.label{color:#7d612b;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.hero{margin-top:22px;padding:30px;border:1px solid var(--line);background:rgba(255,253,248,.9);box-shadow:0 18px 44px rgba(38,60,49,.08)}h1{margin:8px 0 10px;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(34px,6vw,58px);line-height:1.12}.lead{max-width:760px;margin:0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:18px}.card{border:1px solid var(--line);background:var(--paper);padding:20px}.card h2{margin:0 0 14px;font-size:20px}.metric{font-size:30px;font-weight:900;line-height:1.1}.muted{margin:6px 0 0;color:var(--muted);font-size:13px}.section{margin-top:18px}.identity{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0}.identity div{padding:12px;background:var(--wash);border:1px solid var(--line)}dt{color:var(--muted);font-size:12px}dd{margin:2px 0 0;font-weight:800;overflow-wrap:anywhere}.features{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.feature{display:flex;justify-content:space-between;gap:12px;align-items:center;border-bottom:1px solid var(--line);padding:11px 0}.feature:last-child,.feature:nth-last-child(2){border-bottom:0}.status{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:900;white-space:nowrap}.status.on{background:#e1f1e5;color:var(--ok)}.status.off{background:#eceeeb;color:var(--off)}.status.safe{background:#fff0c9;color:#795816}.notice{margin-top:18px;padding:14px 16px;border-left:4px solid var(--gold);background:#fff7dd;color:#5c543f;font-size:14px}.footer{margin-top:24px;color:var(--muted);font-size:13px}@media(max-width:820px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.identity{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.shell{width:min(100% - 24px,1120px)}.hero,.card{padding:18px}.grid,.features,.identity{grid-template-columns:1fr}.feature:nth-last-child(2){border-bottom:1px solid var(--line)}h1{font-size:38px}}
</style></head><body><main class="shell"><nav class="topbar"><a class="back" href="/">${character}｜公開サイトへ</a><span class="label">StudioOS Operations</span></nav><header class="hero"><p class="label">Authenticated read-only console</p><h1>${character} 運用コンソール</h1><p class="lead">テナントの稼働状況、コンテンツ件数、機能の安全状態を確認する読み取り専用画面です。記事公開・会員変更・外部投稿などの書き込み操作は提供していません。</p></header><section class="grid" aria-label="運用サマリー"><article class="card"><p class="label">Blog</p><p class="metric">${blogRows}</p><p class="muted">テナント記事</p></article><article class="card"><p class="label">Analytics</p><p class="metric">${analyticsRows}</p><p class="muted">内部イベント</p></article><article class="card"><p class="label">Core Site</p><p class="metric">${status("LIVE", "on")}</p><p class="muted">StudioOS runtime</p></article><article class="card"><p class="label">Environment</p><p class="metric">${esc(environment)}</p><p class="muted">現在の実行環境</p></article></section><section class="card section"><h2>Tenant Context</h2><dl class="identity"><div><dt>Tenant</dt><dd>${esc(context.tenantId)}</dd></div><div><dt>Character</dt><dd>${esc(context.characterId)}</dd></div><div><dt>Guild</dt><dd>${esc(context.guildId)}</dd></div><div><dt>Locale</dt><dd>${esc(context.locale)}</dd></div><div><dt>DB</dt><dd>StudioOS Shared Core</dd></div><div><dt>Analytics DB</dt><dd>Shared Analytics</dd></div></dl></section><section class="card section"><h2>Feature Activation</h2><div class="features"><div class="feature"><span>Core Site</span>${status("ON", "on")}</div><div class="feature"><span>Member</span>${status("READ-ONLY")}</div><div class="feature"><span>Internal Analytics</span>${status("ON", "on")}</div><div class="feature"><span>Blog</span>${status("ON", "on")}</div><div class="feature"><span>Blog Scheduler</span>${status("OFF", "off")}</div><div class="feature"><span>SNS</span>${status("OFF", "off")}</div><div class="feature"><span>Reel</span>${status("OFF", "off")}</div><div class="feature"><span>Growth</span>${status("READ-ONLY")}</div><div class="feature"><span>Opening Campaign</span>${status("OFF", "off")}</div><div class="feature"><span>Trial</span>${status("OFF", "off")}</div></div><div class="notice">外部書き込み：OFF ／ Growth executionAllowed：false ／ requiresStartApproval：true ／ autoStart：false</div></section><p class="footer">${character} の解決済みテナントコンテキストのみ表示しています。管理操作はこの画面から実行できません。</p></main></body></html>`;
}
