import baseWorker from "./atlas-preview.ts";
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

const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));

const atlasFreeMenus = [
  ["今日の現実整理", "今日まず整えること、保留してよいこと、使える支えを短く確認します。"],
  ["仕事・優先順位", "締切、負担、着手順を見直し、最初の一手を決めます。"],
  ["生活立て直し", "習慣、片付け、時間の使い方を見直し、続けやすい形へ整えます。"],
  ["技術・修理の切り分け", "壊れている箇所、試す順番、触らない方がよい範囲を整理します。"],
  ["人間関係の距離感", "相手の内心を断定せず、観察できる事実と守る線を整理します。"],
];

const atlasTextMenus = [
  ["相談文整理", "まとまらない相談文を読み、問題の部品、制約、次に確認することへ分けます。"],
  ["相手から来た文章", "文章の温度、確認できる事実、返す前に整えるポイントを見ます。"],
  ["送る前の文章チェック", "言いすぎ、曖昧さ、相手に伝わりにくい箇所を確認します。"],
  ["計画・作業メモ診断", "計画が大きすぎないか、今日動けるサイズになっているかを見ます。"],
  ["仕事・制作の詰まり診断", "どこで止まっているか、原因候補、次に検証する小さな手順へ分けます。"],
];

function menuCards(items: string[][], href: string, label: string) {
  return `<div class="grid">${items.map(([title, body]) => `<article class="card"><h3>${esc(title)}</h3><p>${esc(body)}</p><a class="button primary" href="${href}">${label}</a></article>`).join("")}</div>`;
}

function atlasMenuSection() {
  return `<section id="menu"><div class="wrap"><div class="section-title"><p class="eyebrow">Reading Menu</p><h2>アトラスの無料占い・AIテキスト鑑定</h2><p>短く試す無料占いと、文章を貼って深く整理するAIテキスト鑑定を用意しています。アトラスでは、仕事・生活・計画・修理のような現実の詰まりを、動ける順番へ戻します。</p></div><div class="grid"><article class="card"><p class="eyebrow">AI無料占い</p><h3>今の状況を軽く整える</h3><p>今日、仕事、生活、技術・修理、人間関係のテーマから選び、流れと次の一手を確認します。</p><a class="button primary" href="/free-fortune/">無料占いを開く</a></article><article class="card"><p class="eyebrow">AIテキスト鑑定</p><h3>文章の温度と作業順を見る</h3><p>相談文、相手の文章、送る前の文章、計画メモを貼り、注意点と整え方を確認します。</p><a class="button primary" href="/text-reading/">AIテキスト鑑定を開く</a></article><article class="card"><p class="eyebrow">占術解説</p><h3>アトラスの読み解きを知る</h3><p>不安を分解し、制約、選択肢、今日できる一歩へ落とし込む現実整理型の読み方です。</p><a class="button primary" href="/divination">読み解き方を見る</a></article></div></div></section>`;
}

function servicePage(type: "free" | "text") {
  const isFree = type === "free";
  const title = isFree ? "AI無料占い" : "AIテキスト鑑定";
  const lead = isFree
    ? "アトラスの視点で、今日の現実整理、仕事、生活、技術・修理、人間関係の流れを短く確認する入口です。"
    : "相談文や相手から来た文章を貼り、状況、制約、注意点、次の一手を整理する入口です。";
  const cards = isFree
    ? menuCards(atlasFreeMenus, "https://raven.fortunestudios.jp/free-fortune/", "無料占いをはじめる")
    : menuCards(atlasTextMenus, "https://raven.fortunestudios.jp/text-reading/", "AIテキスト鑑定をはじめる");
  return `<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="アトラススミスの${title}メニュー。"><title>${title}｜アトラススミス</title><style>:root{--ink:#2d302d;--muted:#687169;--line:#d9d6cc;--green:#4f6e58;--gold:#bd8a34;--paper:#fffdf8;--shadow:0 20px 50px rgba(45,48,45,.12)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#faf8f1,#f0f5ee 56%,#fbf8ef);color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;line-height:1.82}a{color:inherit}header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:15px clamp(20px,5vw,72px);border-bottom:1px solid var(--line);background:rgba(255,253,248,.91);backdrop-filter:blur(14px)}.brand{text-decoration:none;font-weight:900}nav{display:flex;flex-wrap:wrap;gap:17px;color:var(--muted);font-size:14px;font-weight:800}nav a{text-decoration:none}.hero{position:relative;overflow:hidden;padding:80px clamp(20px,6vw,88px);background:linear-gradient(110deg,rgba(39,53,48,.98),rgba(76,105,82,.92) 58%,rgba(177,139,64,.66));color:#fff}.hero:after{content:"";position:absolute;right:9%;top:16%;width:min(280px,37vw);aspect-ratio:1;border:1px solid rgba(247,221,157,.64);border-radius:50%;box-shadow:0 0 0 22px rgba(247,221,157,.09),0 0 0 45px rgba(247,221,157,.05)}.wrap{position:relative;z-index:1;width:min(1120px,100%);margin:0 auto}section{padding:70px clamp(20px,6vw,88px)}.eyebrow{margin:0;color:var(--gold);font-size:13px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}h1{margin:12px 0 18px;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(40px,6vw,70px);line-height:1.08}.lead{max-width:760px;color:rgba(255,255,255,.92);font-size:18px}.section-title{max-width:780px;margin-bottom:26px}.section-title h2{margin:6px 0 0;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(29px,4vw,46px);line-height:1.25}.section-title p,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:18px}.card{display:flex;flex-direction:column;min-height:230px;padding:25px;border:1px solid var(--line);border-radius:8px;background:rgba(255,253,248,.92);box-shadow:var(--shadow)}.card h3{margin:0 0 8px;font-size:21px}.card p{color:var(--muted)}.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:auto;padding:10px 16px;border-radius:7px;background:#fff4d2;color:#33473b;text-decoration:none;font-weight:900}.notice{margin-top:20px;padding:16px 18px;border-left:4px solid var(--gold);background:#fff7df;color:#5e625c}footer{padding:32px clamp(20px,6vw,88px);background:#2d3e36;color:#edf4e9}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}.hero:after{right:-50px;top:9%;width:210px;opacity:.55}}</style></head><body><header><a class="brand" href="/">アトラススミス</a><nav><a href="/">ホーム</a><a href="/free-fortune/">AI無料占い</a><a href="/text-reading/">AIテキスト鑑定</a><a href="/divination">読み解き</a></nav></header><main><section class="hero"><div class="wrap"><p class="eyebrow">Atlas Reading Menu</p><h1>${title}</h1><p class="lead">${lead}</p></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Menu</p><h2>アトラス向けメニュー</h2><p>鑑定テーマを選ぶと、相談内容の入力へ進めます。アトラスは「何が問題か」「どこから直すか」「今日どこまでやるか」を明確にする役割です。</p></div>${cards}<div class="notice">仕事・生活・計画・修理のどこを整えたいかを先に決めると、アトラスの読みはさらに締まります。</div></div></section></main><footer><strong>アトラススミス｜Raven Guild</strong></footer></body></html>`;
}

function publicHome(html: string) {
  return html
    .replace('<p class="eyebrow">Character Core</p>', '<p class="eyebrow">Atlasの役割</p>')
    .replace('<a href="#support">相談の入口</a>', '<a href="#menu">鑑定メニュー</a><a href="#support">相談の入口</a>')
    .replace('<a href="/">相談の入口</a>', '<a href="#contact">相談の入口</a>')
    .replace('<section id="support">', `${atlasMenuSection()}<section id="support">`)
    .replace('</main><footer class="footer">', '<section id="contact"><div class="wrap"><div class="section-title"><p class="eyebrow">Start</p><h2>整理したいことを、最初の一文から。</h2><p>仕事、生活、計画、技術・修理のどこからでも構いません。無料占いで短く確かめるか、AIテキスト鑑定で文章ごと整理できます。</p></div><a class="button primary" href="/text-reading/">AIテキスト鑑定へ</a><a class="button primary" href="/free-fortune/">無料占いへ</a></div></section></main><footer class="footer">')
    .replace(/<h3>現在の提供状態<\/h3><ul class="list">[\s\S]*?<\/ul>/, '<h3>ご利用案内</h3><ul class="list"><li>AI無料占い：今日の現実整理を短く確認します</li><li>AIテキスト鑑定：相談文や作業メモを深く読みます</li><li>占術解説：アトラスの現実整理型の読み方を学べます</li><li>ギルド紹介：各メンバーの得意分野を確認できます</li></ul>');
}

function divinationPage() {
  return `<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="アトラススミスの現実整理型の読み解き。状況、制約、選択肢を分け、今日できる一歩へつなげます。"><title>アトラスの読み解き｜アトラススミス</title><style>
  :root{--ink:#2d302d;--muted:#687169;--line:#d9d6cc;--paper:#fffdf8;--deep:#293e35;--gold:#bd8a34;--wash:#f0f4eb;--shadow:0 18px 44px rgba(45,48,45,.1)}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#faf8f1,#f0f5ee 58%,#fbf8ef);color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;line-height:1.8}a{color:inherit}header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px clamp(20px,5vw,72px);border-bottom:1px solid var(--line);background:rgba(255,253,248,.92)}.brand{display:flex;align-items:center;gap:11px;text-decoration:none;font-weight:900}.mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid #82908a;border-radius:9px;background:linear-gradient(135deg,#39484a,#7d947d);color:#f7d890;font-family:Georgia,serif;font-size:18px}nav{display:flex;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:14px;font-weight:700}nav a{text-decoration:none}.wrap{width:min(1100px,calc(100% - 40px));margin:0 auto}.hero{padding:78px 0 64px;background:linear-gradient(110deg,rgba(39,53,48,.98),rgba(76,105,82,.92) 58%,rgba(177,139,64,.58));color:#fff}.eyebrow{margin:0;color:#e5bf70;font-size:13px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.hero h1{max-width:760px;margin:12px 0 16px;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(40px,7vw,72px);line-height:1.1}.lead{max-width:720px;color:rgba(255,255,255,.92);font-size:clamp(17px,2vw,21px)}section{padding:68px 0}.section-title{max-width:720px;margin-bottom:26px}.section-title h2{margin:7px 0 0;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(30px,4vw,46px);line-height:1.22}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{padding:25px;border:1px solid var(--line);border-radius:10px;background:rgba(255,253,248,.9);box-shadow:var(--shadow)}.card h3{margin:0 0 8px;font-size:21px}.card p{margin:0;color:var(--muted)}.step{display:flex;gap:16px;align-items:flex-start}.number{display:grid;place-items:center;flex:0 0 34px;height:34px;border-radius:7px;background:#e9e3d3;color:#7c5a23;font-weight:900}.notice{margin-top:18px;padding:16px 18px;border-left:4px solid var(--gold);background:#fff3d2;color:#5e625c}.footer{padding:30px clamp(20px,5vw,72px);background:var(--deep);color:#edf4e9;font-size:14px}.footer a{color:#f5d993}@media(max-width:700px){header{align-items:flex-start;flex-direction:column}.wrap{width:min(100% - 32px,1100px)}.grid{grid-template-columns:1fr}.hero{padding:62px 0 48px}section{padding:52px 0}}
  </style></head><body><header><a class="brand" href="/"><span class="mark">A</span><span>アトラススミス<br><small>Raven Guild｜工房と現実整理</small></span></a><nav aria-label="メインナビゲーション"><a href="/">トップ</a><a href="/divination">読み解き</a><a href="/">相談の入口</a></nav></header><main><section class="hero"><div class="wrap"><p class="eyebrow">Atlas Reading Method</p><h1>現実を読み解き、<br>動ける形へ。</h1><p class="lead">アトラスの案内は、未来を断定するためのものではありません。いま起きていることを整理し、制約の中で選べる道と、今日できる一歩を見つけます。</p></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">How Atlas Reads</p><h2>アトラスの読み解き方</h2><p class="muted">相談内容を一つの不安のまま扱わず、現実に触れられる部品へ分けていきます。</p></div><div class="grid"><article class="card step"><span class="number">1</span><div><h3>状況を並べる</h3><p>起きていること、困っていること、すでに試したことを分けます。事実と気持ちを混ぜずに置くことで、問題の輪郭を見つけます。</p></div></article><article class="card step"><span class="number">2</span><div><h3>制約を確認する</h3><p>時間、体力、予算、周囲の事情など、いま動かせない条件を確認します。理想だけで無理な計画を作りません。</p></div></article><article class="card step"><span class="number">3</span><div><h3>選択肢を比較する</h3><p>すぐ動く、準備する、保留する、誰かに頼るなどの選択肢を、負担と効果の両面から見比べます。</p></div></article><article class="card step"><span class="number">4</span><div><h3>次の作業に戻す</h3><p>考え続けるだけで終わらせず、15分から始められる作業や、次に確認する項目へ落とし込みます。</p></div></article></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">For Your Theme</p><h2>相談テーマごとの見方</h2></div><div class="grid"><article class="card"><h3>仕事・計画</h3><p>締切、重要度、必要な道具を分け、最初に着手する一箇所と後回しにする項目を整理します。</p></article><article class="card"><h3>生活の立て直し</h3><p>続かない理由を意志の弱さにせず、環境、時間帯、作業量のどこを調整できるか見直します。</p></article><article class="card"><h3>技術・修理</h3><p>症状、原因の候補、確認できる箇所を切り分け、いきなり全体を作り直さず小さく検証します。</p></article><article class="card"><h3>迷い・優先順位</h3><p>全部を同時に解決しようとせず、今週の負担と効果を比べて、現実的な順番を決めます。</p></article></div><div class="notice"><strong>アトラスの約束：</strong>設定上確定していない特定の占術名や未来の断定を付け足さず、現実整理と実行可能な選択肢に焦点を置きます。</div></div></section></main><footer class="footer"><div class="wrap"><strong>アトラススミス｜Raven Guild</strong><span>　<a href="/">公開サイトへ戻る</a></span></div></footer></body></html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/blog" && request.method === "GET") return proxySharedBlog(request, env, { guild_id: env.STUDIOOS_GUILD_ID, tenant_id: env.STUDIOOS_TENANT_ID, character_id: env.STUDIOOS_CHARACTER_ID, market: "jp", locale: "ja-JP" });
    if (url.pathname === "/api/growth" && request.method === "GET") return proxySharedGrowth(request, env, { guild_id: env.STUDIOOS_GUILD_ID, tenant_id: env.STUDIOOS_TENANT_ID, character_id: env.STUDIOOS_CHARACTER_ID, market: "jp", locale: "ja-JP" });
    if (url.pathname === "/blog" || url.pathname === "/blog/") {
      const response = await proxySharedBlog(new Request(new URL("/api/blog", request.url), { headers: request.headers }), env, { guild_id: env.STUDIOOS_GUILD_ID, tenant_id: env.STUDIOOS_TENANT_ID, character_id: env.STUDIOOS_CHARACTER_ID, market: "jp", locale: "ja-JP" });
      const payload = await response.json() as { articles?: Array<{ slug: string; title: string; excerpt?: string; published_at?: string }> };
      return new Response(renderSharedBlogIndex("アトラスの読みもの", "仕事、生活、計画を現実的な一歩へ整理する案内です。", payload.articles || []), { headers });
    }
    if (url.pathname === "/api/card-library" && (request.method === "GET" || request.method === "POST")) {
      const failure = requireBasicAdmin(request, env.ADMIN_BASIC_AUTH);
      if (failure) return failure;
      return proxySharedCardLibrary(request, env, { guild_id: env.STUDIOOS_GUILD_ID, tenant_id: env.STUDIOOS_TENANT_ID, character_id: env.STUDIOOS_CHARACTER_ID, market: "jp", locale: "ja-JP" });
    }
    if (url.pathname === "/free-fortune" || url.pathname === "/free-fortune/") return new Response(servicePage("free"), { headers });
    if (url.pathname === "/text-reading" || url.pathname === "/text-reading/") return new Response(servicePage("text"), { headers });
    if (url.pathname === "/divination") return new Response(divinationPage(), { headers });
    const response = await baseWorker.fetch(request, env);
    if (url.pathname !== "/" || !response.headers.get("content-type")?.includes("text/html")) return response;
    const html = await response.text();
    return new Response(publicHome(html.replace('</nav>', '<a href="/divination">占術解説</a></nav>')), { status: response.status, headers: response.headers });
  },
};
