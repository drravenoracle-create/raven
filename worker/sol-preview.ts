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
  <header><a class="brand" href="#top"><span class="mark">S</span><span>ソル・オーロラ<br><small class="muted">Raven Guild｜希望の案内役</small></span></a><nav aria-label="メインナビゲーション"><a href="#about">ソルについて</a><a href="#reading">相談の入口</a><a href="#steps">読み方</a><a href="/divination">カード解説</a><a href="#notes">ご案内</a></nav></header>
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
  :root{--ink:#26352d;--muted:#65736a;--line:#d9e3d4;--deep:#233f31;--paper:#fffdf8;--gold:#c99832;--shadow:0 12px 32px rgba(44,72,52,.09)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#fffdf8,#f4f8ee 55%,#fffaf0);color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;line-height:1.8}a{color:inherit}header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px clamp(20px,5vw,72px);border-bottom:1px solid rgba(217,227,212,.9);background:rgba(255,253,248,.92);backdrop-filter:blur(14px)}.brand{font-weight:800;text-decoration:none}.brand small{font-weight:500;color:var(--muted)}nav{display:flex;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:14px;font-weight:700}nav a{text-decoration:none}.wrap{width:min(1160px,100%);margin:0 auto}section{padding:70px clamp(20px,6vw,88px)}.section-title{max-width:760px;margin-bottom:26px}.section-title h2{margin:6px 0 0;font-family:Georgia,"Noto Serif JP",serif;font-size:clamp(29px,4vw,46px);line-height:1.25}.eyebrow{margin:0;color:var(--gold);font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.lead{max-width:760px;font-size:18px}.muted{color:var(--muted)}.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:16px}.card{padding:22px;border:1px solid var(--line);border-radius:12px;background:rgba(255,253,248,.9);box-shadow:var(--shadow)}.card h3{margin:0 0 7px;font-size:18px;line-height:1.45}.card p{margin:0;color:var(--muted)}.kicker{display:block;margin-top:4px;color:#9b7426;font-size:12px;font-weight:800}.note-band,.history-note{margin-top:24px;padding:22px 24px;border:1px solid #e7d9a8;border-radius:12px;background:linear-gradient(135deg,#fff8dc,#f1f7e9)}.note-band p,.history-note p{margin:.45em 0}.visual-guide{padding-top:8px}.spread-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.footer{padding:32px clamp(20px,6vw,88px);background:var(--deep);color:#edf5e8}.footer a{color:#fff1c9}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}header nav{gap:10px;font-size:13px}section{padding-block:52px}}</style></head><body><header><a class="brand" href="/">ソル・オーロラ<br><small>Raven Guild｜希望の案内役</small></a><nav aria-label="メインナビゲーション"><a href="/">ホーム</a><a href="/divination">カード解説</a></nav></header>${content}<footer class="footer"><strong>ソル・オーロラ｜Raven Guild</strong></footer></body></html>`;
}

function renderDivination() {
  return shell("ソルのカード占い解説", `<main><section><div class="wrap"><div class="section-title"><p class="eyebrow">Card Reading Guide</p><h2>カードから、今日の一歩へ。</h2></div><p class="lead muted">ソルはカードを未来の断定に使わず、いまの気持ちや状況を言葉にするための鏡として扱います。オラクルカードはデッキごとに枚数と名称が異なるため、ここでは共通して使えるテーマを紹介し、ルノルマンは標準36枚、タロットは標準78枚を一枚ずつ解説します。</p><div class="note-band"><strong>カードの歴史</strong><p>タロットは15世紀の北イタリアで、切り札を加えたカードゲームとして発展した記録が残っています。18世紀末以降に占いとの結びつきが強まり、現代の多様なデッキへ広がりました。ルノルマンは19世紀に広まった36枚のカード占いで、マリー・アンヌ・アデライード・ルノルマンの名を冠した後世のデッキとして定着しています。どちらも起源には諸説があるため、伝説を史実として断定しません。</p><p>オラクルカードは特定の一つの標準デッキではなく、作者やデッキごとに枚数・名称・ガイドが異なる形式です。公式ガイドがある場合は、そのデッキの説明を最優先します。</p>${historySources()}<div class="note-band"><strong>占う前の準備</strong><p>質問を「どうなりますか」だけで終わらせず、「いま確認したいこと」「自分で選べること」へ言い換えます。深呼吸をして、結果を急いで決めない時間を確保しましょう。</p></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Oracle Cards</p><h2>オラクルカードの基本テーマ</h2><p class="muted">デッキ固有の公式ガイドブックがある場合はそちらを優先し、以下はカードの印象を相談へつなげるための汎用的な読み方です。</p></div>${cardGrid(oracleThemes)}<div class="note-band"><strong>オラクルカードの読み方</strong><p>絵、色、最初に浮かんだ言葉、身体の反応をメモし、テーマを一つに絞ります。正位置・逆位置を固定せず、カードの助言を「今日できる行動」と「休む選択肢」に翻訳します。</p></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Tarot 78</p><h2>タロットカード全78枚</h2><p class="muted">大アルカナ22枚は人生の大きなテーマ、小アルカナ56枚はワンド・カップ・ソード・ペンタクルの4スートとして、状況の具体的な動きを読みます。</p></div>${cardGrid(tarotCards, "card-grid tarot-grid")}${tarotVisualGuide()}</div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Combinations</p><h2>カードの並びと組み合わせ</h2><p class="muted">カードは単体の吉凶で決めず、質問・位置・隣接カードを合わせます。複数枚では左から右へ流れを追い、中央のカードを主題にするなど、最初に決めた配置ルールを途中で変えません。</p></div>${cardGrid(cardCombinations, "card-grid combination-grid")}</div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Lenormand 36</p><h2>ルノルマンカード全36枚</h2><p class="muted">ルノルマンはカード単体の意味だけでなく、隣り合うカードの組み合わせと質問の文脈を重視します。</p></div>${cardGrid(lenormandCards, "card-grid lenormand-grid")}</div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Lenormand Houses</p><h2>ルノルマンの36ハウス</h2><p class="muted">グランタブローでは36枚を並べた各位置に、1番の騎士から36番の十字架まで対応する「家」を置きます。実際にその場所へ出たカードと、家のテーマを重ねて読みます。</p></div>${cardGrid(lenormandHouses, "card-grid house-grid")}<div class="note-band"><strong>ハウスの読み方</strong><p>たとえば鍵がハートの家に出たら、関係の中の解決策や確信として読みます。家の意味だけで結論を出さず、周囲のカード、質問、人物カードとの距離を確認します。36ハウスはグランタブローの技法であり、3枚引きなどへ機械的に持ち込まないようにします。</p></div></div></section><section><div class="wrap"><div class="section-title"><p class="eyebrow">Spreads</p><h2>占い方とスプレッド</h2></div><div class="spread-grid"><article class="card"><h3>1枚引き｜今日の一歩</h3><p>質問を一つに絞り、カードのキーワードを一つの行動へ変換します。迷いが強い日は「今日守ること」を尋ねます。</p></article><article class="card"><h3>3枚引き｜状況・支え・一歩</h3><p>1枚目を現在地、2枚目を使える支え、3枚目を次の行動として読みます。過去・現在・未来に固定しないため、主体性を保ちやすい形です。</p></article><article class="card"><h3>5枚引き｜関係・選択</h3><p>中央をテーマ、上下を自分と相手、左右を障害と助けとして配置します。相手の気持ちを断定せず、確認できる行動に戻します。</p></article><article class="card"><h3>グランタブロー｜全体像</h3><p>ルノルマン36枚を使う大きな展開です。経験が必要なため、最初は全体を断定せず、質問に関係するカードの近接関係から読みます。</p></article></div><div class="note-band"><strong>読み終わったら</strong><p>カードの言葉をそのまま決定にせず、「確認すること」「試すこと」「保留すること」に分けます。医療・法律・投資など専門家の判断が必要な内容は、カードだけで決めないでください。</p></div></div></section></main>`);
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
