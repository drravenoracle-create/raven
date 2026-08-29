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

const guildMembers = [
  ["Raven Blackwood", "レイヴン・ブラックウッド", "ギルド創設者・総合鑑定", "冷静な戦略眼と古典占術で、相談者が恐れではなく判断軸から次の一歩を選べるよう導きます。", "https://raven.fortunestudios.jp/guild/"],
  ["Luna Starwind", "ルナ・スターウィンド", "月と花の相談役", "恋愛や人間関係で揺れる気持ちを、ホロスコープからやさしく整理します。言えない本音を急がせず、相談者の心へ戻す案内役です。", "https://luna.fortunestudios.jp/"],
  ["Scarlet Donovan", "スカーレット・ドノバン", "境界線と守りの相談役", "距離感、決断、守る力を扱います。人間関係で自分をすり減らしている人に、守るべき線を思い出させます。", "https://scarlet.fortunestudios.jp/guild-members/"],
  ["Atlas Smith", "アトラス・スミス", "現実整理と修理の相談役", "仕事、生活、計画整理に強いメンバーです。抽象的な不安を分解し、今日できる作業と整える順番へ落とし込みます。", "https://atlas-oracle.fortune-kanri.workers.dev/guild"],
  ["Sol Aurora", "ソル・オーロラ", "希望と再出発の相談役", "自己肯定感、新しい始まり、気持ちの切り替えを扱います。不安の中でも小さな希望を見つけ、次の一歩につなげます。", "/guild"],
];

function renderGuild() {
  const cards = guildMembers.map(([name, nameJa, role, body, href]) => `<article class="card"><p class="eyebrow">${escapeHtml(role)}</p><h3><a href="${escapeHtml(href)}">${escapeHtml(name)}</a></h3><p><strong>${escapeHtml(nameJa)}</strong></p><p>${escapeHtml(body)}</p></article>`).join("");
  return shell("ギルドメンバー紹介", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Raven Guild</p><h1>ギルドメンバー紹介</h1><p class="lead muted">Raven Guildは、相談内容に合わせて異なる得意分野を持つ案内役が支える占いギルドです。ソルは希望と再出発の視点から、今の気持ちを無理なく次の一歩へつなげます。</p></div><div class="card-grid">${cards}</div><div class="note-band"><strong>メンバー構成</strong><p>現在のギルドメンバーは5名です。Raven Blackwood、Luna Starwind、Scarlet Donovan、Atlas Smith、Sol Auroraで構成しています。</p></div></div></section></main>`);
}

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
  <header><a class="brand" href="#top"><span class="mark">S</span><span>ソル・オーロラ<br><small class="muted">Raven Guild｜希望の案内役</small></span></a><nav aria-label="メインナビゲーション"><a href="#about">ソルについて</a><a href="/guild">ギルド</a><a href="#reading">相談の入口</a><a href="#steps">読み方</a><a href="/divination">カード解説</a><a href="#notes">ご案内</a></nav></header>
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

const oracleThemes = [
  ["はじまり", "新しい周期、最初の一歩、準備したものを試す時"], ["光", "見えていなかった希望、理解、状況が明るくなる兆し"],
  ["休息", "回復、余白、立ち止まることで戻ってくる感覚"], ["境界線", "守る範囲、断る勇気、安全な距離"],
  ["変化", "環境や気持ちの切り替わり、古い形を手放す流れ"], ["勇気", "不安があっても小さく試す力、助けを求める強さ"],
  ["受け取る", "支援、好意、成果を受け入れること、抱え込みをゆるめること"], ["手放す", "役目を終えた考えや習慣を整理し、余白をつくること"],
  ["真実", "事実と想像を分ける、曖昧な点を確かめる、誠実な対話"], ["つながり", "信頼できる人、協力、ひとりで抱えないための連絡"],
  ["選択", "複数の道を比べる、決める期限を置く、保留も選択肢にする"], ["流れ", "無理に押さず、変えられる部分から自然に進めること"],
  ["根", "暮らしの基盤、安心できる場所、長く続く習慣"], ["種", "まだ小さい計画、育てる時間、すぐに結果を求めないこと"],
  ["収穫", "積み重ねの成果、受け取るタイミング、振り返り"], ["道しるべ", "次に確認する情報、目標へ戻る目印、迷った時の基準"],
  ["静けさ", "刺激を減らす、内側の声を聞く、急いで答えを出さないこと"], ["祝福", "できたことを認める、喜びを共有する、前進を記録すること"],
];

const lenormandCards = [
  ["1 騎士", "知らせ・到来", "連絡や新しい情報が近づく。内容と期限を確認して、受け取る準備を。"],
  ["2 クローバー", "小さな幸運", "短い好機や偶然の助け。大きく賭けず、軽く試して反応を見る。"],
  ["3 船", "移動・広がり", "遠方、旅行、価値観の変化。未知を急がず、必要な準備を分ける。"],
  ["4 家", "居場所・基盤", "家庭、安心、生活の土台。まず休める環境を整える。"],
  ["5 木", "健康・成長", "時間をかけた回復と成長。短期の結果より、続く習慣を重視する。"],
  ["6 雲", "迷い・不透明さ", "情報が混線している。決断を急がず、事実を一つずつ確かめる。"],
  ["7 蛇", "複雑さ・迂回", "単純に進まない状況。別の道を検討し、曖昧な約束を残さない。"],
  ["8 棺", "終わり・休止", "一区切り、停止、休息。終わったものを認めて次の余白をつくる。"],
  ["9 花束", "喜び・贈り物", "好意、評価、うれしい交流。感謝を言葉にして受け取る。"],
  ["10 鎌", "決断・切り替え", "急な区切りや選択。安全を確保し、不要なものを一つだけ切り分ける。"],
  ["11 鞭", "反復・緊張", "同じ議論や習慣の繰り返し。責め合いではなく、ルールを見直す。"],
  ["12 鳥", "会話・不安", "短いやり取りや心配事。結論を急がず、要点をメモして話す。"],
  ["13 子ども", "始まり・素直さ", "小さな計画、初心、未経験。完成を求めず、まず試作品をつくる。"],
  ["14 狐", "仕事・慎重さ", "実務、自己防衛、見極め。条件と役割を確認してから動く。"],
  ["15 熊", "力・保護", "影響力、資源、守る力。強さを支配ではなく支援に使う。"],
  ["16 星", "希望・方向", "目標、理想、長期の見通し。遠い願いを今日の目印へ変える。"],
  ["17 コウノトリ", "変化・移行", "環境や役割の移り変わり。変えるものと残すものを分ける。"],
  ["18 犬", "友情・信頼", "仲間、忠実さ、支え合い。信頼は小さな約束の実行で育てる。"],
  ["19 塔", "距離・組織", "ひとりの時間、制度、客観性。必要な距離を取り、窓口を確認する。"],
  ["20 庭", "交流・公開", "人の集まる場、評判、イベント。公開範囲と心地よい参加方法を選ぶ。"],
  ["21 山", "障害・停滞", "進みにくい壁。正面突破だけでなく、期限延長や別ルートを考える。"],
  ["22 道", "選択・分岐", "複数の可能性。選んだ理由と、選ばない道を短く記録する。"],
  ["23 鼠", "消耗・小さな損失", "気力や時間が少しずつ減る。漏れている負担を見つけて止める。"],
  ["24 ハート", "愛情・情熱", "好きという気持ち、思いやり、心からの望み。相手と自分の境界も守る。"],
  ["25 指輪", "約束・契約", "関係の継続、合意、繰り返すサイクル。条件を言葉にして確認する。"],
  ["26 本", "秘密・学び", "まだ知らない情報、勉強、記録。推測せず、必要な資料を探す。"],
  ["27 手紙", "文書・通知", "メッセージ、申請、記録。日時、宛先、保存場所を整える。"],
  ["28 紳士", "相談者・男性像", "質問者や関係する人物の主体性。誰の意思かを切り分ける。"],
  ["29 淑女", "相談者・女性像", "質問者や関係する人物の主体性。自分の望みを後回しにしない。"],
  ["30 百合", "成熟・平穏", "落ち着き、経験、穏やかな関係。急がず品位ある選択をする。"],
  ["31 太陽", "成功・活力", "明快さ、達成、エネルギー。できたことを見える形で残す。"],
  ["32 月", "感情・評価", "気持ち、想像、評判。感情を否定せず、事実と分けて扱う。"],
  ["33 鍵", "解決・確信", "重要な手がかり、開く方法。核心となる一問を見つける。"],
  ["34 魚", "資源・自由", "お金、流動性、選択の幅。収支と使える資源を具体的に確認する。"],
  ["35 錨", "安定・継続", "仕事、定着、長く続く場所。守りたい基盤と変えたい部分を分ける。"],
  ["36 十字架", "重荷・意味", "背負っている課題、責任、学び。ひとりで抱えず、負担を分担する。"],
];

const tarotCards = [
  ["0 愚者", "始まり", "未知へ踏み出す自由。準備と安全を確認しながら、最初の一歩を選ぶ。"], ["I 魔術師", "資源", "手元の道具と意志。すでにある力を一つの行動へ集める。"], ["II 女教皇", "静かな知恵", "直感、観察、まだ言葉にならない理解。急いで結論を出さない。"], ["III 女帝", "育てる", "豊かさ、創造、受け取る力。安心できる環境を育てる。"], ["IV 皇帝", "構造", "責任、秩序、境界線。続く仕組みとルールをつくる。"], ["V 教皇", "学び・伝統", "教え、信頼できる助言、共同体。経験者の知恵を活用する。"], ["VI 恋人たち", "選択・調和", "価値観に沿う選択と関係性。相手任せにせず自分の意思を確認する。"], ["VII 戦車", "前進", "方向を定めて進む力。勢いだけでなく手綱と休息を保つ。"], ["VIII 力", "穏やかな強さ", "感情を押さえつけず扱う勇気。自分にも相手にも無理を強いない。"], ["IX 隠者", "内省", "ひとりで考える時間、探究、答えを急がない姿勢。"], ["X 運命の輪", "周期・転機", "流れの変化とタイミング。変えられる部分へ柔軟に対応する。"], ["XI 正義", "均衡・事実", "公平さ、契約、結果との向き合い。記録と事実を確認する。"], ["XII 吊るされた男", "視点の転換", "いったん止まり、見方や優先順位を変える。犠牲を美化しない。"], ["XIII 死神", "終わりと変容", "古い形を終え、次の段階へ移る。手放す対象を具体化する。"], ["XIV 節制", "調整", "異なるものを混ぜ、無理のないペースをつくる。"], ["XV 悪魔", "執着・習慣", "離れにくい誘惑や依存。何が選択を狭めているかを見つける。"], ["XVI 塔", "急変・解放", "前提が崩れる出来事。安全を確保し、壊れた構造を見直す。"], ["XVII 星", "希望", "回復、方向、静かな願い。遠い目標を今日の目印にする。"], ["XVIII 月", "不安・想像", "曖昧さ、夢、揺れる感情。推測と事実を分ける。"], ["XIX 太陽", "明るさ・成果", "活力、成功、見える喜び。できたことを分かち合う。"], ["XX 審判", "目覚め・再評価", "過去を振り返り、次の判断をする。経験を現在へ生かす。"], ["XXI 世界", "統合・完成", "一区切り、全体のつながり、次の循環への準備。"],
  ["ワンドのエース", "火・始動", "意欲、創作、行動の種。小さく始めて熱を育てる。"], ["ワンドの2", "展望", "計画と可能性。選択肢を地図にして次の一手を決める。"], ["ワンドの3", "展開", "成果を待つ視野、協力、遠くへの広がり。"], ["ワンドの4", "安定・祝福", "居場所、節目、仲間と喜ぶ時間。基盤を確認する。"], ["ワンドの5", "競争・摩擦", "意見の違いと切磋琢磨。勝ち負けよりルールを整える。"], ["ワンドの6", "承認・前進", "評価、勝利、知らせ。成果を受け取り次の責任も見る。"], ["ワンドの7", "防衛", "立場を守る、境界線、粘り強さ。無理な防戦を減らす。"], ["ワンドの8", "急展開", "連絡、速度、物事が動く時。優先順位を先に決める。"], ["ワンドの9", "警戒・持久", "経験から備える力。休みながら最後の一歩を守る。"], ["ワンドの10", "負担", "責任の集中、抱えすぎ。任せるものと下ろすものを選ぶ。"], ["ワンドのペイジ", "好奇心", "新しい知らせ、学び、試してみる熱。"], ["ワンドのナイト", "行動力", "勢い、冒険、情熱。急ぐ前に目的と帰る場所を確認する。"], ["ワンドのクイーン", "自信・創造性", "自分らしい熱、包容力、場を明るくする力。"], ["ワンドのキング", "統率・ vision", "大きな構想を動かす意志。独断せず仲間と共有する。"],
  ["カップのエース", "感情の始まり", "愛情、共感、心の回復。感じたことを丁寧に受け取る。"], ["カップの2", "対話・結びつき", "相互理解、協力、対等な関係。気持ちを言葉にする。"], ["カップの3", "喜び・仲間", "友情、祝福、共有。ひとりで抱えず喜びを分ける。"], ["カップの4", "停滞・内側", "気持ちが動かない時。拒む前に本当に欲しいものを確認する。"], ["カップの5", "喪失・悲しみ", "失ったものへの視線。残っている支えにも少しずつ目を向ける。"], ["カップの6", "記憶・素直さ", "過去、懐かしさ、純粋な交流。現在の自分に合う形で受け取る。"], ["カップの7", "幻想・選択", "夢と選択肢の多さ。現実に試せる一つへ絞る。"], ["カップの8", "離れる決断", "満たされないものから距離を取る。次へ行く理由を自分で確かめる。"], ["カップの9", "満足", "願い、心の充足、自分の喜び。受け取ることを許す。"], ["カップの10", "調和・家族", "心の居場所、共有する幸福。理想を押しつけず関係を育てる。"], ["カップのペイジ", "感受性", "優しい知らせ、想像力、心を開く練習。"], ["カップのナイト", "思いやり", "ロマン、申し出、感情の表現。行動と約束を合わせる。"], ["カップのクイーン", "共感・受容", "深く聴く力、感情の理解。自分の境界も守る。"], ["カップのキング", "感情の成熟", "落ち着いた共感、感情を扱う力。反応の前に一呼吸置く。"],
  ["ソードのエース", "真実・決断", "明確な考え、会話、切り分け。事実を言葉にする。"], ["ソードの2", "保留・均衡", "決めかねる状態。情報を補い、決める期限を置く。"], ["ソードの3", "痛み・理解", "悲しみ、失望、厳しい真実。痛みを無視せず支援を求める。"], ["ソードの4", "休息", "回復、距離、思考を止める時間。休むことを計画に入れる。"], ["ソードの5", "対立・代償", "勝ち負けの争い。何を守り、何を手放すかを考える。"], ["ソードの6", "移行", "困難から静かな場所へ移る。必要な荷物だけを持って進む。"], ["ソードの7", "戦略・秘密", "慎重な計画、隠れた情報。誠実さと安全を両立する。"], ["ソードの8", "制限・思い込み", "動けない感覚。事実上の制約と、自分を縛る考えを分ける。"], ["ソードの9", "不安・夜", "心配が膨らむ時。ひとりで結論を出さず、現実的な確認をする。"], ["ソードの10", "終幕", "限界と区切り。回復のために終わらせるものを認める。"], ["ソードのペイジ", "観察・学習", "情報、質問、警戒心。確認してから判断する。"], ["ソードのナイト", "迅速な主張", "速い決断、強い言葉。目的と相手への配慮を忘れない。"], ["ソードのクイーン", "明晰さ・境界", "率直さ、独立、見極め。優しさと明確な線引きを両立する。"], ["ソードのキング", "判断・原則", "論理、責任、決定。権威で押さず根拠を示す。"],
  ["ペンタクルのエース", "資源の種", "仕事、お金、身体、具体的な機会。現実的に育て始める。"], ["ペンタクルの2", "やりくり", "複数の予定や資源を調整。優先順位を柔軟に変える。"], ["ペンタクルの3", "協働・技術", "技能、チーム、品質。専門性を持ち寄る。"], ["ペンタクルの4", "保持・安心", "資源を守る力と執着。安全と循環のバランスを見る。"], ["ペンタクルの5", "不足・支援", "孤立や困窮。助けを求め、使える制度や人へつながる。"], ["ペンタクルの6", "分配・交換", "与えることと受け取ること。条件と対等さを確認する。"], ["ペンタクルの7", "評価・待機", "積み重ねの点検。続ける、変える、休むを比較する。"], ["ペンタクルの8", "練習・熟練", "反復、仕事、技術の向上。小さな改善を積み重ねる。"], ["ペンタクルの9", "自立・成果", "自分で築いた安心、余裕。成果を味わい維持する。"], ["ペンタクルの10", "継承・基盤", "長期の安定、家族、資産、共同体。次世代へ残すものを考える。"], ["ペンタクルのペイジ", "学び・実務", "新しい技能、具体的な知らせ。まず手を動かして学ぶ。"], ["ペンタクルのナイト", "継続・責任", "堅実な前進、約束を守ること。遅くても続く仕組みを選ぶ。"], ["ペンタクルのクイーン", "ケア・実用", "暮らしを整える力、現実的な思いやり。自分の体力も守る。"], ["ペンタクルのキング", "安定・運用", "資源を育てる責任、成熟した管理。独占せず循環させる。"],
];

const cardCombinations = [
  ["カード1 → カード2", "流れで読む", "左から右へ、起点から展開・結果へ読む。質問が時間軸なら過去・現在・次の一歩へ置き換える。"],
  ["カード1 ＋ カード2", "意味を重ねる", "一枚目を主題、二枚目を性質や条件として重ねる。たとえば太陽＋手紙なら、明るい知らせや結果が見える通知として読む。"],
  ["カード1 × カード2", "緊張を読む", "異なる方向のカードは、対立ではなく調整点として読む。月＋雲なら、感情と不確かな情報を分けて確認する。"],
  ["恋人たち ＋ 2 of Cups", "関係と選択", "惹かれ合いだけでなく、対等な対話と自分の意思がそろうかを見る。"],
  ["月 ＋ 9 of Swords", "不安の増幅", "想像が不安を膨らませる組み合わせ。事実確認と休息を先に置く。"],
  ["星 ＋ 8 of Pentacles", "希望と積み重ね", "理想を練習や小さな継続へ変換する。"],
  ["死神 ＋ 6 of Swords", "移行", "古い状態を終え、静かな場所へ移る。戻るか進むかを具体的に選ぶ。"],
  ["騎士 ＋ 手紙", "知らせの到来", "連絡、通知、文書が近づく。宛先や期限を確認する。"],
  ["ハート ＋ 指輪", "愛情と約束", "好意を継続的な合意へ育てる。条件を曖昧にしない。"],
  ["狐 ＋ 錨", "仕事の安定", "実務と継続。役割や負担を明文化して守る。"],
  ["雲 ＋ 鍵", "不明点の解決", "曖昧さの中から核心を探す。重要な一問を決める。"],
  ["道 ＋ 船", "選択と移動", "複数の道のうち、未知へ広がる選択。準備と期限を置く。"],
];

const lenormandHouses = lenormandCards.map(([name, theme, body]) => [
  `${name}の家`,
  theme,
  `この位置は${theme}を扱う領域。${body}`,
]);

function cardGrid(cards: string[][], className = "card-grid") {
  return `<div class="${className}">${cards.map(([name, theme, body]) => `<article class="card"><h3>${escapeHtml(name)}<span class="kicker">${escapeHtml(theme)}</span></h3><p>${escapeHtml(body)}</p></article>`).join("")}</div>`;
}

function tarotVisualGuide() {
  const majors = [
    ["愚者", "崖・犬・小さな荷物", "崖は未知への境目、犬は instinct と注意、荷物はこれまでの経験。前向きさだけでなく足元も見る。"],
    ["魔術師", "四つの道具・頭上の∞", "棒・杯・剣・金貨は行動、感情、思考、資源。道具を持っているだけでなく、何に使うかを読む。"],
    ["女教皇", "二本の柱・巻物・月", "対立する柱の間にある静けさ、隠された知識、直感。すぐに公開しない情報にも意味がある。"],
    ["女帝", "植物・川・豊かな衣", "育つ環境、身体感覚、創造性。結果を急がず、養うものを確認する。"],
    ["皇帝", "玉座・山・笏", "構造、責任、境界線。安定が支配や硬直になっていないかも見る。"],
    ["教皇", "二人の弟子・二本の鍵", "教え、制度、受け継ぐ知恵。誰のルールを採用するかを考える。"],
    ["恋人たち", "二人・樹木・天使", "選択、価値観、関係の対話。惹かれ合いだけでなく、選ぶ責任を読む。"],
    ["戦車", "二頭のスフィンクス・鎧・星の天蓋", "異なる力を一つの方向へ進める意志。勢いと制御の両方を確認する。"],
    ["力", "女性と獅子・∞", "押さえつけずに扱う勇気。感情や欲望との穏やかな関係を読む。"],
    ["隠者", "灯火・杖・山", "探究、距離、内省。暗闇全体を照らすのではなく、次の数歩を照らす。"],
    ["運命の輪", "輪・四つの生き物・上昇下降", "周期、変化、視点の転換。流れに乗る部分と備える部分を分ける。"],
    ["正義", "天秤・剣・正面を向く人物", "事実、均衡、決定。感情を切り捨てず、記録と条件をそろえる。"],
    ["吊るされた男", "逆さの人物・光の頭", "停止と見方の転換。犠牲を美化せず、今変えられる前提を探す。"],
    ["死神", "白馬・旗・朝日", "終わり、変容、次の光。人物ではなく役割や段階が終わることもある。"],
    ["節制", "二つの杯・片足ずつの水と地面", "混ぜる、調整する、無理のない配分。極端な結論を中間の実験へ戻す。"],
    ["悪魔", "鎖・翼のある像・二人", "執着、習慣、依存。鎖が外せる構造か、何が選択を狭めているかを見る。"],
    ["塔", "稲妻・崩れる塔・落ちる冠", "急な露呈と前提の崩壊。まず安全を確保し、壊れた構造を再点検する。"],
    ["星", "水を注ぐ人物・星・水辺", "希望、回復、循環。大きな願いを小さな継続へ翻訳する。"],
    ["月", "二つの塔・犬と狼・水から出る生き物", "不安、夢、未知。想像と事実を分け、見えないものを急いで断定しない。"],
    ["太陽", "子ども・白馬・ひまわり", "明快さ、生命力、無邪気な喜び。成果を隠さず、共有できる形にする。"],
    ["審判", "呼びかける天使・棺から起きる人々", "再評価、目覚め、過去からの呼び声。経験を現在の選択へ戻す。"],
    ["世界", "輪・四隅の象徴・踊る人物", "統合、完成、次の循環。終わりを確認してから次の扉へ進む。"],
  ];
  return `<div class="visual-guide"><div class="section-title"><p class="eyebrow">Visual Language</p><h2>絵柄に描かれたものの読み方</h2><p class="muted">以下はRider–Waite–Smith系で広く参照される図像を入口にした補足です。デッキの作者や文化によって絵柄は変わるため、色・向き・表情・背景を質問の文脈と合わせて読みます。</p></div><div class="card-grid">${majors.map(([name, symbols, reading]) => `<article class="card"><h3>${escapeHtml(name)}<span class="kicker">${escapeHtml(symbols)}</span></h3><p>${escapeHtml(reading)}</p></article>`).join("")}</div><div class="note-band"><strong>小アルカナの絵柄</strong><p><b>ワンド：</b>芽吹きや火のイメージは意欲・創作・行動。<b>カップ：</b>水・器・流れは感情・関係・受容。<b>ソード：</b>空・雲・剣は思考・言葉・判断。<b>ペンタクル：</b>大地・庭・金貨は身体・仕事・資源を示す入口です。</p><p><b>数字の流れ：</b>1は種・始動、2は対話・均衡、3は成長・展開、4は基盤・安定、5は摩擦・変化、6は調整・回復、7は検証・内省、8は動き・熟練、9は成熟・成果の直前、10は完成・負荷の頂点として読みます。数字は単独で吉凶を決めず、スートのテーマと絵柄の状態を重ねます。ペイジは学び、ナイトは動き、クイーンは内的な成熟、キングは外へ運用する力として補足します。</p></div></div>`;
}

function historySources() {
  return `<div class="history-note"><strong>タロット史の補足</strong><p>15世紀の北イタリアでは、通常のスートに寓意的な切り札を加えたカードゲームが宮廷で楽しまれていました。初期の手彩色デッキは高価な注文品で、寓意画や当時の社会観を映しています。</p><p>タロットが最初から占い専用だったという証拠はありません。18世紀末以降、カードの図像を占いや秘教的な体系と結びつける解釈が広がり、19世紀以降の印刷・出版文化を通じて、現在の占術デッキへ発展しました。</p><p>Rider–Waite–Smith系は20世紀初頭に成立した代表的な近代デッキの一つで、小アルカナにも場面を描いたことが後の学習に大きな影響を与えました。ただし、マルセイユ系など別系統のデッキもあり、構図や名称は一様ではありません。</p><p class="source-note">歴史欄は、現存資料で確認できる範囲を要約しています。起源に諸説がある部分は断定せず、カード占いとしての現在の読み方と、カードゲーム・印刷文化としての歴史を分けて説明します。</p></div>`;
}

function shell(title: string, content: string) {
  return `<!doctype html><html lang="ja-JP"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="ソル・オーロラのカード占い解説。タロット、ルノルマン、オラクルカードの読み方を紹介します。"><title>${escapeHtml(title)}｜ソル・オーロラ</title><style>
  :root{--ink:#26352d;--muted:#65736a;--line:#d9e3d4;--deep:#233f31;--paper:#fffdf8;--gold:#c99832;--shadow:0 12px 32px rgba(44,72,52,.09)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#fffdf8,#f4f8ee 55%,#fffaf0);color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;line-height:1.8}a{color:inherit}header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px clamp(20px,5vw,72px);border-bottom:1px solid rgba(217,227,212,.9);background:rgba(255,253,248,.92);backdrop-filter:blur(14px)}.brand{font-weight:800;text-decoration:none}.brand small{font-weight:500;color:var(--muted)}nav{display:flex;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:14px;font-weight:700}nav a{text-decoration:none}.wrap{width:min(1160px,100%);margin:0 auto}section{padding:70px clamp(20px,6vw,88px)}.section-title{max-width:760px;margin-bottom:26px}.section-title h2{margin:6px 0 0;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(29px,4vw,46px);line-height:1.25}.eyebrow{margin:0;color:var(--gold);font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.lead{max-width:760px;font-size:18px}.muted{color:var(--muted)}.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:16px}.card{padding:22px;border:1px solid var(--line);border-radius:12px;background:rgba(255,253,248,.9);box-shadow:var(--shadow)}.card h3{margin:0 0 7px;font-size:18px;line-height:1.45}.card p{margin:0;color:var(--muted)}.kicker{display:block;margin-top:4px;color:#9b7426;font-size:12px;font-weight:800}.note-band,.history-note{margin-top:24px;padding:22px 24px;border:1px solid #e7d9a8;border-radius:12px;background:linear-gradient(135deg,#fff8dc,#f1f7e9)}.note-band p,.history-note p{margin:.45em 0}.visual-guide{padding-top:8px}.spread-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.spread-map{display:grid;gap:7px;margin:0 0 16px;padding:14px;border:1px solid #eadfb9;border-radius:10px;background:linear-gradient(180deg,#fffdf8,#f7f8ea)}.spread-row{display:flex;justify-content:center;gap:7px;min-height:34px}.spread-slot{display:grid;place-items:center;width:34px;height:42px;border:1px solid #d5c385;border-radius:6px;background:#fffaf0;color:#6e541a;font-size:12px;font-weight:900;box-shadow:0 4px 10px rgba(76,90,51,.08)}.spread-slot.empty{visibility:hidden}.detail-grid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.footer{padding:32px clamp(20px,6vw,88px);background:var(--deep);color:#edf5e8}.footer a{color:#fff1c9}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}header nav{gap:10px;font-size:13px}section{padding-block:52px}.spread-slot{width:30px;height:38px}}</style></head><body><header><a class="brand" href="/">ソル・オーロラ<br><small>Raven Guild｜希望の案内役</small></a><nav aria-label="メインナビゲーション"><a href="/">ホーム</a><a href="/guild">ギルド</a><a href="/divination">概要</a><a href="/divination/tarot">タロット</a><a href="/divination/lenormand">ルノルマン</a><a href="/divination/spreads">展開法</a></nav></header>${content}<footer class="footer"><strong>ソル・オーロラ｜Raven Guild</strong></footer></body></html>`;
}

function renderDivination() {
  return shell("ソルのカード占い解説", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Card Reading Guide</p><h2>カードから、今日の一歩へ。</h2></div><p class="lead muted">ソルはカードを未来の断定に使わず、いまの気持ちや状況を言葉にするための鏡として扱います。オラクルカードはデッキごとに枚数と名称が異なるため、ここでは共通して使えるテーマを紹介し、ルノルマンは標準36枚、タロットは標準78枚を一枚ずつ解説します。</p><div class="note-band"><strong>カードの歴史</strong><p>タロットは15世紀の北イタリアで、切り札を加えたカードゲームとして発展した記録が残っています。18世紀末以降に占いとの結びつきが強まり、現代の多様なデッキへ広がりました。ルノルマンは19世紀に広まった36枚のカード占いで、マリー・アンヌ・アデライード・ルノルマンの名を冠した後世のデッキとして定着しています。どちらも起源には諸説があるため、伝説を史実として断定しません。</p><p>オラクルカードは特定の一つの標準デッキではなく、作者やデッキごとに枚数・名称・ガイドが異なる形式です。公式ガイドがある場合は、そのデッキの説明を最優先します。</p>${historySources()}<div class="note-band"><strong>占う前の準備</strong><p>質問を「どうなりますか」だけで終わらせず、「いま確認したいこと」「自分で選べること」へ言い換えます。深呼吸をして、結果を急いで決めない時間を確保しましょう。</p></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Oracle Cards</p><h2>オラクルカードの基本テーマ</h2><p class="muted">デッキ固有の公式ガイドブックがある場合はそちらを優先し、以下はカードの印象を相談へつなげるための汎用的な読み方です。</p></div>${cardGrid(oracleThemes)}<div class="note-band"><strong>オラクルカードの読み方</strong><p>絵、色、最初に浮かんだ言葉、身体の反応をメモし、テーマを一つに絞ります。正位置・逆位置を固定せず、カードの助言を「今日できる行動」と「休む選択肢」に翻訳します。</p></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Tarot 78</p><h2>タロットカード全78枚</h2><p class="muted">大アルカナ22枚は人生の大きなテーマ、小アルカナ56枚はワンド・カップ・ソード・ペンタクルの4スートとして、状況の具体的な動きを読みます。</p></div>${cardGrid(tarotCards, "card-grid tarot-grid")}${tarotVisualGuide()}</div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Combinations</p><h2>カードの並びと組み合わせ</h2><p class="muted">カードは単体の吉凶で決めず、質問・位置・隣接カードを合わせます。複数枚では左から右へ流れを追い、中央のカードを主題にするなど、最初に決めた配置ルールを途中で変えません。</p></div>${cardGrid(cardCombinations, "card-grid combination-grid")}</div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Lenormand 36</p><h2>ルノルマンカード全36枚</h2><p class="muted">ルノルマンはカード単体の意味だけでなく、隣り合うカードの組み合わせと質問の文脈を重視します。</p></div>${cardGrid(lenormandCards, "card-grid lenormand-grid")}</div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Lenormand Houses</p><h2>ルノルマンの36ハウス</h2><p class="muted">グランタブローでは36枚を並べた各位置に、1番の騎士から36番の十字架まで対応する「家」を置きます。実際にその場所へ出たカードと、家のテーマを重ねて読みます。</p></div>${cardGrid(lenormandHouses, "card-grid house-grid")}<div class="note-band"><strong>ハウスの読み方</strong><p>たとえば鍵がハートの家に出たら、関係の中の解決策や確信として読みます。家の意味だけで結論を出さず、周囲のカード、質問、人物カードとの距離を確認します。36ハウスはグランタブローの技法であり、3枚引きなどへ機械的に持ち込まないようにします。</p></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Spreads</p><h2>占い方とスプレッド</h2></div><div class="spread-grid"><article class="card"><h3>1枚引き｜今日の一歩</h3><p>質問を一つに絞り、カードのキーワードを一つの行動へ変換します。迷いが強い日は「今日守ること」を尋ねます。</p></article><article class="card"><h3>3枚引き｜状況・支え・一歩</h3><p>1枚目を現在地、2枚目を使える支え、3枚目を次の行動として読みます。過去・現在・未来に固定しないため、主体性を保ちやすい形です。</p></article><article class="card"><h3>5枚引き｜関係・選択</h3><p>中央をテーマ、上下を自分と相手、左右を障害と助けとして配置します。相手の気持ちを断定せず、確認できる行動に戻します。</p></article><article class="card"><h3>グランタブロー｜全体像</h3><p>ルノルマン36枚を使う大きな展開です。経験が必要なため、最初は全体を断定せず、質問に関係するカードの近接関係から読みます。</p></article></div><div class="note-band"><strong>読み終わったら</strong><p>カードの言葉をそのまま決定にせず、「確認すること」「試すこと」「保留すること」に分けます。医療・法律・投資など専門家の判断が必要な内容は、カードだけで決めないでください。</p></div></div></section></main>`);
}

function renderTarot() {
  return shell("タロットカード全78枚", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Tarot 78</p><h1>タロットカード全78枚</h1><p class="lead muted">一枚ずつ、カード名・中心テーマ・相談での読み方をまとめています。大アルカナ22枚と小アルカナ56枚を、スートと数字の流れとともに読みます。</p></div>${historySources()}${cardGrid(tarotCards, "card-grid tarot-grid")}${tarotVisualGuide()}<div class="note-band"><strong>組み合わせの基本</strong><p>左から右へ状況の流れを追い、中央のカードを主題にします。数字は単独で吉凶を決めず、スート・位置・絵柄・質問を重ねて読みます。</p><p><a href="/divination/lenormand">ルノルマンカードの解説へ →</a></p></div></div></section></main>`);
}

function renderLenormand() {
  return shell("ルノルマンカード全36枚", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Lenormand 36</p><h1>ルノルマンカード全36枚</h1><p class="lead muted">カード名・中心テーマ・相談での読み方を一枚ずつ整理しました。単体の意味だけでなく、隣り合うカード、人物カードとの距離、質問の文脈を重ねます。</p></div>${cardGrid(lenormandCards, "card-grid lenormand-grid")}<div class="section-title"><p class="eyebrow">Lenormand Houses</p><h2>36ハウス</h2><p class="muted">グランタブローの各位置に対応する家のテーマです。出たカードと家の意味を重ね、家だけで結論を出さないようにします。</p></div>${cardGrid(lenormandHouses, "card-grid house-grid")}<div class="note-band"><strong>並びと組み合わせ</strong><p>隣り合う2枚を短い句として読み、3枚以上では左から右の流れと中央の主題を確認します。グランタブローでは近接、対角線、人物カードとの距離を補助にします。</p><p><a href="/divination/tarot">タロットカードの解説へ →</a></p></div></div></section></main>`);
}

type SpreadPosition = { label: string; detail: string };
type SpreadPage = {
  title: string;
  subtitle: string;
  bestFor: string[];
  positions: SpreadPosition[];
  flow: string[];
  reading: string;
  example: string;
  caution: string;
};

const tarotSpreadMethods = [
  {
    title: "ワンオラクル｜1枚引き",
    bestFor: "今日のテーマ、短い助言、YES/NOに近い軽い確認、朝のセルフリーディング。",
    positions: "1枚だけを中央に置きます。位置の意味は「いま見るべき主題」または「今日の助言」に固定します。",
    reading: "一枚だからこそ、質問を狭くするほど読みやすくなります。「恋愛はどうなる？」より「今日、相手との距離感で意識することは？」のように、行動へ戻せる問いにします。カードの絵柄、人物の向き、明るさ、最初に目が止まった象徴を拾い、カード名の暗記だけで終わらせないのがコツです。",
    tarotPoint: "大アルカナなら一日の大きなテーマ、小アルカナなら具体的な行動や感情の扱いを見ます。逆位置は失敗の暗示ではなく、遅れ、内向き、過剰、未消化として読み分けます。",
  },
  {
    title: "ツーオラクル｜2枚引き",
    bestFor: "結果と対策、気持ちと行動、現状と助言を分けたい時。",
    positions: "1枚目を結果・現状・問いへの反応、2枚目を対策・助言・整えるポイントとして読みます。",
    reading: "1枚目で起きていることを見て、2枚目でどう扱うかを見ます。1枚目が厳しくても、2枚目に支えや具体策が出ていれば、読みはそこで現実的になります。ソルの読みでは、結果を怖がらせるより「何を変えれば流れが変わるか」を重視します。",
    tarotPoint: "同じスートが2枚出たら、そのテーマが濃い状態です。カップなら感情、ソードなら言葉と判断、ワンドなら勢い、ペンタクルなら条件や時間を中心に読みます。",
  },
  {
    title: "ツーマインド｜2枚引き",
    bestFor: "自分の本音、相手の表向きと奥の気持ち、言葉と本心のズレを見たい相談。",
    positions: "上のカードを顕在意識、下のカードを潜在意識として置きます。上は自覚している考え、下はまだ言葉になっていない感情や怖れです。",
    reading: "上と下が同じ方向を向くなら、気持ちと言葉が比較的一致しています。違うスートや逆位置で割れるなら、頭では分かっていても気持ちが追いつかない、または感情はあるのに表現が固い、という読みになります。相手を読む場合も断定せず、見えている態度との整合性を確認します。",
    tarotPoint: "月、女教皇、カップ系は内面の反応を拾いやすく、ソード系は理屈や防衛が強く出ます。潜在意識側のカードを重く扱いすぎず、表面の行動と合わせて判断します。",
  },
  {
    title: "シンプルクロス｜2枚引き",
    bestFor: "問題の正体、妨げ、今つまずいている理由を短く知りたい時。",
    positions: "縦のカードを現在の状況、横に重ねるカードを妨害・課題・乗り越えるべき要素として読みます。",
    reading: "1枚目だけなら単なる現状把握ですが、2枚目を重ねることで「なぜ進みにくいのか」が見えます。横のカードが人物カード的に読める場合は、誰かの言葉や環境の影響として、数札なら具体的な負担やタイミングとして扱います。",
    tarotPoint: "障害カードが大アルカナなら根深いテーマ、小アルカナなら調整可能な現実課題として読みます。障害を敵と見なすのではなく、解決前に見ておくべき注意点に変換します。",
  },
  {
    title: "スリーカード｜3枚引き",
    bestFor: "過去・現在・未来、今日・明日・明後日、A/B/Cの比較など、流れや三択を見たい時。",
    positions: "左から過去、現在、未来として置くのが基本です。目的に応じて、原因・状態・助言、または選択肢A・B・Cとして使うこともできます。",
    reading: "左から右へ時間の流れを作り、中央の現在カードを読みの軸にします。過去は原因探しで自分を責める位置ではなく、いまの状況がどこから来たかを見る場所です。未来は確定ではなく、現在の姿勢のまま進んだ場合に出やすい傾向として扱います。",
    tarotPoint: "未来位置に厳しいカードが出た時ほど、現在位置と助言を見直します。未来は変えられる前提で読み、行動の修正点を探します。",
  },
  {
    title: "ゴールデントリン・スプレッド｜3枚引き",
    bestFor: "結果・現状・対策を短時間で立体的に見たい相談。恋愛、仕事、金運、健康、近未来の確認に向きます。",
    positions: "上に総合結果や近い未来、左下に具体的な現状、右下に対策や周囲から得られる助けを置きます。",
    reading: "三角形で読むため、上のカードだけを結果として切り離さず、下の2枚が上へどう影響するかを見ます。左下が現状の重さ、右下が使える手段です。相手がいる相談では、左下を相手との現在の状態として読むこともあります。",
    tarotPoint: "上に大アルカナが出ると、相談全体のテーマが強くなります。下2枚が小アルカナなら、現実の行動で上のカードの出方を調整できる余地があります。",
  },
  {
    title: "フォーカード｜4枚引き",
    bestFor: "過去から未来への流れ、障害と対策、関係性の現状整理。",
    positions: "左から過去、現在、障害・対策、未来として並べます。相談により、自分、相手、障害、結果として読むこともできます。",
    reading: "3枚引きに対策の位置を足した形です。未来を見る前に、3枚目で何が流れを止めているか、または何を使えば流れが変わるかを確認します。未来カードは、対策を取らない場合と取った場合の差を考えるための材料にします。",
    tarotPoint: "3枚目が鍵です。ソードなら言葉の整理、ワンドなら行動量、カップなら感情の扱い、ペンタクルなら現実条件の調整が対策になります。",
  },
  {
    title: "ギリシャ十字｜5枚引き",
    bestFor: "大まかな展開、問題の原因、対策と結果をバランスよく見たい時。",
    positions: "現在、障害や原因、現状維持で進んだ場合の傾向、問題解決の対策、最終結果の5点で読みます。",
    reading: "十字の中心に近い現在と障害を先に読み、次に流れのまま進んだ場合と、対策を取った場合の違いを見ます。未来を深く掘りすぎるより、現状からどう向きが変わるかを把握する展開です。",
    tarotPoint: "対策位置と結果位置の相性を見ます。対策が小アルカナで結果が大アルカナなら、小さな行動が大きなテーマへつながる読みになります。",
  },
  {
    title: "ピラミッド｜6枚引き",
    bestFor: "複雑な現状を整理し、複数の解決策から方向を作りたい相談。",
    positions: "下段3枚を現在の状態、中段2枚を解決方法、上段1枚を最終結果として読みます。",
    reading: "下段の3枚で、問題を一つにまとめず複数の要因として見ます。中段では、どの要因を先に扱うと上段の結果へ進みやすいかを読みます。ピラミッドは下から積み上げる展開なので、結果だけを見ず、土台のカードを丁寧に扱います。",
    tarotPoint: "下段に同じスートが固まると、現状の偏りが見えます。中段に出たカードは、解決策そのものだけでなく、相談者が使うべき姿勢として読みます。",
  },
  {
    title: "ヘキサグラムスプレッド｜7枚引き",
    bestFor: "一つの悩みを多角的に見たい時。恋愛、仕事、人生相談、自己分析にも使いやすい展開です。",
    positions: "過去の状態、現在の状況、未来の傾向、具体的な対策、周辺環境、自分を取り巻く環境、最終結果・問題の核心を読みます。",
    reading: "過去・現在・未来の時間軸に、対策と環境を重ねて読む展開です。4枚目の対策は、未来を変えるための介入点として重要です。5枚目と6枚目で外側の状況と自分側の環境を分け、最後のカードで問題の核心へ戻します。",
    tarotPoint: "7枚目は単なる結果ではなく、全体を貫く核心として読みます。大アルカナならテーマ性が強く、小アルカナなら現実的な調整点が核心になります。",
  },
  {
    title: "二者択一｜7枚引き",
    bestFor: "AかBかで迷う時。告白するか待つか、続けるか離れるか、転職するか残るかなど。",
    positions: "現在、選択肢Aの現在、選択肢Bの現在、Aの未来、Bの未来、Aの最終傾向、Bの最終傾向を読みます。",
    reading: "どちらが正解かをカードに丸投げする展開ではありません。Aを選んだ場合とBを選んだ場合、それぞれ何が起きやすく、何を引き受ける必要があるかを比べます。最初にAとBの内容をはっきり決めてから引くと、読みがぶれません。",
    tarotPoint: "AとBに出るスートの違いを見ると、選択の質が分かります。カップが多い側は気持ち、ペンタクルが多い側は安定、ソードが多い側は判断、ワンドが多い側は挑戦が主題になります。",
  },
  {
    title: "ケルト十字スプレッド｜10枚引き",
    bestFor: "恋愛、仕事、人生の転機など、背景・障害・本人の意識・周囲の影響が絡む相談。",
    positions: "現在、障害、顕在意識、潜在意識、過去、近未来、自分の立場、相手や周囲の状況、希望と不安、最終結果の10点で読みます。",
    reading: "最初に現在と障害を一文でまとめ、次に顕在意識と潜在意識のズレを見ます。過去と近未来は決定論ではなく、今の流れがどこから来てどこへ向きやすいかを確認する位置です。最後の総合結果は固定された未来ではなく、前の9枚を踏まえた到達しやすい方向として読みます。",
    tarotPoint: "大アルカナが多い時は人生テーマや価値観の転換、小アルカナが多い時は日常の行動調整を重視します。ソードが多ければ言葉と判断、カップが多ければ感情、ワンドが多ければ熱量、ペンタクルが多ければ現実条件を重点的に見ます。",
  },
  {
    title: "生命の樹スプレッド｜10枚引き",
    bestFor: "人生の方向性、魂の課題、才能の使い方、仕事と使命感の接点を深く見たい時。",
    positions: "10枚を生命の樹の10セフィラに対応させます。1は意志や始まり、2は直感、3は理解、4は広がり、5は制限、6は調和、7は感情や魅力、8は思考や技術、9は無意識の土台、10は現実化として読みます。",
    reading: "生命の樹は、出来事の結果だけを見る展開ではなく、上から下へ意識が形になっていく流れを読む展開です。上部のカードで理想や魂の方向、中段で心と判断の葛藤、下部で現実に表れる行動や環境を見ます。ソルの読みでは、壮大な言葉で終わらせず、「いまの自分がどの段階で止まりやすいか」「どこを整えると現実が動きやすいか」へ落とし込みます。",
    tarotPoint: "1から3に大アルカナが多い場合は、人生観や使命感のテーマが強く出ます。7から9にカップや月のような内面カードが集まる時は、感情や無意識の整理が先です。10の現実化位置にペンタクルやワンドが出ると、具体的な行動や生活の形に移せる兆しとして読みます。",
  },
  {
    title: "ホロスコープ・スプレッド｜13枚引き",
    bestFor: "一年の運勢、生活全体の流れ、恋愛・仕事・金運・人間関係をまとめて見たい時。",
    positions: "1から12を各ハウスまたは各月に対応させ、13枚目を全体の核心として中央に置きます。1は自分、2は金銭、3は会話、4は家庭、5は恋愛、6は健康や日常、7は対人、8は深い関係、9は理想や学び、10は仕事や成功、11は友人、12は無意識を見ます。",
    reading: "占星術のハウスのように、人生の領域ごとにカードを置く大きな展開です。まず13枚目で全体テーマを確認し、次に相談者が特に知りたい領域を優先して読みます。すべてのカードを同じ重さで読むと散らかるため、中央カードと関係の強い領域から深掘りします。",
    tarotPoint: "12領域の中で大アルカナが出た場所は、その年や期間で意識が向きやすいテーマです。スートの偏りも重要で、カップが多い年は感情と関係、ペンタクルが多い年は生活基盤、ソードが多い年は判断、ワンドが多い年は挑戦が中心になります。",
  },
];

const tarotSpreadSlugs = [
  "one-oracle",
  "two-oracle",
  "two-mind",
  "simple-cross",
  "three-card",
  "golden-trine",
  "four-card",
  "greek-cross",
  "pyramid",
  "hexagram",
  "two-choices",
  "celtic-cross",
  "tree-of-life",
  "horoscope",
];

const tarotSpreadLayouts: Record<string, string[][]> = {
  "ワンオラクル｜1枚引き": [["1"]],
  "ツーオラクル｜2枚引き": [["1", "2"]],
  "ツーマインド｜2枚引き": [["1"], ["2"]],
  "シンプルクロス｜2枚引き": [["", "2", ""], ["", "1", ""]],
  "スリーカード｜3枚引き": [["1", "2", "3"]],
  "ゴールデントリン・スプレッド｜3枚引き": [["", "1", ""], ["2", "", "3"]],
  "フォーカード｜4枚引き": [["1", "2", "3", "4"]],
  "ギリシャ十字｜5枚引き": [["", "3", ""], ["2", "1", "4"], ["", "5", ""]],
  "ピラミッド｜6枚引き": [["", "", "6", "", ""], ["", "4", "", "5", ""], ["1", "", "2", "", "3"]],
  "ヘキサグラムスプレッド｜7枚引き": [["", "1", ""], ["6", "", "2"], ["", "7", ""], ["5", "", "3"], ["", "4", ""]],
  "二者択一｜7枚引き": [["", "1", ""], ["2", "", "3"], ["4", "", "5"], ["6", "", "7"]],
  "ケルト十字スプレッド｜10枚引き": [["", "3", "", "", "10"], ["5", "1", "6", "", "9"], ["", "2", "", "", "8"], ["", "4", "", "", "7"]],
  "生命の樹スプレッド｜10枚引き": [["", "1", ""], ["2", "", "3"], ["", "4", ""], ["5", "", "6"], ["", "7", ""], ["8", "", "9"], ["", "10", ""]],
  "ホロスコープ・スプレッド｜13枚引き": [["", "11", "12", "1", ""], ["10", "", "13", "", "2"], ["9", "", "", "", "3"], ["", "8", "7", "6", "5"], ["", "", "4", "", ""]],
};

function tarotSpreadSlug(item: (typeof tarotSpreadMethods)[number], index: number) {
  return `tarot-${tarotSpreadSlugs[index] || String(index + 1)}`;
}

function tarotSpreadDiagram(item: (typeof tarotSpreadMethods)[number]) {
  const rows = tarotSpreadLayouts[item.title] || [["1"]];
  return `<div class="spread-map" aria-label="${escapeHtml(item.title)}の配置図">${rows.map((row) => `<div class="spread-row">${row.map((cell) => `<span class="spread-slot${cell ? "" : " empty"}">${escapeHtml(cell || "-")}</span>`).join("")}</div>`).join("")}</div>`;
}

function tarotSpreadCard(item: (typeof tarotSpreadMethods)[number], index: number) {
  const slug = tarotSpreadSlug(item, index);
  return `<article class="card">${tarotSpreadDiagram(item)}<h3><a href="/divination/spreads/${slug}">${escapeHtml(item.title)}</a></h3><p><span class="kicker">向いている相談</span>${escapeHtml(item.bestFor)}</p><p><span class="kicker">配置</span>${escapeHtml(item.positions)}</p><p><span class="kicker">読み方</span>${escapeHtml(item.reading)}</p><p><span class="kicker">タロットで見るポイント</span>${escapeHtml(item.tarotPoint)}</p></article>`;
}

function renderTarotSpread(slug: string) {
  const index = tarotSpreadSlugs.findIndex((item) => `tarot-${item}` === slug);
  const item = index >= 0 ? tarotSpreadMethods[index] : undefined;
  if (!item) return null;
  return shell(item.title, `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Tarot Spread Detail</p><h1>${escapeHtml(item.title)}</h1><p class="lead muted">${escapeHtml(item.bestFor)}</p></div>${tarotSpreadDiagram(item)}<div class="card-grid detail-grid"><article class="card"><h3>配置</h3><p>${escapeHtml(item.positions)}</p></article><article class="card"><h3>読み方</h3><p>${escapeHtml(item.reading)}</p></article><article class="card"><h3>タロットで見るポイント</h3><p>${escapeHtml(item.tarotPoint)}</p></article></div><div class="note-band"><strong>読む順番</strong><p>質問を一文に整え、配置の役割を確認し、まず全体の印象を見ます。次に大アルカナの有無、スートの偏り、逆位置、隣り合うカードの補足関係を順に読み、最後は相談者が今日確認できる行動へまとめます。</p><p>ソルの読みでは、結果を固定せず「どこを整えると流れが変わるか」を大切にします。迷った時は、強いカード一枚に引っ張られすぎず、配置全体の流れへ戻します。</p></div><p><a href="/divination/spreads">展開法一覧へ戻る</a></p></div></section></main>`);
}

const spreadPages: Record<string, SpreadPage> = {
  "one-card": {
    title: "1枚引き｜今日の一歩",
    subtitle: "迷いを一つに絞り、今日確認できる行動へ戻す展開法。",
    bestFor: ["朝のメッセージ", "気持ちの確認", "選択前の軸づくり", "疲れていて多くを考えたくない時"],
    positions: [
      { label: "カード1｜今日のテーマ・助言", detail: "カード全体の印象、目に入った色や人物の向き、最初に浮かんだ言葉を拾います。意味を広げすぎず、今日一日で意識できる小さな指針へ落とし込みます。" },
    ],
    flow: ["質問を一文にする", "カードを見て第一印象を一語でメモする", "一般的なカード意味と質問を重ねる", "今日できる行動、休むこと、確認することに分ける"],
    reading: "1枚引きは簡単に見えて、質問の精度がそのまま結果の深さになります。「どうなる？」ではなく「今日は何を大切にする？」「いま見落としている支えは？」のように、自分が扱える問いへ整えると読みが安定します。カードは結論ではなく、注意を向ける場所を示す目印として扱います。",
    example: "「今日は何を大切にするとよい？」と尋ねて太陽が出たなら、成功の断定ではなく、明るく見える場所へ一歩出る、できたことを記録する、隠さず伝える、という行動に翻訳します。",
    caution: "未来の出来事や相手の気持ちを一枚だけで断定しません。迷いが大きい時ほど、追加で何枚も引き直すより、最初の一枚から行動を一つ決める方が読みが濁りません。",
  },
  "three-card": {
    title: "3枚引き｜状況・支え・一歩",
    subtitle: "現在地、使える支え、次の行動を順番に見る基本展開。",
    bestFor: ["恋愛や人間関係の整理", "仕事・生活の小さな判断", "気持ちと現実を分けたい時", "初心者が流れを読む練習"],
    positions: [
      { label: "1枚目｜現在地・起きていること", detail: "問題そのものではなく、いま自分がどこに立っているかを見ます。カードが重くても、ここでは責める材料にせず、状況の名前をつける位置として扱います。" },
      { label: "2枚目｜支え・使える資源", detail: "人、時間、情報、経験、休息など、すでに使えるものを探します。良いカードなら頼れる支え、厳しいカードなら先に整える条件として読みます。" },
      { label: "3枚目｜次の一歩・試すこと", detail: "最終結果ではなく、次に試す小さな行動です。連絡する、待つ、調べる、断る、休むなど、24時間から数日で確認できるサイズへ変換します。" },
    ],
    flow: ["1枚目で現状を短く要約する", "2枚目で助けになるものを探す", "3枚目で行動サイズへ落とす", "3枚を一文にして読み筋を確認する"],
    reading: "3枚引きは「過去・現在・未来」だけに固定しない方が、ソルのサイトでは使いやすいです。現在地、支え、一歩にすると、結果待ちの占いではなく、相談者が選び直せる読みになります。左から右へ時間の流れを作りつつ、中央の支えが弱い場合は先に環境調整を提案します。",
    example: "仕事の迷いなら、1枚目で負担の正体、2枚目で相談できる相手や手元の資料、3枚目で今日送る確認メールのように具体化します。恋愛なら、今の距離感、安心して使える言葉、次に確認する会話へ分けます。",
    caution: "3枚のうち一枚だけを吉凶で判断しません。悪く見えるカードも、位置によっては「注意点を教えてくれているカード」になります。隣接するカードが補足し合うか、質問に対してどの位置で出たかを優先します。",
  },
  "five-card": {
    title: "5枚引き｜関係・選択",
    subtitle: "テーマの中心と、自分・相手・障害・助けを立体的に見る展開法。",
    bestFor: ["恋愛相性", "復縁や距離感", "人間関係のすれ違い", "選択肢が複数ある相談"],
    positions: [
      { label: "中央｜相談の主題", detail: "この展開全体の焦点です。まず中央だけで一文のテーマを作り、ほかの4枚は中央を説明する補助として読みます。" },
      { label: "上｜自分の状態・選べること", detail: "自分の気持ち、態度、使える選択肢を見ます。相手の反応を待つ前に、自分が守る線や伝える言葉を整える位置です。" },
      { label: "下｜相手・環境から見える事実", detail: "相手の内心を決めつける位置ではありません。実際の行動、連絡頻度、状況、周囲の条件など、観察できる材料として読みます。" },
      { label: "左｜障害・見落とし", detail: "読みのブレーキです。誤解、焦り、古い癖、情報不足など、先に確認すべきものを示します。" },
      { label: "右｜助け・次に使えるもの", detail: "関係を整えるための支援です。言葉、タイミング、第三者、休息、距離の取り方など、現実に使える助けへ変換します。" },
    ],
    flow: ["中央でテーマを固定する", "上と下で自分と相手・環境を分ける", "左と右で障害と助けを比べる", "最後に中央へ戻って総括する"],
    reading: "5枚引きは、関係性の相談で特に力を出します。大切なのは、自分の気持ちと相手の事情を混ぜないことです。中央を主題にして、上は自分、下は観察できる相手や環境、左は詰まり、右は助けとして読むと、感情の渦から一段離れて整理できます。",
    example: "関係の相談では、中央を「いま整えたい距離感」にして、上を自分の境界線、下を確認できる相手の行動として読みます。左に剣のカードが出たら言葉の刺さり方、右に杯のカードが出たら安心して話せる雰囲気づくりを提案します。",
    caution: "相手の気持ち・第三者の秘密・結果の確定をカードで代用しません。本人との対話と同意を大切にし、確認不能な内面の断定ではなく、相談者が選べる言葉と距離へ戻します。",
  },
  "grand-tableau": {
    title: "グランタブロー｜全体像",
    subtitle: "ルノルマン36枚を並べ、近接関係とハウスから大きな流れを読む展開法。",
    bestFor: ["数か月単位の流れ", "生活全体の整理", "複数テーマが絡む相談", "ルノルマンに慣れた人の深掘り"],
    positions: [
      { label: "36枚｜1番から36番までの全体配置", detail: "全カードを並べ、相談者を取り巻く地図として見ます。全体を一気に読むのではなく、質問に関係するカードから読み始めます。" },
      { label: "人物カード｜相談者・関係者の位置", detail: "紳士・淑女など人物カードの周囲を見ます。近くのカードは影響が強く、遠いカードは背景や時間差として扱います。" },
      { label: "ハウス｜各位置のテーマ", detail: "カードが置かれた場所そのものにも意味を持たせます。たとえば鍵がハートの家に出るなら、関係の中の解決策や確信として読みます。" },
      { label: "近接カード｜短い句としての組み合わせ", detail: "隣り合う2枚から短い言葉を作ります。鳥と手紙なら連絡の不安、犬と錨なら長く頼れる支え、というように具体化します。" },
    ],
    flow: ["質問範囲を決める", "人物カードとテーマカードを探す", "近接・列・対角線を順に読む", "ハウスの意味を重ねる", "確認できる現実の行動に戻す"],
    reading: "グランタブローは、カード一枚の意味よりも距離、方向、密集、孤立を読む展開です。人物カードの周囲に何が集まるか、テーマカードが近いか遠いか、障害カードがどの列にあるかを見て、相談者の生活全体の地図を作ります。大きな展開なので、最初に『恋愛だけ』『仕事と生活だけ』のように範囲を決めると読みが締まります。",
    example: "再出発の相談なら、人物カードの周囲から現在の支えと障害を読み、遠い位置のカードは背景情報として扱います。道が近く、錨が遠いなら、選択は近いが安定には少し時間が必要、という読み筋になります。",
    caution: "経験の必要な大きな展開です。家の意味だけで結論を出さず、複数の読み筋を比較し、現実に確認できる事項へ戻します。重いカードが出ても、恐怖をあおる表現にはしません。",
  },
};

function spreadCard(slug: string, item: (typeof spreadPages)[string]) {
  return `<article class="card"><h3><a href="/divination/spreads/${slug}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.subtitle)}</p><p><span class="kicker">向いている相談</span>${item.bestFor.map(escapeHtml).join("・")}</p></article>`;
}

function tarotSpreadSection() {
  return `<section><div class="wrap"><div class="section-title"><p class="eyebrow">Tarot Spreads</p><h2>タロットの展開法</h2><p class="muted">タロットでは、カードの意味だけでなく「どの位置に出たか」が読みの骨格になります。ソルは、カードを未来の判決文のようには扱いません。問いを整え、配置を決め、出たカード同士の響き合いを見て、最後は相談者が今日選べる一歩へ戻します。</p></div><div class="note-band"><strong>タロットのやり方とカードの並べ方</strong><p>最初にすることは、カードを混ぜることではなく、質問を一文にすることです。「恋愛はどうなる？」よりも「今の距離感で、私が大切にした方がいいことは？」のように、心の向け先が分かる問いに整えます。問いが曖昧なまま枚数を増やすと、カードはたくさん出ても読み筋が散ります。</p><p>シャッフルとカットは、集中を切り替えるための所作として行います。カードを並べたら、先に決めた位置の意味を途中で変えません。結果がほしい時ほど、まず現在・障害・助言を分け、相手がいる相談では「自分側で確認できること」と「相手側に見えている反応」を混同しないように読みます。</p><p>読む順番は、全体の印象、強いカード、大アルカナの数、スートの偏り、各位置の意味、隣り合うカードの補足関係、最後の行動提案です。怖いカードが出ても、そこで止めずに「何を見落とさないためのカードか」へ言葉を戻すのが、ソルの読み方です。</p></div><div class="note-band"><strong>枚数の選び方</strong><p>1枚引きは心の焦点を合わせる読み、2枚引きは原因と対策を分ける読み、3枚引きは流れを見る読みです。4枚から7枚になると、障害・環境・選択肢の比較まで扱えます。10枚のケルト十字は背景と深層、生命の樹は意志から現実化までの内的な流れを掘る読みです。13枚のホロスコープ・スプレッドは生活全体や一年の流れを見る大きな読みになります。</p></div><div class="card-grid">${tarotSpreadMethods.map((item, index) => tarotSpreadCard(item, index)).join("")}</div><div class="note-band"><strong>逆位置の扱い</strong><p>逆位置は「悪い意味」だけに固定しません。力が内側に向く、遅れる、過剰になる、表に出にくい、というように読み分けます。たとえばカップの逆位置は愛情がないと断定せず、感情を出しにくい、受け取り方が不安定、期待が大きくなりすぎている可能性として確認します。</p><p>ソルの読みでは、怖がらせる断定よりも、相談者が次に確認できることへ戻します。カードの配置、スートの偏り、大アルカナの枚数、隣り合うカードの補足関係を合わせて、最後は「今日できる一歩」にまとめます。</p></div></div></section>`;
}

function renderSpreads() {
  return shell("スプレッド（展開法）", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Spreads</p><h1>スプレッド（展開法）</h1><p class="lead muted">スプレッドは、カードを何枚置くかではなく「どの位置に、どんな役割を持たせるか」を決める読みの設計図です。同じカードでも、現在地に出るのか、助けに出るのか、障害に出るのかで意味は変わります。だからソルは、カードをめくる前に質問・配置・読む順番を先に固定します。</p></div><div class="note-band"><strong>スプレッド選びの基準</strong><p>短い気づきが欲しい時は1枚引き、状況を整理したい時は3枚引き、相手や環境との関係を見たい時は5枚引き、生活全体の流れを読みたい時はグランタブローを使います。枚数が多いほど当たるのではなく、問いに合う広さを選ぶことが大切です。</p></div><div class="card-grid">${Object.entries(spreadPages).map(([slug, item]) => spreadCard(slug, item)).join("")}</div><div class="note-band"><strong>共通の読み方</strong><p>質問を一つに絞る → 配置を決める → 第一印象を記録する → 位置の役割を読む → 隣接関係を確認する → 今日確認できる行動へ戻す、の順で進めます。迷った時は、最後に「この読みから、いま自分が選べることは何か」へ戻します。</p><p><a href="/divination/tarot">タロットカード解説</a>｜<a href="/divination/lenormand">ルノルマンカード解説</a></p></div></div></section>${tarotSpreadSection()}</main>`);
}

function renderSpread(slug: string) {
  const item = spreadPages[slug];
  if (!item) return null;
  return shell(item.title, `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Spread Guide</p><h1>${escapeHtml(item.title)}</h1><p class="lead muted">${escapeHtml(item.subtitle)}</p></div><div class="note-band"><strong>向いている相談</strong><p>${item.bestFor.map(escapeHtml).join("・")}</p></div><div class="section-title"><h2>配置</h2></div><div class="card-grid">${item.positions.map((position) => `<article class="card"><h3>${escapeHtml(position.label)}</h3><p>${escapeHtml(position.detail)}</p></article>`).join("")}</div><div class="section-title"><h2>読む順番</h2></div><div class="card-grid">${item.flow.map((step, index) => `<article class="card"><span class="kicker">Step ${index + 1}</span><h3>${escapeHtml(step)}</h3><p>この段階で読みを広げすぎず、次の位置へ渡すための要点を一つに絞ります。</p></article>`).join("")}</div><div class="section-title"><h2>読み方</h2></div><div class="note-band"><p>${escapeHtml(item.reading)}</p><p><strong>読み終わったら：</strong>${escapeHtml(item.example)}</p></div><div class="note-band"><strong>注意点</strong><p>${escapeHtml(item.caution)}</p></div><p><a href="/divination/spreads">展開法一覧へ戻る</a></p></div></section></main>`);
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
    if (url.pathname === "/divination") return new Response(renderDivination(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (url.pathname === "/guild" || url.pathname === "/guild/") return new Response(renderGuild(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (url.pathname === "/divination/tarot") return new Response(renderTarot(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (url.pathname === "/divination/lenormand") return new Response(renderLenormand(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (url.pathname === "/divination/spreads") return new Response(renderSpreads(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (url.pathname.startsWith("/divination/spreads/")) {
      const spreadSlug = url.pathname.slice("/divination/spreads/".length);
      const rendered = renderSpread(spreadSlug) || renderTarotSpread(spreadSlug);
      if (rendered) return new Response(rendered, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
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
