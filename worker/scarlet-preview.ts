import { resolveRuntimeContext } from "../app/lib/studioos-runtime-adapter.ts";
import { renderStudioosAdmin, requireBasicAdmin } from "./studioos-admin.ts";

interface Env {
  DB: D1Database;
  MEMBER_CORE?: { fetch(request: Request): Promise<Response> };
  GUILD_MEMBER_API_BASE_URL?: string;
  STUDIOOS_TENANT_ID: string;
  STUDIOOS_CHARACTER_ID: string;
  STUDIOOS_GUILD_ID: string;
  STUDIOOS_ENVIRONMENT: string;
  ADMIN_BASIC_AUTH?: string;
}

const TENANT_ID = "scarlet-donovan";
const CHARACTER_ID = "scarlet";
const GUILD_ID = "raven-guild";
const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { "cache-control": "no-store", ...init.headers } });
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char] || char));
const htmlHeaders = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };

const scarletFreeMenus = [
  ["境界線チェック", "いま守るべき線、引き受けすぎていること、距離を置いてよい場所を短く確認します。"],
  ["恋愛の距離感", "近づく、待つ、離れるのどこに力を使うべきか、感情と現実を分けて見ます。"],
  ["決断前の整理", "言うべきこと、まだ黙ってよいこと、今日決めなくてよいことを切り分けます。"],
  ["消耗リセット", "人間関係で削られている時、自分を守るために戻る場所を確認します。"],
];

const scarletTextMenus = [
  ["相手から来た文章", "言葉の圧、境界線を越えている箇所、返信前に整える視点を読みます。"],
  ["送る前の文章チェック", "強すぎる表現、弱すぎる主張、相手へ渡すべき要点を整えます。"],
  ["関係整理の相談文", "離れる、続ける、距離を変える判断を、気持ちと現実の両面から整理します。"],
  ["マヤ暦・資質相談", "役割、反応の癖、関係の中で消耗しやすいポイントを見ます。"],
  ["インド占星術の現実整理", "月、ラグナ、ハウス、ダシャーを手がかりに、今無理なく選べる一歩を見ます。"],
];

function scarletShell(title: string, main: string) {
  return `<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><title>${esc(title)}｜Scarlet Donovan</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Scarlet Donovanの鑑定サイト。境界線、守り、決断、人間関係の距離感を静かに整理します。"><style>
  :root{--ink:#2a2323;--paper:#fff8f0;--muted:#806e68;--line:rgba(159,105,101,.25);--wine:#5e2430;--rose:#d8b7a7;--gold:#d2a45f;--shadow:0 22px 60px rgba(49,25,28,.18)}
  *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#fff8f0 0%,#f7ede7 48%,#fffaf5 100%);color:var(--ink);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;line-height:1.82}a{color:inherit}header{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;gap:20px;align-items:center;padding:16px clamp(20px,5vw,72px);border-bottom:1px solid var(--line);background:rgba(255,248,240,.9);backdrop-filter:blur(14px)}.brand{text-decoration:none;font-weight:900;letter-spacing:.02em}nav{display:flex;gap:15px;flex-wrap:wrap;color:#7b4a4a;font-weight:900;font-size:14px}nav a{text-decoration:none}.hero{position:relative;overflow:hidden;padding:clamp(72px,10vw,124px) clamp(20px,6vw,88px);background:linear-gradient(120deg,rgba(33,31,30,.98),rgba(94,36,48,.94) 54%,rgba(216,183,167,.58));color:#fff}.hero:after{content:"";position:absolute;right:8%;top:18%;width:min(310px,38vw);aspect-ratio:1;border:1px solid rgba(216,183,167,.58);border-radius:50%;box-shadow:0 0 0 26px rgba(216,183,167,.08),0 0 0 52px rgba(216,183,167,.05)}.wrap{position:relative;z-index:1;width:min(1120px,100%);margin:0 auto}.eyebrow{margin:0;color:var(--gold);font-size:13px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}h1{margin:12px 0 18px;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(42px,7vw,78px);line-height:1.08}.lead{max-width:720px;color:rgba(255,255,255,.92);font-size:clamp(17px,2vw,21px)}section{padding:74px clamp(20px,6vw,88px)}.section-title{max-width:780px;margin-bottom:28px}.section-title h2{margin:6px 0 0;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(30px,4vw,46px);line-height:1.2}.section-title p,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:18px}.card{display:flex;flex-direction:column;min-height:230px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.92);padding:25px;box-shadow:var(--shadow)}.card h3{margin:0 0 8px;font-size:21px}.card p{color:var(--muted)}.button{display:inline-flex;align-items:center;justify-content:center;min-height:45px;margin-top:auto;padding:11px 18px;border-radius:8px;background:linear-gradient(135deg,var(--wine),#8d4353);color:#fff;text-decoration:none;font-weight:900}.secondary{background:#fff;color:var(--wine);border:1px solid var(--line)}.chips{display:flex;flex-wrap:wrap;gap:9px;margin:24px 0 30px}.chips span{padding:7px 12px;border:1px solid rgba(216,183,167,.48);border-radius:999px;background:rgba(255,255,255,.12);font-size:13px;font-weight:900}.split{display:grid;grid-template-columns:1fr 1fr;gap:24px}.notice{margin-top:20px;padding:18px 20px;border-left:4px solid var(--gold);background:#fff4dc;color:#6c5750}.footer{display:flex;justify-content:space-between;gap:18px;padding:32px clamp(20px,6vw,88px);background:#211f1e;color:#f8f1e8}.footer a{color:var(--rose);text-decoration:none}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}.split{grid-template-columns:1fr}.hero:after{right:-48px;top:8%;width:210px;opacity:.58}}
  </style></head><body><header><a class="brand" href="/">Scarlet Donovan</a><nav><a href="/">トップ</a><a href="/free-fortune/">無料占い</a><a href="/text-reading/">AIテキスト鑑定</a><a href="/divination/">占術</a><a href="/guild-members/">ギルド</a></nav></header>${main}<footer class="footer"><strong>Scarlet Donovan</strong><nav><a href="/">トップ</a><a href="/free-fortune/">無料占い</a><a href="/text-reading/">AIテキスト鑑定</a><a href="/divination/">占術</a></nav></footer></body></html>`;
}

function scarletMenuCards(items: string[][], href: string, label: string) {
  return `<div class="grid">${items.map(([title, body]) => `<article class="card"><h3>${esc(title)}</h3><p>${esc(body)}</p><a class="button" href="${href}">${label}</a></article>`).join("")}</div>`;
}

function renderScarletHome() {
  return scarletShell("境界線と守りの鑑定", `<main><section class="hero"><div class="wrap"><p class="eyebrow">Sword and Flowers</p><h1>剣は抜かず、<br>花は折らない。</h1><p class="lead">スカーレット・ドノバンは、恋愛や人間関係で自分をすり減らしている人へ、境界線、守り、決断の順番を静かに整える案内役です。</p><div class="chips"><span>無料占い</span><span>AIテキスト鑑定 トライアル価格 ¥0</span><span>マヤ暦</span><span>インド占星術</span></div><a class="button" href="/text-reading/">AIテキスト鑑定トライアルへ</a> <a class="button secondary" href="/free-fortune/">無料占いを見る</a></div></section><section><div class="wrap split"><div><p class="eyebrow">Scarlet Donovan</p><h2>優しさを、消耗に変えないために。</h2><p>スカーレットの鑑定は、相手を責めるためでも、怖い未来を決めつけるためでもありません。自分が引き受けること、断ってよいこと、今は保留してよいことを分け、関係の中で守るべき線を見つけます。</p></div><div class="card"><h3>得意な相談</h3><p>恋愛の距離感、復縁前の境界線、相手から来た文章、送る前の一文、家族や職場での消耗、決断前の整理。</p></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Menu Guide</p><h2>無料占いとAIテキスト鑑定</h2><p>無料占いは、境界線や距離感を短く確認する入口です。相談文や相手の文章を入力して深く読む場合は、AIテキスト鑑定トライアルへ進みます。</p></div><div class="grid"><article class="card"><p class="eyebrow">Free Fortune</p><h3>無料占い</h3><p>境界線、恋愛の距離感、決断前の迷い、消耗のリセットを短く見ます。まず自分の状態を軽く確かめたい人向けです。</p><a class="button" href="/free-fortune/">無料占いを見る</a></article><article class="card"><p class="eyebrow">AI Text Reading</p><h3>AIテキスト鑑定</h3><p>相手の文章、送る前の文章、関係整理の相談文を、守りと決断の視点で読みます。現在はトライアル価格 ¥0 です。</p><a class="button" href="/text-reading/">AIテキスト鑑定トライアルへ</a></article><article class="card"><p class="eyebrow">Guild</p><h3>他メンバーの得意分野へ</h3><p>恋愛の星読みはLuna、現実整理はAtlas、再出発はSolへ。相談内容に合わせて選べます。</p><a class="button" href="/guild-members/">ギルドを見る</a></article></div></div></section></main>`);
}

function renderScarletService(type: "free" | "text") {
  const isFree = type === "free";
  const title = isFree ? "無料占い" : "AIテキスト鑑定";
  const lead = isFree ? "守る線、距離感、決断前の迷いを短く確認します。相談文を入力して深く読むAIテキスト鑑定とは別の、気軽な入口です。" : "相手から来た文章、送る前の文章、関係整理の相談文を深く読みます。現在はトライアル価格 ¥0 です。";
  const content = isFree
    ? scarletMenuCards(scarletFreeMenus, "/free-fortune/", "無料占いを見る")
    : scarletMenuCards(scarletTextMenus, "/text-reading/", "AIテキスト鑑定トライアルへ");
  return scarletShell(title, `<main><section class="hero"><div class="wrap"><p class="eyebrow">${isFree ? "Free Fortune" : "AI Text Reading"}</p><h1>${title}</h1><p class="lead">${lead}</p><div class="chips"><span>${isFree ? "無料占い" : "トライアル価格 ¥0"}</span><span>境界線</span><span>守りの言葉</span></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Choose</p><h2>${isFree ? "無料占いメニュー" : "AIテキスト鑑定メニュー"}</h2><p>${isFree ? "短く整えたいテーマを選んでください。個別相談を深く読む場合はAIテキスト鑑定へ進めます。" : "相談内容に近いメニューを選ぶと、入力型のAIテキスト鑑定へ進めます。全メニューの価格表示はトライアル価格 ¥0 です。"}</p></div>${content}<div class="notice">${isFree ? "無料占いは軽く確認する入口です。長文相談、相手の文章、送る前の言葉の調整はAIテキスト鑑定で扱います。" : "まずは「守る線」「伝える言葉」「待つ時間」のどれを整えたいかを決めてください。"}</div></div></section></main>`);
}

function renderScarletDivination() {
  return scarletShell("スカーレットの占術", `<main><section class="hero"><div class="wrap"><p class="eyebrow">Divination Method</p><h1>守る力を、<br>読み解きに変える。</h1><p class="lead">スカーレットの占術は、相手を裁くためではなく、自分の境界線を取り戻すために使います。感情、役割、時間、言葉の圧を分け、関係の中で無理なく選べる一歩へ戻します。</p><div class="chips"><span>マヤ暦</span><span>インド占星術</span><span>文章鑑定</span><span>境界線</span></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Mayan Calendar</p><h2>マヤ暦で見る、資質と関係のリズム</h2><p>マヤ暦では、相談者がどんな反応をしやすいか、どんな役割を背負いやすいか、関係の中でどこに力を使いすぎるかを見ます。</p></div><div class="grid"><article class="card"><h3>資質</h3><p>自分が自然に引き受ける役割、周囲に求められやすい立場、疲れやすい関係の型を確認します。</p></article><article class="card"><h3>関係性</h3><p>相手との違いを善悪にせず、どちらが何を急ぎ、どちらが何を守ろうとしているのかを読みます。</p></article><article class="card"><h3>流れ</h3><p>今は押す時か、整える時か、距離を置く時か。行動の強さと待つ意味を切り分けます。</p></article></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Vedic Astrology</p><h2>インド占星術で見る、心の癖と時間の課題</h2><p>出生図、月、ラグナ、ハウス、ダシャーを手がかりに、感情の反応と現実の時間を重ねて読みます。</p></div><div class="grid"><article class="card"><h3>月</h3><p>安心を感じる条件、不安になりやすい場面、相手へ期待しすぎるポイントを見ます。</p></article><article class="card"><h3>ラグナとハウス</h3><p>関係の入口、自分の見せ方、問題が起きている生活領域を確認します。出生時間が曖昧な時は断定を弱めます。</p></article><article class="card"><h3>ダシャー</h3><p>すぐに決めるべきことと、時間をかけた方がよいことを分けます。焦りを未来予測にすり替えません。</p></article></div></div></section><section><div class="wrap split"><div><p class="eyebrow">Text Reading</p><h2>文章に出る、境界線の揺れを読む</h2><p>相手から来た文章や送る前の文章には、距離感、圧、遠慮、期待、諦めがにじみます。スカーレットは、文章の勝ち負けではなく「何を守るための言葉か」を読みます。</p></div><div class="card"><h3>読みの順番</h3><p>まず事実と感情を分け、次に言いすぎ・飲み込みすぎ・曖昧な約束を確認します。最後に、伝える一文、保留する一文、言わなくてよい一文へ整理します。</p><a class="button" href="/text-reading/">AIテキスト鑑定へ</a></div></div></section></main>`);
}

const guildMembers = [
  ["Raven Blackwood", "レイヴン・ブラックウッド", "ギルド創設者・総合鑑定", "冷静な戦略眼と古典占術で、相談者が恐れではなく判断軸から次の一歩を選べるよう導きます。", "https://raven.fortunestudios.jp/guild/"],
  ["Luna Starwind", "ルナ・スターウィンド", "月と花の相談役", "恋愛や人間関係で揺れる気持ちを、ホロスコープからやさしく整理します。言えない本音を急がせず、相談者の心へ戻す案内役です。", "https://luna.fortunestudios.jp/"],
  ["Scarlet Donovan", "スカーレット・ドノバン", "境界線と守りの相談役", "距離感、決断、守る力を扱います。人間関係で自分をすり減らしている人に、守るべき線を思い出させます。", "/guild-members/"],
  ["Atlas Smith", "アトラス・スミス", "現実整理と修理の相談役", "仕事、生活、計画整理に強いメンバーです。抽象的な不安を分解し、今日できる作業と整える順番へ落とし込みます。", "https://atlas-oracle.fortune-kanri.workers.dev/guild"],
  ["Sol Aurora", "ソル・オーロラ", "希望と再出発の相談役", "自己肯定感、新しい始まり、気持ちの切り替えを扱います。不安の中でも小さな希望を見つけ、次の一歩につなげます。", "https://sol-oracle.fortune-kanri.workers.dev/guild"],
];

function renderGuild() {
  const cards = guildMembers.map(([name, nameJa, role, body, href]) => `<article class="member"><p class="eyebrow">${esc(role)}</p><h2><a href="${esc(href)}">${esc(name)}</a></h2><p class="ja">${esc(nameJa)}</p><p>${esc(body)}</p></article>`).join("");
  return `<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><title>ギルドメンバー紹介｜Scarlet Donovan</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Raven Guildのメンバー紹介。レイヴン、ルナ、スカーレット、アトラス、ソルの役割を紹介します。"><style>body{margin:0;background:#211f1e;color:#f8f1e8;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.8}a{color:inherit}header{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:18px clamp(20px,5vw,72px);border-bottom:1px solid rgba(216,183,167,.24);background:#211f1e}.brand{text-decoration:none;font-weight:900}nav{display:flex;gap:14px;flex-wrap:wrap;color:#d8b7a7;font-weight:800}nav a{text-decoration:none}main{padding:70px clamp(20px,6vw,88px)}.wrap{width:min(1120px,100%);margin:0 auto}.eyebrow{color:#d8b7a7;font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}h1{max-width:820px;margin:12px 0 18px;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(40px,7vw,74px);line-height:1.08}.lead{max-width:760px;color:#e7d8cc;font-size:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:34px}.member{border:1px solid rgba(216,183,167,.32);border-radius:10px;background:linear-gradient(145deg,#2a2d2a,#4b2530);padding:24px;box-shadow:0 18px 48px rgba(0,0,0,.22)}.member h2{margin:6px 0 0;font-size:22px}.member p{color:#e7d8cc}.member .ja{color:#fff8ef;font-weight:900}.note{margin-top:24px;border-left:4px solid #d8b7a7;background:#fff8f0;color:#382c2b;padding:18px 20px;border-radius:8px}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}}</style></head><body><header><a class="brand" href="/">Scarlet Donovan</a><nav><a href="/">トップ</a><a href="/guild-members/">ギルド</a></nav></header><main><div class="wrap"><p class="eyebrow">Raven Guild</p><h1>ギルドメンバー紹介</h1><p class="lead">Raven Guildは、相談内容に合わせて異なる得意分野を持つ案内役が支える占いギルドです。スカーレットは境界線と守りの視点から、迷いを急がせず現実の選択へ戻します。</p><div class="grid">${cards}</div><div class="note">現在のギルドメンバーは5名です。Raven Blackwood、Luna Starwind、Scarlet Donovan、Atlas Smith、Sol Auroraで構成しています。</div></div></main></body></html>`;
}

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
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      const authenticationFailure = requireBasicAdmin(request, env.ADMIN_BASIC_AUTH);
      if (authenticationFailure) return authenticationFailure;
      const [analyticsRows, blogRows] = await Promise.all([count(env.DB, "analytics_events"), count(env.DB, "blog_engine_articles")]);
      return new Response(renderStudioosAdmin({
        tenantId: context.tenantId,
        characterId: context.character.characterId,
        displayName: context.character.displayName,
        guildId: context.config.guildId,
        locale: context.localization.locale,
      }, env.STUDIOOS_ENVIRONMENT, blogRows, analyticsRows), { headers: htmlHeaders });
    }
    if (url.pathname === "/free-fortune" || url.pathname === "/free-fortune/") return new Response(renderScarletService("free"), { headers: htmlHeaders });
    if (url.pathname === "/text-reading" || url.pathname === "/text-reading/") return new Response(renderScarletService("text"), { headers: htmlHeaders });
    if (url.pathname === "/divination" || url.pathname === "/divination/") return new Response(renderScarletDivination(), { headers: htmlHeaders });
    if (url.pathname === "/guild" || url.pathname === "/guild/" || url.pathname === "/guild-members" || url.pathname === "/guild-members/") {
      return new Response(renderGuild(), { headers: htmlHeaders });
    }
    if (url.pathname.startsWith("/blog/")) {
      const slug = decodeURIComponent(url.pathname.slice("/blog/".length));
      const article = await env.DB.prepare("SELECT slug, title, locale, status, created_at, published_at FROM blog_engine_articles WHERE tenant_id = ? AND slug = ? LIMIT 1").bind(TENANT_ID, slug).first();
      return article ? json({ tenantId: TENANT_ID, article, readOnly: true }) : json({ error: "article not found" }, { status: 404 });
    }
    if (url.pathname !== "/") return json({ error: "not found" }, { status: 404 });
    return new Response(renderScarletHome(), { headers: htmlHeaders });
  },
};
