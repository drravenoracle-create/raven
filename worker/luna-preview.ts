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

export async function forwardMemberRead(request: Request, env: Pick<Env, "GUILD_MEMBER_API_BASE_URL" | "MEMBER_CORE">) {
  const path = memberReadPath(new URL(request.url).pathname);
  const baseUrl = memberCoreBaseUrl(env);
  if (!path || request.method !== "GET") return json({ ok: false, error: "Member read-only endpoint required.", code: "member_read_only" }, { status: 403 });
  if (!env.MEMBER_CORE && !baseUrl) return json({ ok: false, error: "Member Core is temporarily unavailable.", code: "member_core_unavailable" }, { status: 503 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const upstreamRequest = new Request(`https://guild-member-core.internal${path}${new URL(request.url).search}`, {
      method: "GET",
      headers: memberHeaders(request),
    });
    const response = await (env.MEMBER_CORE
      ? env.MEMBER_CORE.fetch(upstreamRequest)
      : fetch(`${baseUrl}${path}${new URL(request.url).search}`, { signal: controller.signal, headers: upstreamRequest.headers }));
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

const escapeHtml = (value: unknown = "") => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[char] || char);

const formatDate = (value: unknown) => {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

type BlogArticle = {
  slug: string;
  title: string;
  description?: string;
  body?: string;
  published_at?: string;
  created_at?: string;
};

const css = `
:root{--ink:#302634;--muted:#796676;--line:#f0dce7;--primary:#8f4f83;--gold:#d8a657;--coral:#e9928d;--shadow:0 18px 44px rgba(93,57,89,.12)}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#fff7fb 0%,#fffaf3 44%,#f8fbf6 78%,#fff7fb 100%);color:var(--ink);font-family:"Noto Sans JP",system-ui,sans-serif;line-height:1.75}a{color:inherit}
header{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px clamp(18px,4vw,56px);border-bottom:1px solid var(--line);background:rgba(255,247,251,.92);backdrop-filter:blur(14px)}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:800}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,var(--primary),#c27ca4 58%,var(--gold));color:#fff;font-family:Georgia,serif}
nav{display:flex;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:14px;font-weight:700}nav a{text-decoration:none}.hero{position:relative;min-height:76vh;display:grid;align-items:center;padding:clamp(76px,9vw,116px) clamp(20px,6vw,88px);color:#fff;background:linear-gradient(105deg,rgba(52,34,60,.96),rgba(116,61,104,.84) 48%,rgba(216,166,87,.42)),radial-gradient(circle at 78% 36%,rgba(255,241,213,.28),transparent 24%),#51355f;overflow:hidden}
.hero:after{content:"";position:absolute;right:clamp(28px,8vw,130px);top:20%;width:min(330px,44vw);aspect-ratio:1;border:1px solid rgba(255,241,213,.42);border-radius:50%;background:radial-gradient(circle at 54% 42%,#fff 0 8%,transparent 9%),radial-gradient(circle at 50% 50%,transparent 0 34%,rgba(255,241,213,.75) 35% 37%,transparent 38%);opacity:.84}.hero>div{position:relative;z-index:1;max-width:760px}
.eyebrow{margin:0 0 8px;color:var(--gold);font-weight:800}.hero h1{margin:8px 0 18px;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(44px,7vw,82px);line-height:1.08}.lead{max-width:680px;font-size:clamp(17px,2vw,21px);color:rgba(255,255,255,.92)}.chips{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0 30px}.chips span{padding:7px 12px;border:1px solid rgba(255,241,213,.42);border-radius:999px;background:rgba(255,255,255,.12);color:#fff8e7;font-size:13px;font-weight:800}
.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 20px;border:1px solid var(--primary);border-radius:8px;text-decoration:none;font-weight:800}.primary{border-color:transparent;background:linear-gradient(135deg,var(--primary),#bd78a4 58%,var(--coral));color:#fff;box-shadow:0 12px 28px rgba(143,79,131,.26)}.secondary{background:rgba(255,255,255,.94);color:var(--primary)}
section{padding:76px clamp(20px,5vw,72px)}section:nth-of-type(odd):not(.hero){background:linear-gradient(180deg,rgba(248,220,233,.28),rgba(232,239,228,.22))}.wrap{width:min(1120px,100%);margin:0 auto}.section-title h2{margin:0 0 24px;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(30px,4vw,46px);line-height:1.2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:18px}.card,.split,.article{border:1px solid var(--line);border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,250,253,.98));box-shadow:var(--shadow)}.card,.article{padding:24px}.split{display:grid;grid-template-columns:1.05fr .95fr;gap:28px;padding:28px;background:linear-gradient(135deg,#fff,rgba(255,241,213,.58))}.card h3,.article h1{margin-top:0}.card p,.article p,.muted{color:var(--muted)}.price{display:inline-flex;margin:6px 0 12px;padding:8px 14px;border-radius:8px;background:#fff1d5;color:var(--primary);font-weight:900}.blog-list{display:grid;gap:14px}.blog-list a{display:block;text-decoration:none}.footer{display:flex;justify-content:space-between;gap:18px;padding:32px clamp(20px,5vw,72px);background:linear-gradient(135deg,#302634,#58345f 64%,#8f4f83);color:#fff}.form-preview{display:grid;gap:14px}.form-preview input,.form-preview textarea,.form-preview select{width:100%;padding:13px 14px;border:1px solid var(--line);border-radius:8px;font:inherit;background:#fffdfb}
.toc{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0 0}.toc a{padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:#fff;text-decoration:none;font-weight:800;color:var(--primary)}.meaning-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:14px}.meaning-item{padding:20px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.95)}.meaning-item h3{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px}.kicker{color:var(--primary);font-size:13px;font-weight:900}.note-band{margin-top:24px;padding:22px;border:1px solid var(--line);border-radius:8px;background:linear-gradient(135deg,#fff,#fff1d5)}
@media(max-width:760px){header nav{display:none}.split{grid-template-columns:1fr}.hero{min-height:72vh}.footer{display:grid}}
`;

function shell(title: string, main: string) {
  return `<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Luna Starwind</title><meta name="description" content="Luna Starwindは、恋愛・相性・復縁・人間関係をホロスコープと相談内容からやさしく読み解くオンライン鑑定です。"><style>${css}</style></head><body><header><a class="brand" href="/"><span class="mark">LS</span><span>Luna Starwind</span></a><nav><a href="/">トップ</a><a href="/profile">ルナについて</a><a href="/guild">ギルド</a><a href="/divination">占術</a><a href="/blog">ブログ</a><a href="/free-fortune/">無料占い</a><a href="/text-reading/">AIテキスト鑑定</a></nav></header>${main}<footer class="footer"><strong>Luna Starwind</strong><span>月あかりのオンライン鑑定</span></footer></body></html>`;
}

function menusGrid() {
  const menus = [
    ["恋愛の気持ち整理", "太陽・月・金星・火星で、惹かれ方、安心感、距離の詰め方を読みます。"],
    ["恋愛相性の読み解き", "太陽・月・水星・金星・火星で、惹かれる部分とすれ違いやすい言葉を分けます。"],
    ["片思いの流れ", "月・水星・金星・火星で、動くタイミング、伝え方、待つ意味を整理します。"],
    ["復縁の可能性", "月・水星・金星・土星で、未練と愛情、連絡の言葉、時間を置く意味を読みます。"],
    ["人間関係の整理", "月・水星・木星・土星で、境界線、会話、安心できる距離を見ます。"],
    ["自分の気持ち", "太陽・月・水星・金星・土星で、本音と現実的な制約を整理します。"],
  ];
  return `<div class="grid">${menus.map(([name, body]) => `<article class="card"><h3>${name}</h3><span class="price">トライアル価格 ¥0</span><p>${body}</p><a class="button primary" href="/text-reading/">AIテキスト鑑定トライアルへ</a></article>`).join("")}</div>`;
}

function trialReadingForm() {
  return `<form class="form-preview"><select><option>恋愛</option><option>恋愛相性</option><option>片思い</option><option>復縁</option><option>人間関係</option></select><input placeholder="出生地 例: 北海道 / 札幌市 / 渋谷区"><textarea rows="7" placeholder="相談内容"></textarea><button class="button primary" type="button">AIテキスト鑑定トライアルを開始</button></form>`;
}

const planetMeanings = [
  ["太陽", "私はどう生きたいか", "恋愛では自分らしい選び方、人生では中心に置きたい価値観を示します。相談内容では、相手に合わせすぎて見えなくなった本心を照らします。"],
  ["月", "安心感と本音", "寂しさ、甘え方、無意識に求める居場所を読みます。ルナの鑑定では、恋愛の不安や復縁後に必要な安心の条件を見る軸です。"],
  ["水星", "言葉と理解の癖", "連絡、会話、誤解の起き方、考えすぎるポイントを示します。片思い・復縁では、今どんな言葉が届きやすいかを見ます。"],
  ["金星", "愛され方と惹かれ方", "好み、距離感、ときめき、受け取りたい愛情表現を示します。相性鑑定では、心地よい関係の入口を読む重要な星です。"],
  ["火星", "動き方と欲求", "追いかけ方、怒り方、決断の速さ、関係を進める熱量を示します。恋愛では押すべき時と待つべき時の見極めに使います。"],
  ["木星", "広がりと許し", "希望、成長、信じたい未来、関係が楽になる方向を示します。悩みの中でも伸ばせる可能性や味方になる考え方を読みます。"],
  ["土星", "課題と時間", "怖さ、責任、距離、越えるべき壁を示します。復縁や長い関係では、急がない方がよい理由と現実的な積み上げ方を見ます。"],
  ["天王星", "変化と自由", "急な展開、束縛への反応、普通ではいられない感覚を示します。関係が突然変わる時、自由をどう扱うかを読む補助線です。"],
  ["海王星", "理想と揺らぎ", "夢見がちな期待、曖昧さ、境界の溶けやすさを示します。相手を美化しすぎていないか、優しさが苦しさに変わっていないかを見ます。"],
  ["冥王星", "深い執着と再生", "どうしても手放せない感情、関係を根本から変える力を示します。復縁や強い縁の鑑定では、依存と再生の境目を慎重に読みます。"],
];

const signMeanings = [
  ["牡羊座", "始まり・衝動・まっすぐな熱", "好きになった瞬間の勢い、先に動く勇気、待たされることへの弱さを読みます。"],
  ["牡牛座", "安心・五感・ゆっくり育つ愛", "信頼を重ねる力、触れられる安心、急かされると閉じる心を読みます。"],
  ["双子座", "会話・好奇心・軽やかな距離", "言葉のテンポ、友達のような恋、考えが変わりやすい揺れを読みます。"],
  ["蟹座", "身内感・保護・感情の記憶", "守りたい気持ち、傷つきやすさ、懐かしさに引き戻される心を読みます。"],
  ["獅子座", "表現・誇り・選ばれたい心", "堂々と愛されたい願い、褒められて開く心、プライドの扱いを読みます。"],
  ["乙女座", "整える力・観察・現実感", "相手をよく見る目、細かな不安、関係を良くするための実務的な愛を読みます。"],
  ["天秤座", "調和・比較・関係性の美意識", "相手とのバランス、好かれたい気持ち、関係をきれいに保とうとする癖を読みます。"],
  ["蠍座", "深い結びつき・秘密・一途さ", "本気の愛、独占欲、簡単には忘れられない縁の深さを読みます。"],
  ["射手座", "自由・探求・未来への視線", "一緒に広がれる関係、束縛を嫌う心、遠くを見てしまう恋を読みます。"],
  ["山羊座", "責任・継続・現実化", "長く続く形、約束、社会的な立場やタイミングの重さを読みます。"],
  ["水瓶座", "個性・距離・友愛", "依存しない愛、独自の価値観、友達のような関係が恋へ変わる流れを読みます。"],
  ["魚座", "共感・祈り・境界の薄さ", "相手の痛みに寄り添う優しさ、曖昧な関係、救いたい気持ちを読みます。"],
];

const houseMeanings = [
  ["1ハウス", "第一印象と自分の出し方", "ASCを含む領域。恋愛では、相手にどう映るか、出会いの入口で何が起きるかを読みます。"],
  ["2ハウス", "安心材料と自己価値", "愛される自信、お金や所有、安定への感覚を読みます。自分を安く扱っていないかも見ます。"],
  ["3ハウス", "会話と日常の接点", "連絡頻度、言葉の相性、近い距離でのやり取りを読みます。片思いの動き方に関わります。"],
  ["4ハウス", "心の居場所と家族的安心", "素を見せられるか、帰りたい場所になれるか、過去の記憶が関係に影響するかを読みます。"],
  ["5ハウス", "恋の高揚と楽しさ", "ときめき、自己表現、デートの喜び、好きという気持ちの明るい出方を読みます。"],
  ["6ハウス", "習慣と支え方", "日常での気遣い、負担、尽くしすぎ、関係を整える実務的な愛を読みます。"],
  ["7ハウス", "パートナーシップ", "結びつき方、相手に求めるもの、恋人・配偶者としての関係性を読みます。"],
  ["8ハウス", "深い共有と執着", "秘密、身体的・心理的な結びつき、簡単に離れられない感情を読みます。復縁では重要です。"],
  ["9ハウス", "信念と遠い世界", "価値観、遠距離、学び、未来へ広がる関係かどうかを読みます。"],
  ["10ハウス", "社会的な姿とMC", "外から見える関係、仕事や立場、将来像を読みます。MCは人生の向かう方向として重視します。"],
  ["11ハウス", "友人性と未来の仲間", "友達から始まる縁、コミュニティ、同じ未来を見られるかを読みます。"],
  ["12ハウス", "言えない思いと無意識", "秘密の恋、隠れた不安、まだ言葉にならない感情を読みます。ルナが特に丁寧に扱う領域です。"],
];

const aspectMeanings = [
  ["コンジャンクション 0度", "力が重なる", "2つの星が同じ方向を向き、意味が混ざって強く出ます。恋愛では、惹かれ方が濃くなる一方で、距離が近すぎて冷静さを失うこともあります。"],
  ["セクスタイル 60度", "自然な助け合い", "違う性質の星同士が、無理なく協力しやすい角度です。関係性では、会話やタイミングを整える小さなきっかけとして読みます。"],
  ["スクエア 90度", "葛藤と成長課題", "欲しいものと現実、感情と行動がぶつかりやすい角度です。相性では、強く気になるのにすれ違う理由を読む重要な手がかりです。"],
  ["トライン 120度", "流れやすい才能", "星の力が自然に流れ、無理なく発揮されやすい角度です。恋愛では安心感や受け入れやすさとして出ますが、受け身になりすぎることもあります。"],
  ["オポジション 180度", "向き合う相手", "自分の外側にあるテーマとして、相手や状況を通じて強く意識されます。惹かれる理由と反発する理由が同じ場所にある時に重視します。"],
  ["マイナーアスペクト", "細かな癖と違和感", "必要に応じて150度や45度なども補助的に見ます。ただし、まずは主要アスペクトで関係の骨格を読み、細部で補正します。"],
];

const angleMeanings = [
  ["ASC", "出会いの入口と第一印象", "出生時に東の地平線へ昇っていた点です。人にどう見られやすいか、恋愛の最初でどんな雰囲気をまといやすいかを読みます。"],
  ["DSC", "求める相手像", "ASCの反対側にある点です。自分に足りないものとして惹かれる相手、対人関係で投影しやすいテーマを読みます。"],
  ["MC", "外へ向かう姿勢と人生の見え方", "社会的な方向性や人から見える到達点を示します。恋愛では、関係を公にできるか、将来像にどう置くかを見る補助線です。"],
  ["IC", "心の根と帰る場所", "MCの反対側にある点です。安心できる居場所、家族的な感覚、深いところで守りたいものを読みます。"],
];

const guildMembers = [
  ["Raven Blackwood", "レイヴン・ブラックウッド", "ギルド創設者・総合鑑定", "冷静な戦略眼と古典占術で、相談者が恐れではなく判断軸から次の一歩を選べるよう導きます。", "https://raven.fortunestudios.jp/"],
  ["Luna Starwind", "ルナ・スターウィンド", "月と花の相談役", "恋愛や人間関係で揺れる気持ちを、ホロスコープからやさしく整理します。言えない本音を急がせず、相談者の心へ戻す案内役です。", "/"],
  ["Scarlet Donovan", "スカーレット・ドノバン", "境界線と守りの相談役", "距離感、決断、守る力を扱います。人間関係で自分をすり減らしている人に、守るべき線を思い出させます。", "https://scarlet.fortunestudios.jp/"],
  ["Atlas Smith", "アトラス・スミス", "現実整理と修理の相談役", "仕事、生活、計画整理に強いメンバーです。抽象的な不安を分解し、今日できる作業と整える順番へ落とし込みます。", "https://atlas-oracle.fortune-kanri.workers.dev/"],
  ["Sol Aurora", "ソル・オーロラ", "希望と再出発の相談役", "自己肯定感、新しい始まり、気持ちの切り替えを扱います。不安の中でも小さな希望を見つけ、次の一歩につなげます。", "https://sol-oracle.fortune-kanri.workers.dev/"],
];

function meaningGrid(items: string[][]) {
  return `<div class="meaning-grid">${items.map(([name, theme, body]) => `<article class="meaning-item"><h3>${escapeHtml(name)}<span class="kicker">${escapeHtml(theme)}</span></h3><p>${escapeHtml(body)}</p></article>`).join("")}</div>`;
}

function divinationToc() {
  return `<div class="toc"><a href="/divination/planets">各惑星の意味</a><a href="/divination/signs">12星座の意味</a><a href="/divination/houses">12ハウスの意味</a><a href="/divination/aspects">アスペクトの読み方</a><a href="/divination/angles">ASC/MCの解釈</a></div>`;
}

function renderGuildPage() {
  const cards = guildMembers.map(([name, nameJa, role, body, href]) => `<article class="card"><p class="eyebrow">${escapeHtml(role)}</p><h3><a href="${escapeHtml(href)}">${escapeHtml(name)}</a></h3><p class="kicker">${escapeHtml(nameJa)}</p><p>${escapeHtml(body)}</p></article>`).join("");
  return shell("ギルドメンバー紹介", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Raven Guild</p><h2>ギルドメンバー紹介</h2></div><p class="lead muted">Raven Guildは、相談内容に合わせて異なる得意分野を持つ案内役が支える占いギルドです。Luna Starwindは恋愛と心の揺れを担当し、必要に応じて他のメンバーの視点へもつながれるようにしています。</p><div class="grid" style="margin-top:28px">${cards}</div><div class="note-band"><strong>メンバー構成</strong><p>現在のギルドメンバーは5名です。Raven Blackwood、Luna Starwind、Scarlet Donovan、Atlas Smith、Sol Auroraで構成しています。</p></div></div></section></main>`);
}

async function getPublishedArticles(db: D1Database, tenantId: string, limit = 6) {
  const result = await db.prepare("SELECT slug, title, body, published_at, created_at FROM blog_engine_articles WHERE tenant_id = ? AND status = 'published' ORDER BY datetime(COALESCE(published_at, created_at)) DESC, title ASC LIMIT ?").bind(tenantId, limit).all<BlogArticle>();
  return result.results || [];
}

async function getPublishedArticle(db: D1Database, tenantId: string, slug: string) {
  return await db.prepare("SELECT slug, title, body, published_at, created_at FROM blog_engine_articles WHERE tenant_id = ? AND status = 'published' AND slug = ? LIMIT 1").bind(tenantId, slug).first<BlogArticle>();
}

async function renderHome(env: Env, tenantId: string) {
  const posts = await getPublishedArticles(env.DB, tenantId, 3).catch(() => []);
  const blogCards = posts.length ? posts.map((post) => `<a class="card" href="/blog/${escapeHtml(post.slug)}"><p class="eyebrow">${escapeHtml(formatDate(post.published_at || post.created_at))}</p><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.description || String(post.body || "").slice(0, 96))}</p></a>`).join("") : `<article class="card"><h3>ルナの星読みブログ</h3><p>記事を読み込み中です。</p></article>`;
  const cta = `<div style="display:flex;flex-wrap:wrap;gap:12px"><a class="button primary" href="/text-reading/">AIテキスト鑑定トライアルへ</a><a class="button secondary" href="/free-fortune/">無料占いを見る</a></div>`;
  return shell("恋愛と人間関係をやさしく整えるオンライン鑑定", `<main><section class="hero"><div><p class="eyebrow">Moonlit Horoscope Reading</p><h1>言えない気持ちに、月あかりを。</h1><p class="lead">Luna Starwindは、恋愛・相性・復縁・人間関係で揺れる心を、ホロスコープと相談内容からやさしく整理するオンライン鑑定です。</p><div class="chips"><span>AIテキスト鑑定 トライアル価格 ¥0</span><span>無料占いは読み物・簡易コンテンツ</span><span>ASC/MC・ハウス・アスペクト対応</span></div>${cta}</div></section><section><div class="wrap split"><div><p class="eyebrow">Reading Policy</p><h2>星の説明で終わらせず、相談内容へ戻します。</h2><p>前半はホロスコープの解説、中盤は星から読み取れる感情や関係性、後半は相談内容に合わせた総括。ルナ風のやさしい口調で、根拠と次の一歩が分かるように整えます。</p></div><ul><li>毎朝の今日の占いをお届け</li><li>恋愛・相性・復縁を深く読み解く</li><li>気になる記事からAIテキスト鑑定トライアルへ進めます</li></ul></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Specialty</p><h2>ルナの得意な占術</h2></div><div class="grid"><article class="card"><h3>ホロスコープ鑑定</h3><p>太陽・月・水星・金星・火星・木星・土星を中心に、相談テーマへ関係する配置を読みます。</p></article><article class="card"><h3>ASC/MCとハウス</h3><p>出生時刻と出生地から、第一印象、関係の入口、社会的な見え方、悩みが起きる領域を整理します。</p></article><article class="card"><h3>緯度帯の読み分け</h3><p>高緯度ではハウスの偏りを補正し、低緯度では熱量や反応速度を重視します。出生地が曖昧な場合は候補地から選びます。</p></article></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">AI Text Reading</p><h2>AIテキスト鑑定メニュー</h2><p class="muted">個別相談を入力して読む鑑定メニューです。現在は全メニューをトライアル価格 ¥0 で利用できます。</p></div>${menusGrid()}</div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Blog</p><h2>ルナの星読みブログ</h2></div><div class="grid">${blogCards}</div></div></section></main>`);
}

function renderStaticPage(pathname: string) {
  if (pathname === "/profile") return shell("ルナについて", `<main><section><div class="wrap split"><div><p class="eyebrow">Profile</p><h2>Luna Starwind</h2><p>ルナ・スターウィンドは、言葉にしにくい恋愛感情や人間関係の揺れを、月のようにやわらかく照らす星読みの案内役です。</p></div><div><h3>ギルドメンバーからの紹介</h3><p>静かな聞き方と、相談者を急がせない言葉選びが持ち味。感情を否定せず、でも曖昧なままにもしない鑑定を届けます。</p></div></div></section></main>`);
  if (pathname === "/guild" || pathname === "/guild/") return renderGuildPage();
  if (pathname === "/divination") return shell("ルナの占術", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Divination</p><h2>ホロスコープを相談へつなぐ読み方</h2></div><p class="lead muted">ルナは、惑星・星座・ハウス・ASC/MC・アスペクトを分けて説明し、最後に相談内容へ戻して読み解きます。星の知識だけで終わらせず、恋愛、相性、復縁、人間関係の判断に使える形へ整えます。</p>${divinationToc()}<div class="grid" style="margin-top:28px"><article class="card"><h3>ハウスシステム</h3><p>通常は出生地と出生時刻からハウスを読み、高緯度で偏りが強い場合はWhole Signも併用します。</p></article><article class="card"><h3>アスペクト</h3><p>コンジャンクション、セクスタイル、スクエア、トライン、オポジションを中心に、相談テーマへ関わる角度を優先します。</p></article><article class="card"><h3>ASC/MC</h3><p>ASCは人との入口、MCは外へ向かう姿勢として、恋愛や人間関係での伝わり方を読みます。</p></article></div></div></section></main>`);
  if (pathname === "/divination/planets") return shell("各惑星の意味", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Planets</p><h2>各惑星の意味</h2></div><p class="lead muted">惑星は「何が起きているか」を示す主語です。恋愛なら金星だけを見るのではなく、月で安心感、水星で言葉、火星で行動、土星で時間の課題を重ねて読みます。</p>${meaningGrid(planetMeanings)}<div class="note-band"><strong>ルナの読み方</strong><p>個々の惑星を単独で断定せず、相談内容に関係する惑星を優先します。相性では双方の月・金星・火星・水星を照合し、復縁では月・水星・土星・冥王星の緊張を慎重に見ます。</p></div></div></section></main>`);
  if (pathname === "/divination/signs") return shell("12星座の意味", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Signs</p><h2>12星座の意味</h2></div><p class="lead muted">星座は、惑星の力がどんな雰囲気で表れるかを示します。同じ金星でも、牡牛座なら安心と五感、双子座なら会話、蠍座なら深い結びつきとして出やすくなります。</p>${meaningGrid(signMeanings)}<div class="note-band"><strong>ルナの読み方</strong><p>星座だけで性格を決めつけず、惑星・ハウス・アスペクトと合わせます。太陽星座は人生の方向、月星座は安心の条件、金星星座は愛され方として扱います。</p></div></div></section></main>`);
  if (pathname === "/divination/houses") return shell("12ハウスの意味", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Houses</p><h2>12ハウスの意味</h2></div><p class="lead muted">ハウスは、悩みが人生のどの領域で起きているかを示します。恋愛の星が5ハウスにあるのか、7ハウスにあるのか、8ハウスにあるのかで、読み方は大きく変わります。</p><div class="note-band"><strong>ハウスと出生時間の関係</strong><p>生年月日だけでも太陽や金星がどの星座にあるかは大まかに読めますが、ハウス、ASC、MCは出生時間がないと決まりません。理由は、ハウスが「その瞬間、その場所の東の地平線と南中点を基準に空を12領域へ分ける仕組み」だからです。地球は自転しているため、同じ日に同じ場所で生まれても、時間が変わると東の地平線に昇る星座が変わり、ASC、MC、各ハウスの境界線も動きます。</p><p>そのため、出生時間が数分から十数分ずれるだけで、ASCやMCの度数が変わり、惑星が入るハウスが隣へ移ることがあります。ルナの鑑定では、出生時間が分かる場合はハウスを重視し、出生時間が曖昧な場合はハウス断定を弱めて、惑星・星座・主要アスペクトを中心に読みます。</p></div>${meaningGrid(houseMeanings)}<div class="note-band"><strong>高緯度・低緯度の扱い</strong><p>出生地の緯度でハウスの偏りが強い場合は、Placidusの結果だけに寄せず、Whole Signを補助的に見ます。低緯度でハウスが安定している場合は、角度とハウスの一致をより素直に読みます。</p></div></div></section></main>`);
  if (pathname === "/divination/aspects") return shell("アスペクトの読み方", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Aspects</p><h2>アスペクトの読み方と解釈</h2></div><p class="lead muted">アスペクトは、惑星同士がどんな角度で関わっているかを見る技法です。ルナは、角度の吉凶だけで判断せず、「どの星が、どのテーマで、どの程度強く反応しているか」を読みます。</p><div class="note-band"><strong>読む順番</strong><p>まず太陽・月・水星・金星・火星の主要アスペクトで感情、言葉、愛情表現、行動の流れを見ます。次に木星・土星で広がりと制約、必要な時間を確認します。天王星・海王星・冥王星は、急な変化、理想化、執着や再生が強い時に補助的に扱います。</p><p>相性では、片方の金星と相手の火星、月と月、水星と水星、土星が個人天体へ触れる配置を重視します。復縁では、月・水星・土星・冥王星の絡みから、連絡のしやすさ、未練の深さ、現実的な壁を分けて読みます。</p></div>${meaningGrid(aspectMeanings)}<div class="note-band"><strong>解釈の注意点</strong><p>スクエアやオポジションは悪い角度と決めつけません。強い葛藤は、強い関心や成長の接点でもあります。ただし、苦しさが続く配置では、相手を変えようとするより、自分の境界線と動くタイミングを整えることを優先します。</p></div></div></section></main>`);
  if (pathname === "/divination/angles") return shell("ASC/MCの読み方", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">ASC / MC</p><h2>ASC/MCの読み方と解釈</h2></div><p class="lead muted">ASCとMCは、出生時間と出生地から決まるホロスコープの骨格です。惑星や星座が「何をどう感じるか」を示すなら、ASC/MCは「その人が世界へどう現れ、どこへ向かうか」を示します。</p>${meaningGrid(angleMeanings)}<div class="note-band"><strong>ルナの読み方</strong><p>ASCは第一印象だけではなく、緊張した時に自然と出る反応や、恋の始まりで相手に見せる表情として読みます。ASC付近に金星があれば柔らかく惹きつける力、火星があれば勢いや率直さ、土星があれば慎重さや壁として表れやすくなります。</p><p>MCは仕事運だけでなく、関係を未来へ置けるか、公にできるか、人生の方向と恋愛が矛盾していないかを見る点です。MC付近に月があれば感情が外へ見えやすく、金星があれば人に好まれる見せ方、土星があれば責任や時間をかけるテーマが強まります。</p></div><div class="note-band"><strong>出生時間がない場合</strong><p>ASC/MCは出生時間なしでは確定できません。その場合、ルナはASC/MCを断定せず、月・金星・火星・水星などの惑星配置、星座、主要アスペクトを中心に読みます。出生時間が分かる相談では、ASC/MCを加えて「相手からどう見えるか」「関係をどこへ向かわせたいか」まで深めます。</p></div></div></section></main>`);
  if (pathname === "/menus" || pathname === "/text-reading" || pathname === "/text-reading/") return shell("AIテキスト鑑定メニュー", `<main><section><div class="wrap split"><div><p class="eyebrow">AI Text Reading Trial</p><h2>AIテキスト鑑定 トライアル価格 ¥0</h2><p class="muted">恋愛、相性、片思い、復縁、人間関係を、ホロスコープの根拠と相談内容に合わせて読みます。これは読み物としての無料占いとは別の、個別相談入力型のAIテキスト鑑定です。</p></div>${trialReadingForm()}</div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Reading Menu</p><h2>鑑定メニュー</h2><p class="muted">全メニュー共通で、現在の価格表示はトライアル価格 ¥0 です。</p></div>${menusGrid()}</div></section></main>`);
  if (pathname === "/ai-reading" || pathname === "/free-fortune" || pathname === "/free-fortune/") return shell("無料占い", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Free Fortune</p><h2>無料占い</h2><p class="lead muted">無料占いは、今日の星読みやブログ記事など、気軽に読めるコンテンツです。生年月日・出生地・相談内容を入力して個別に読むものは、AIテキスト鑑定トライアルとして分けています。</p></div><div class="grid"><article class="card"><h3>今日の星読み</h3><p>その日の空気を、恋愛や人間関係に使いやすい言葉で短く整えます。</p><a class="button secondary" href="/blog">ブログを読む</a></article><article class="card"><h3>占術ガイド</h3><p>惑星、星座、ハウス、ASC/MC、アスペクトの意味を無料で確認できます。</p><a class="button secondary" href="/divination">占術を詳しく見る</a></article><article class="card"><h3>個別相談したい方へ</h3><p>相談内容を入力して深く読む場合は、AIテキスト鑑定トライアルへ進んでください。</p><a class="button primary" href="/text-reading/">AIテキスト鑑定トライアルへ</a></article></div></div></section></main>`);
  return null;
}

async function renderBlogIndex(env: Env, tenantId: string) {
  const articles = await getPublishedArticles(env.DB, tenantId, 25);
  const rows = articles.map((post) => `<a class="card" href="/blog/${escapeHtml(post.slug)}"><p class="eyebrow">${escapeHtml(formatDate(post.published_at || post.created_at))}</p><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.description || String(post.body || "").slice(0, 120))}</p></a>`).join("");
  return shell("ルナの星読みブログ", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Luna Blog</p><h2>ルナの星読みブログ</h2></div><div class="blog-list">${rows || `<article class="card"><h3>記事を準備中です</h3><p>公開記事はまだありません。</p></article>`}</div></div></section></main>`);
}

async function renderBlogArticle(env: Env, tenantId: string, slug: string) {
  const article = await getPublishedArticle(env.DB, tenantId, slug);
  if (!article) return json({ error: "article not found" }, { status: 404 });
  const paragraphs = String(article.body || article.description || "").split(/\n\s*\n|\|\|/).filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return shell(article.title, `<main><section><article class="wrap article"><p class="eyebrow">${escapeHtml(formatDate(article.published_at || article.created_at))}</p><h1>${escapeHtml(article.title)}</h1>${paragraphs || `<p>${escapeHtml(article.description || "")}</p>`}<p><a class="button secondary" href="/blog">ブログ一覧へ戻る</a></p></article></section></main>`);
}

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
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      const authenticationFailure = requireBasicAdmin(request, env.ADMIN_BASIC_AUTH);
      if (authenticationFailure) return authenticationFailure;
      const [analyticsRows, blogRows] = await Promise.all([
        count(env.DB, "analytics_events", tenantId),
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
    if (url.pathname.startsWith("/blog/")) {
      const slug = decodeURIComponent(url.pathname.slice("/blog/".length));
      const articlePage = await renderBlogArticle(env, tenantId, slug);
      if (articlePage instanceof Response) return articlePage;
      return new Response(articlePage, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    if (url.pathname === "/blog") return new Response(await renderBlogIndex(env, tenantId), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (url.pathname === "/") return new Response(await renderHome(env, tenantId), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    const staticPage = renderStaticPage(url.pathname);
    if (staticPage) return new Response(staticPage, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    return json({ error: "not found" }, { status: 404 });
  },
};
