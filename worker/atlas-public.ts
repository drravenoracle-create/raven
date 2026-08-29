import baseWorker from "./atlas-preview.ts";

interface Env {
  DB: D1Database;
  ANALYTICS_DB?: D1Database;
  STUDIOOS_TENANT_ID: string;
  STUDIOOS_CHARACTER_ID: string;
  STUDIOOS_GUILD_ID: string;
  STUDIOOS_ENVIRONMENT: string;
  ADMIN_BASIC_AUTH?: string;
}

const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };

function publicHome(html: string) {
  return html.replace(/<h3>現在の提供状態<\/h3><ul class="list">[\s\S]*?<\/ul>/, '<h3>ご利用案内</h3><ul class="list"><li>ブログ：準備中です</li><li>相談：現実整理の入口をご案内します</li><li>広報：公式のお知らせでご案内します</li><li>ご利用時間：いつでもご覧いただけます</li></ul>');
}

function divinationPage() {
  return `<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="アトラススミスの現実整理型の読み解き。状況、制約、選択肢を分け、今日できる一歩へつなげます。"><title>アトラスの読み解き｜アトラススミス</title><style>
  :root{--ink:#2d302d;--muted:#687169;--line:#d9d6cc;--paper:#fffdf8;--deep:#293e35;--gold:#bd8a34;--wash:#f0f4eb;--shadow:0 18px 44px rgba(45,48,45,.1)}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#faf8f1,#f0f5ee 58%,#fbf8ef);color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;line-height:1.8}a{color:inherit}header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px clamp(20px,5vw,72px);border-bottom:1px solid var(--line);background:rgba(255,253,248,.92)}.brand{display:flex;align-items:center;gap:11px;text-decoration:none;font-weight:900}.mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid #82908a;border-radius:9px;background:linear-gradient(135deg,#39484a,#7d947d);color:#f7d890;font-family:Georgia,serif;font-size:18px}nav{display:flex;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:14px;font-weight:700}nav a{text-decoration:none}.wrap{width:min(1100px,calc(100% - 40px));margin:0 auto}.hero{padding:78px 0 64px;background:linear-gradient(110deg,rgba(39,53,48,.98),rgba(76,105,82,.92) 58%,rgba(177,139,64,.58));color:#fff}.eyebrow{margin:0;color:#e5bf70;font-size:13px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.hero h1{max-width:760px;margin:12px 0 16px;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(40px,7vw,72px);line-height:1.1}.lead{max-width:720px;color:rgba(255,255,255,.92);font-size:clamp(17px,2vw,21px)}section{padding:68px 0}.section-title{max-width:720px;margin-bottom:26px}.section-title h2{margin:7px 0 0;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(30px,4vw,46px);line-height:1.22}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{padding:25px;border:1px solid var(--line);border-radius:10px;background:rgba(255,253,248,.9);box-shadow:var(--shadow)}.card h3{margin:0 0 8px;font-size:21px}.card p{margin:0;color:var(--muted)}.step{display:flex;gap:16px;align-items:flex-start}.number{display:grid;place-items:center;flex:0 0 34px;height:34px;border-radius:7px;background:#e9e3d3;color:#7c5a23;font-weight:900}.notice{margin-top:18px;padding:16px 18px;border-left:4px solid var(--gold);background:#fff3d2;color:#5e625c}.footer{padding:30px clamp(20px,5vw,72px);background:var(--deep);color:#edf4e9;font-size:14px}.footer a{color:#f5d993}@media(max-width:700px){header{align-items:flex-start;flex-direction:column}.wrap{width:min(100% - 32px,1100px)}.grid{grid-template-columns:1fr}.hero{padding:62px 0 48px}section{padding:52px 0}}
  </style></head><body><header><a class="brand" href="/"><span class="mark">A</span><span>アトラススミス<br><small>Raven Guild｜工房と現実整理</small></span></a><nav aria-label="メインナビゲーション"><a href="/">トップ</a><a href="/divination">読み解き</a><a href="/">相談の入口</a></nav></header><main><section class="hero"><div class="wrap"><p class="eyebrow">Atlas Reading Method</p><h1>現実を読み解き、<br>動ける形へ。</h1><p class="lead">アトラスの案内は、未来を断定するためのものではありません。いま起きていることを整理し、制約の中で選べる道と、今日できる一歩を見つけます。</p></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">How Atlas Reads</p><h2>アトラスの読み解き方</h2><p class="muted">相談内容を一つの不安のまま扱わず、現実に触れられる部品へ分けていきます。</p></div><div class="grid"><article class="card step"><span class="number">1</span><div><h3>状況を並べる</h3><p>起きていること、困っていること、すでに試したことを分けます。事実と気持ちを混ぜずに置くことで、問題の輪郭を見つけます。</p></div></article><article class="card step"><span class="number">2</span><div><h3>制約を確認する</h3><p>時間、体力、予算、周囲の事情など、いま動かせない条件を確認します。理想だけで無理な計画を作りません。</p></div></article><article class="card step"><span class="number">3</span><div><h3>選択肢を比較する</h3><p>すぐ動く、準備する、保留する、誰かに頼るなどの選択肢を、負担と効果の両面から見比べます。</p></div></article><article class="card step"><span class="number">4</span><div><h3>次の作業に戻す</h3><p>考え続けるだけで終わらせず、15分から始められる作業や、次に確認する項目へ落とし込みます。</p></div></article></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">For Your Theme</p><h2>相談テーマごとの見方</h2></div><div class="grid"><article class="card"><h3>仕事・計画</h3><p>締切、重要度、必要な道具を分け、最初に着手する一箇所と後回しにする項目を整理します。</p></article><article class="card"><h3>生活の立て直し</h3><p>続かない理由を意志の弱さにせず、環境、時間帯、作業量のどこを調整できるか見直します。</p></article><article class="card"><h3>技術・修理</h3><p>症状、原因の候補、確認できる箇所を切り分け、いきなり全体を作り直さず小さく検証します。</p></article><article class="card"><h3>迷い・優先順位</h3><p>全部を同時に解決しようとせず、今週の負担と効果を比べて、現実的な順番を決めます。</p></article></div><div class="notice"><strong>アトラスの約束：</strong>設定上確定していない特定の占術名や未来の断定を付け足さず、現実整理と実行可能な選択肢に焦点を置きます。</div></div></section></main><footer class="footer"><div class="wrap"><strong>アトラススミス｜Raven Guild</strong><span>　<a href="/">公開サイトへ戻る</a></span></div></footer></body></html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/divination") return new Response(divinationPage(), { headers });
    const response = await baseWorker.fetch(request, env);
    if (url.pathname !== "/" || !response.headers.get("content-type")?.includes("text/html")) return response;
    const html = await response.text();
    return new Response(publicHome(html.replace('</nav>', '<a href="/divination">占術解説</a></nav>')), { status: response.status, headers: response.headers });
  },
};
