import baseWorker from "./sol-preview.ts";
import { requireBasicAdmin } from "./studioos-admin.ts";
import { proxySharedBlog, proxySharedCardLibrary, proxySharedGrowth, renderSharedBlogIndex } from "./shared-card-library-proxy.ts";

interface Env {
  DB: D1Database;
  ANALYTICS_DB?: D1Database;
  STUDIOOS_TENANT_ID: string;
  STUDIOOS_CHARACTER_ID: string;
  STUDIOOS_GUILD_ID: string;
  STUDIOOS_ENVIRONMENT: string;
  ADMIN_BASIC_AUTH?: string;
  GUILD_MEMBER_CORE?: Fetcher;
  GUILD_MEMBER_SERVICE_TOKEN?: string;
  BLOG_SERVICE_TOKEN?: string;
  GROWTH_SERVICE_TOKEN?: string;
}

const htmlHeaders = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character] || character));

const solFreeMenus = [
  ["今日の朝日メッセージ", "今の気持ちを受け止め、今日いちばん大切にしたい一歩を短く整えます。"],
  ["自己肯定感リーディング", "できなかったことではなく、今も残っている力と回復の入口を見つけます。"],
  ["再出発のヒント", "やり直したいこと、切り替えたいことを、無理のない最初の行動へ戻します。"],
  ["恋愛・人間関係の気持ち整理", "相手の気持ちを断定せず、自分の安心、距離感、次に使える言葉を見ます。"],
];

const solTextMenus = [
  ["相談文整理", "まとまらない不安や相談文を、気持ち、状況、次に確認することへ分けます。"],
  ["相手から来た文章", "文章の温度、受け取りすぎている不安、返す前に整える視点を読みます。"],
  ["送る前の文章チェック", "相手へ届きやすい言葉、強くなりすぎた表現、保留した方がよい一文を整えます。"],
  ["自己肯定感の回復メモ", "自分を責める言葉をほどき、今日守ってよいこと、休んでよいことを見つけます。"],
  ["再出発プラン", "大きな決断ではなく、明日へつながる小さな行動と戻る場所を整理します。"],
];

function shell(title: string, body: string) {
  return `<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="ソル・オーロラの無料占いとAIテキスト鑑定。自己肯定感、再出発、恋愛や人間関係の気持ちをやさしく整理します。"><title>${escapeHtml(title)}｜ソル・オーロラ</title><style>
  :root{--ink:#26352d;--muted:#66766b;--line:#dce6d5;--leaf:#4f7b5b;--deep:#213b2f;--gold:#c7932e;--paper:#fffdf8;--shadow:0 18px 44px rgba(39,73,49,.13)}
  *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#fffdf8 0%,#f5faee 50%,#fff6e4 100%);color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;line-height:1.85}a{color:inherit}header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:22px;padding:14px clamp(18px,5vw,72px);border-bottom:1px solid rgba(220,230,213,.92);background:rgba(255,253,248,.9);backdrop-filter:blur(14px)}.brand{display:flex;align-items:center;gap:11px;text-decoration:none;font-weight:900}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#e5b446,#fff1b8 56%,#79a872);color:#fff;font-family:Georgia,serif;font-size:19px;box-shadow:0 8px 18px rgba(199,147,46,.22)}nav{display:flex;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:14px;font-weight:800}nav a{text-decoration:none}nav a:hover{color:var(--leaf)}.hero{position:relative;overflow:hidden;padding:clamp(68px,10vw,126px) clamp(20px,7vw,100px);background:linear-gradient(110deg,rgba(33,59,47,.98),rgba(76,118,72,.9) 54%,rgba(230,181,70,.72));color:#fff}.hero:after{content:"";position:absolute;right:8%;top:14%;width:min(310px,38vw);aspect-ratio:1;border:1px solid rgba(255,246,205,.62);border-radius:50%;box-shadow:0 0 0 24px rgba(255,246,205,.1),0 0 0 52px rgba(255,246,205,.06)}.hero-inner{position:relative;z-index:1;max-width:760px}.eyebrow{margin:0;color:var(--gold);font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}h1{margin:12px 0 18px;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(40px,7vw,78px);line-height:1.08}.lead{max-width:720px;color:rgba(255,255,255,.92);font-size:clamp(17px,2vw,21px)}section{padding:74px clamp(20px,6vw,88px)}.wrap{width:min(1120px,100%);margin:0 auto}.section-title{max-width:760px;margin-bottom:28px}.section-title h2{margin:6px 0 0;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(30px,4vw,46px);line-height:1.2}.section-title p,.muted{color:var(--muted)}.chips{display:flex;flex-wrap:wrap;gap:9px;margin:24px 0 30px}.chips span{border:1px solid rgba(255,246,205,.5);border-radius:999px;padding:6px 12px;background:rgba(255,255,255,.13);font-size:13px;font-weight:900}.button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:900;border:0}.primary{background:#fff6d7;color:var(--deep);box-shadow:0 12px 24px rgba(24,51,36,.2)}.secondary{border:1px solid rgba(255,245,203,.58);color:#fff;background:transparent;margin-left:8px}.soft{background:#eef7e8;color:#2d5138}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:18px}.card{padding:25px;border:1px solid var(--line);border-radius:10px;background:rgba(255,253,248,.9);box-shadow:var(--shadow)}.card h3{margin:0 0 8px;font-size:21px}.card p{margin:0;color:var(--muted)}.menu-card{display:flex;flex-direction:column;min-height:250px}.menu-card .button{align-self:flex-start;margin-top:auto}.band{background:linear-gradient(135deg,#fff4ce,#f1f8ec);border-block:1px solid #e7dfbe}.split{display:grid;grid-template-columns:1fr 1fr;gap:24px}.notice{margin-top:18px;padding:16px 18px;border-left:4px solid var(--gold);background:#fff8dc;color:#5d675c}.footer{display:flex;justify-content:space-between;gap:20px;padding:32px clamp(20px,6vw,88px);background:var(--deep);color:#edf7e9;font-size:14px}.footer a{color:#fff1c9;text-decoration:none}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}header nav{gap:10px;font-size:13px}.hero{padding-top:70px}.hero:after{right:-42px;top:8%;width:210px;opacity:.6}.secondary{margin:10px 0 0}.split{grid-template-columns:1fr}section{padding-block:56px}.footer{display:grid}}
  </style></head><body><header><a class="brand" href="/"><span class="mark">S</span><span>Sol Aurora<br><small class="muted">Raven Guild｜希望と再出発</small></span></a><nav aria-label="メインナビゲーション"><a href="/">ホーム</a><a href="/free-fortune/">AI無料占い</a><a href="/text-reading/">AIテキスト鑑定</a><a href="/divination">占術解説</a><a href="/guild">ギルド</a></nav></header>${body}<footer class="footer"><strong>ソル・オーロラ｜Raven Guild</strong><nav><a href="/">ホーム</a><a href="/free-fortune/">無料占い</a><a href="/text-reading/">AIテキスト鑑定</a></nav></footer></body></html>`;
}

function topMenuSection() {
  return `<section id="menu"><div class="wrap"><div class="section-title"><p class="eyebrow">Reading Menu</p><h2>ソルの無料占い・AIテキスト鑑定</h2><p>気持ちがまとまっていない時でも選びやすいように、短く試す無料占いと、文章を貼って深く整えるAIテキスト鑑定を分けました。</p></div><div class="grid"><article class="card"><p class="eyebrow">AI無料占い</p><h3>今の心に合う一歩を選ぶ</h3><p>今日のメッセージ、自己肯定感、再出発、恋愛・人間関係の入口を用意しています。会員登録なしで短く確認できます。</p><a class="button primary" href="/free-fortune/">無料占いを開く</a></article><article class="card"><p class="eyebrow">AIテキスト鑑定</p><h3>相談文や相手の文章を読む</h3><p>送る前の文章、受け取った言葉、まとまらない相談を貼り、気持ち・状況・次の言葉へ整理します。</p><a class="button primary" href="/text-reading/">AIテキスト鑑定を開く</a></article><article class="card"><p class="eyebrow">占術解説</p><h3>カードの読み方を深く知る</h3><p>タロット、ルノルマン、展開法、生命の樹まで。占いを使い慣れた人にも読み応えのある解説へ進めます。</p><a class="button primary" href="/divination">占術解説へ</a></article></div></div></section>`;
}

function menuCards(items: string[][], href: string, label: string) {
  return `<div class="grid">${items.map(([title, body]) => `<article class="card menu-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p><a class="button soft" href="${href}">${label}</a></article>`).join("")}</div>`;
}

function servicePage(type: "free" | "text") {
  const isFree = type === "free";
  const title = isFree ? "AI無料占い" : "AIテキスト鑑定";
  const lead = isFree
    ? "今日の気持ち、自己肯定感、再出発、恋愛や人間関係の迷いを、ソルの視点で短く整える入口です。"
    : "相談文、相手から来た文章、送る前の文章を、責めない言葉と次の一歩へ整理する入口です。";
  const contents = isFree
    ? menuCards(solFreeMenus, "https://raven.fortunestudios.jp/free-fortune/", "無料占いをはじめる")
    : menuCards(solTextMenus, "https://raven.fortunestudios.jp/text-reading/", "AIテキスト鑑定をはじめる");
  return shell(title, `<main><section class="hero"><div class="hero-inner"><p class="eyebrow">${isFree ? "Free Reading" : "AI Text Reading"}</p><h1>${title}</h1><p class="lead">${lead}</p><div class="chips"><span>${isFree ? "無料" : "トライアル ¥0"}</span><span>会員登録なし</span><span>ソル風のやさしい整理</span></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Choose</p><h2>ソル向けメニュー</h2><p>ソルでは、明るさを押しつけず、今の自分を責めないための言葉へ寄せています。相談内容に近い入口から始めてください。</p></div>${contents}<div class="notice">気持ちがまとまっていなくても大丈夫です。近いメニューを選び、今の状態を短い言葉で入力してください。</div></div></section></main>`);
}

function publicHome(html: string) {
  return html
    .replace('<p class="eyebrow">Character Core</p>', '<p class="eyebrow">ソルの役割</p>')
    .replace('<a href="#reading">相談の入口</a>', '<a href="#menu">鑑定メニュー</a><a href="#reading">相談の入口</a>')
    .replace('<section id="reading">', `${topMenuSection()}<section id="reading">`)
    .replace('</main><footer class="footer">', '<section id="contact"><div class="wrap"><div class="section-title"><p class="eyebrow">Start</p><h2>いまの気持ちを、短い言葉から。</h2><p>自己肯定感、再出発、一歩の迷い。まとまっていない気持ちも、無料占いとAIテキスト鑑定から選んで整理できます。</p></div><a class="button primary" href="/text-reading/">AIテキスト鑑定へ</a><a class="button primary" href="/free-fortune/">無料占いへ</a></div></section></main><footer class="footer">')
    .replace(/<h3>現在の提供状態<\/h3><ul class="list">[\s\S]*?<\/ul>/, '<h3>ご利用案内</h3><ul class="list"><li>AI無料占い：今日の気持ちを短く整理します</li><li>AIテキスト鑑定：相談文や文章を深く読みます</li><li>占術解説：タロット・ルノルマン・展開法を学べます</li><li>ギルド紹介：各メンバーの得意分野を確認できます</li></ul>');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/blog" && request.method === "GET") return proxySharedBlog(request, env, { guild_id: env.STUDIOOS_GUILD_ID, tenant_id: env.STUDIOOS_TENANT_ID, character_id: env.STUDIOOS_CHARACTER_ID, market: "jp", locale: "ja-JP" });
    if (url.pathname === "/api/growth" && request.method === "GET") return proxySharedGrowth(request, env, { guild_id: env.STUDIOOS_GUILD_ID, tenant_id: env.STUDIOOS_TENANT_ID, character_id: env.STUDIOOS_CHARACTER_ID, market: "jp", locale: "ja-JP" });
    if (url.pathname === "/blog" || url.pathname === "/blog/") {
      const response = await proxySharedBlog(new Request(new URL("/api/blog", request.url), { headers: request.headers }), env, { guild_id: env.STUDIOOS_GUILD_ID, tenant_id: env.STUDIOOS_TENANT_ID, character_id: env.STUDIOOS_CHARACTER_ID, market: "jp", locale: "ja-JP" });
      const payload = await response.json() as { articles?: Array<{ slug: string; title: string; excerpt?: string; published_at?: string }> };
      return new Response(renderSharedBlogIndex("ソルの読みもの", "自己肯定感、再出発、気持ちの整理についての案内です。", payload.articles || []), { headers: htmlHeaders });
    }
    if (url.pathname === "/api/card-library" && (request.method === "GET" || request.method === "POST")) {
      const failure = requireBasicAdmin(request, env.ADMIN_BASIC_AUTH);
      if (failure) return failure;
      return proxySharedCardLibrary(request, env, { guild_id: env.STUDIOOS_GUILD_ID, tenant_id: env.STUDIOOS_TENANT_ID, character_id: env.STUDIOOS_CHARACTER_ID, market: "jp", locale: "ja-JP" });
    }
    if (url.pathname === "/free-fortune" || url.pathname === "/free-fortune/") return new Response(servicePage("free"), { headers: htmlHeaders });
    if (url.pathname === "/text-reading" || url.pathname === "/text-reading/") return new Response(servicePage("text"), { headers: htmlHeaders });
    const response = await baseWorker.fetch(request, env);
    if (url.pathname !== "/" || !response.headers.get("content-type")?.includes("text/html")) return response;
    const html = await response.text();
    return new Response(publicHome(html), { status: response.status, headers: response.headers });
  },
};
