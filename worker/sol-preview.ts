import { resolveRuntimeContext } from "../app/lib/studioos-runtime-adapter.ts";
import { renderStudioosAdmin, requireBasicAdmin } from "./studioos-admin.ts";

interface Env {
  DB: D1Database;
  ANALYTICS_DB?: D1Database;
  STUDIOOS_TENANT_ID: string;
  STUDIOOS_CHARACTER_ID: string;
  STUDIOOS_GUILD_ID: string;
  STUDIOOS_ENVIRONMENT: string;
  ADMIN_BASIC_AUTH?: string;
}

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, {
  ...init,
  headers: { "cache-control": "no-store", ...init.headers },
});

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character] || character));

async function count(db: D1Database, table: string, tenantId: string) {
  if (!["analytics_events", "blog_engine_articles"].includes(table)) return 0;
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE tenant_id = ?`)
    .bind(tenantId)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

function page(context: ReturnType<typeof resolveRuntimeContext>, environment: string, blogRows: number, analyticsRows: number) {
  const displayName = escapeHtml(context.character.displayName);
  const cta = escapeHtml(context.config.localization.cta?.default || "小さな一歩を見つける");
  return `<!doctype html>
<html lang="ja-JP">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="ソル・オーロラ。自己肯定感、再出発、小さな一歩を一緒に見つけるRaven Guildの案内役。">
  <title>${displayName}｜朝日のメッセージ</title>
  <style>
    :root{--ink:#26352d;--muted:#65736a;--line:#d9e3d4;--leaf:#527b59;--deep:#233f31;--gold:#c99832;--sun:#fff1c9;--paper:#fffdf8;--shadow:0 20px 50px rgba(44,72,52,.12)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#fffdf8 0%,#f4f8ee 52%,#fffaf0 100%);color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;line-height:1.8}a{color:inherit}
    header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:15px clamp(20px,5vw,72px);border-bottom:1px solid rgba(217,227,212,.9);background:rgba(255,253,248,.9);backdrop-filter:blur(14px)}
    .brand{display:flex;align-items:center;gap:11px;text-decoration:none;font-weight:800;letter-spacing:.03em}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#e6b94f,#fff1b5 55%,#84aa74);color:#fff;font-family:Georgia,serif;font-size:19px;box-shadow:0 7px 15px rgba(201,152,50,.2)}nav{display:flex;flex-wrap:wrap;gap:17px;color:var(--muted);font-size:14px;font-weight:700}nav a{text-decoration:none}nav a:hover{color:var(--leaf)}
    .hero{position:relative;overflow:hidden;padding:clamp(72px,10vw,128px) clamp(20px,7vw,100px);background:linear-gradient(110deg,rgba(35,63,49,.98),rgba(67,108,70,.9) 54%,rgba(225,181,68,.65)),radial-gradient(circle at 82% 34%,rgba(255,247,204,.9),transparent 20rem);color:#fff}.hero:after{content:"";position:absolute;right:8%;top:18%;width:min(290px,38vw);aspect-ratio:1;border:1px solid rgba(255,245,203,.62);border-radius:50%;box-shadow:0 0 0 24px rgba(255,245,203,.08),0 0 0 48px rgba(255,245,203,.06)}.hero-inner{position:relative;z-index:1;max-width:720px}.eyebrow{margin:0;color:var(--gold);font-size:13px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.hero h1{max-width:680px;margin:12px 0 18px;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(42px,7vw,82px);line-height:1.1}.lead{max-width:650px;color:rgba(255,255,255,.92);font-size:clamp(17px,2vw,21px)}.chips{display:flex;flex-wrap:wrap;gap:9px;margin:24px 0 30px}.chips span{border:1px solid rgba(255,245,203,.44);border-radius:999px;padding:6px 11px;background:rgba(255,255,255,.1);font-size:13px;font-weight:800}.button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 19px;border-radius:7px;text-decoration:none;font-weight:900}.primary{background:#fff6d7;color:var(--deep);box-shadow:0 12px 24px rgba(24,51,36,.2)}.secondary{border:1px solid rgba(255,245,203,.55);color:#fff;background:transparent;margin-left:8px}
    section{padding:76px clamp(20px,6vw,88px)}.wrap{width:min(1120px,100%);margin:0 auto}.section-title{max-width:690px;margin-bottom:26px}.section-title h2{margin:6px 0 0;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(30px,4vw,46px);line-height:1.22}.section-title p,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.card{padding:25px;border:1px solid var(--line);border-radius:10px;background:rgba(255,253,248,.88);box-shadow:var(--shadow)}.card h3{margin:0 0 8px;font-size:21px}.card p{margin:0;color:var(--muted)}.number{display:inline-grid;place-items:center;width:29px;height:29px;margin-bottom:14px;border-radius:50%;background:var(--sun);color:#8a651e;font-weight:900}.split{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:stretch}.quote{padding:30px;border-radius:10px;background:linear-gradient(135deg,#fff7d8,#eef6e8);border:1px solid #e4d6a5}.quote strong{display:block;margin-top:11px;font-family:Georgia,serif;font-size:27px;line-height:1.35}.list{display:grid;gap:11px;margin:0;padding:0;list-style:none}.list li{padding:13px 15px;border-left:4px solid #d3a33c;background:rgba(255,255,255,.62)}.notice{margin-top:18px;padding:16px 18px;border-radius:8px;background:#f7f4e8;color:#596458;font-size:14px}.footer{display:flex;justify-content:space-between;gap:20px;padding:34px clamp(20px,6vw,88px);background:var(--deep);color:#edf5e8;font-size:14px}.footer a{color:#fff1c9;text-decoration:none}.footer nav{color:#dce9d6}
    @media(max-width:760px){header{align-items:flex-start;flex-direction:column}header nav{width:100%;gap:11px;font-size:13px}.hero{padding-top:76px}.hero:after{right:-40px;top:9%;width:210px;opacity:.55}.secondary{margin:10px 0 0}.split{grid-template-columns:1fr}section{padding-block:58px}.footer{display:grid}}
  </style>
</head>
<body>
  <header><a class="brand" href="#top"><span class="mark">S</span><span>ソル・オーロラ<br><small class="muted">Raven Guild｜希望の案内役</small></span></a><nav aria-label="メインナビゲーション"><a href="#about">ソルについて</a><a href="#reading">相談の入口</a><a href="#steps">読み方</a><a href="#notes">ご案内</a></nav></header>
  <main id="top">
    <section class="hero"><div class="hero-inner"><p class="eyebrow">Sunrise message · Raven Guild</p><h1>今日を越える、<br>小さな一歩を。</h1><p class="lead">ソル・オーロラは、自己肯定感や再出発のきっかけを探す人のための案内役。気持ちを無理に明るくせず、今の自分にできる一歩を一緒に見つけます。</p><div class="chips"><span>自己肯定感</span><span>新しい始まり</span><span>気持ちの切り替え</span></div><a class="button primary" href="#reading">${cta}</a><a class="button secondary" href="#about">ソルの役割を見る</a></div></section>
    <section id="about"><div class="wrap split"><div class="quote"><p class="eyebrow">Sol Aurora</p><strong>希望は、遠くにある答えではなく、今日できることの中に。</strong><p class="muted">押しつけない励ましと、明日へ続く現実的な言葉を届けます。</p></div><div><div class="section-title"><p class="eyebrow">Character Core</p><h2>ソル・オーロラの担当領域</h2></div><p>ソルはRaven Guildで希望を届ける活動、広報、イベントを担当するムードメーカーです。落ち込んだ気持ちを急いで変えるのではなく、安心できる場所から少しずつ前を向くための整理を得意とします。</p><ul class="list"><li><b>役割：</b>希望・広報・イベント担当</li><li><b>得意：</b>自己肯定感、再出発、小さな一歩</li><li><b>好きなこと：</b>朝のあいさつ、歌の練習、お菓子作り</li></ul></div></div></section>
    <section id="reading"><div class="wrap"><div class="section-title"><p class="eyebrow">相談の入口</p><h2>いまの気持ちから選ぶ</h2><p>うまく説明できなくても大丈夫です。いちばん近い入口から、現在地をゆっくり言葉にしていきます。</p></div><div class="grid"><article class="card"><h3>自分を責めてしまう</h3><p>できなかったことだけに目が向くとき、今も残っている力と、明日へ持っていくものを整理します。</p></article><article class="card"><h3>再出発したい</h3><p>大きな決断を急がず、環境・気持ち・最初に試せる行動を分けて見直します。</p></article><article class="card"><h3>一歩が決められない</h3><p>選択肢を小さく分解し、負担が少なく、あとから振り返れる一歩を探します。</p></article></div></div></section>
    <section id="steps"><div class="wrap"><div class="section-title"><p class="eyebrow">How it works</p><h2>ソルとの読み方</h2></div><div class="grid"><article class="card"><span class="number">1</span><h3>気持ちをそのまま置く</h3><p>まとまっていない不安や迷いも、そのまま相談の入口になります。</p></article><article class="card"><span class="number">2</span><h3>今の状態を分けて見る</h3><p>感情、周囲の状況、できることを混ぜずに整理し、無理のない順番をつくります。</p></article><article class="card"><span class="number">3</span><h3>小さな行動へ戻る</h3><p>結果を断定するのではなく、今日から試せる一歩と、休む選択肢を確認します。</p></article></div></div></section>
    <section id="notes"><div class="wrap split"><div><div class="section-title"><p class="eyebrow">A gentle boundary</p><h2>明るさを無理に選ばない</h2></div><p>ソルの言葉は、つらさを軽く扱ったり、前向きさを押しつけたりするためのものではありません。今日は休む、誰かに頼る、保留にすることも、必要な一歩として扱います。</p><div class="notice">医療・法律・投資など専門家の判断が必要な内容は、占いだけで決めず、適切な専門機関へ相談してください。</div></div><div class="card"><h3>現在の提供状態</h3><ul class="list"><li>ブログ：${blogRows}件</li><li>内部Analytics：${analyticsRows}件</li><li>広報・SNS：OFF</li><li>Growth：READ-ONLY</li><li>環境：${escapeHtml(environment)}</li></ul></div></div></section>
  </main>
  <footer class="footer"><strong>ソル・オーロラ｜Raven Guild</strong><nav><a href="#top">ページ上部へ</a><a href="#reading">相談の入口</a><a href="#notes">ご案内</a></nav></footer>
</body></html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const tenantId = env.STUDIOOS_TENANT_ID;
    const context = resolveRuntimeContext({ tenantHint: tenantId });
    if (context.character.characterId !== env.STUDIOOS_CHARACTER_ID || context.config.guildId !== env.STUDIOOS_GUILD_ID) {
      return json({ error: "runtime identity mismatch" }, { status: 500 });
    }

    const url = new URL(request.url);
    if (url.pathname === "/api/preview/status") {
      const [analyticsRows, blogRows] = await Promise.all([
        env.ANALYTICS_DB ? count(env.ANALYTICS_DB, "analytics_events", tenantId) : count(env.DB, "analytics_events", tenantId),
        count(env.DB, "blog_engine_articles", tenantId),
      ]);
      return json({
        tenantId: context.tenantId,
        characterId: context.character.characterId,
        guildId: context.config.guildId,
        locale: context.localization.locale,
        environment: env.STUDIOOS_ENVIRONMENT,
        activation: { coreSite: true, member: "read-only", analyticsInternal: true, blog: true, blogScheduler: false, sns: false, reel: false, growth: "read-only", openingCampaign: false, trial: false },
        growthSafety: { executionAllowed: false, requiresStartApproval: true, autoStart: false },
        externalWrites: false,
        ravenContamination: false,
        lunaContamination: false,
        scarletContamination: false,
        atlasContamination: false,
        data: { analyticsRows, blogRows },
      });
    }
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      const authenticationFailure = requireBasicAdmin(request, env.ADMIN_BASIC_AUTH);
      if (authenticationFailure) return authenticationFailure;
      const [analyticsRows, blogRows] = await Promise.all([
        env.ANALYTICS_DB ? count(env.ANALYTICS_DB, "analytics_events", tenantId) : count(env.DB, "analytics_events", tenantId),
        count(env.DB, "blog_engine_articles", tenantId),
      ]);
      return new Response(renderStudioosAdmin({
        tenantId: context.tenantId,
        characterId: context.character.characterId,
        displayName: context.character.displayName,
        guildId: context.config.guildId,
        locale: context.localization.locale,
      }, env.STUDIOOS_ENVIRONMENT, blogRows, analyticsRows), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/") {
      const [analyticsRows, blogRows] = await Promise.all([
        env.ANALYTICS_DB ? count(env.ANALYTICS_DB, "analytics_events", tenantId) : count(env.DB, "analytics_events", tenantId),
        count(env.DB, "blog_engine_articles", tenantId),
      ]);
      return new Response(page(context, env.STUDIOOS_ENVIRONMENT, blogRows, analyticsRows), { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return json({ error: "not found" }, { status: 404 });
  },
};
