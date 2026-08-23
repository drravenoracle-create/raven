import Link from "next/link";
import { methodDetails } from "./data";

const methods = methodDetails.map((method) => ({
  ...method,
  href: `/divination-methods/${method.slug}/`,
}));

const foundationLinks = [
  {
    href: "/divination-dictionary/yin-yang-five-elements/",
    title: "陰陽五行",
    body: "四つの占術に共通する、気の偏りと関係性の読み方。",
  },
  {
    href: "/divination-dictionary/stems-branches-calendar/",
    title: "十干十二支と暦",
    body: "時、日、月、年を占術の盤に変えるための基礎。",
  },
  {
    href: "/divination-dictionary/directions-nine-palaces/",
    title: "方位と九宮",
    body: "奇門遁甲や太乙神数で使う、場を読むための地図。",
  },
];

export const metadata = {
  title: "レイヴン・ブラックウッドの占術 | 奇門遁甲・六壬神課・太乙神数・易経",
  description:
    "レイヴン・ブラックウッドが扱う奇門遁甲、六壬神課、太乙神数、易経と、その基盤になる陰陽五行、十干十二支、方位と九宮を解説します。",
};

export default function DivinationMethodsPage() {
  return (
    <main className="raven-page min-h-screen bg-[#f5f0e8] text-[#20241f]">
      <section className="raven-content-shell mx-auto max-w-6xl px-5 py-8">
        <header className="raven-card p-5 sm:p-6">
          <nav className="mb-5 flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]">
            <Link href="/">レイヴン・ブラックウッド</Link>
            <Link href="/guild/">ギルド紹介</Link>
            <Link href="/text-reading/">AIテキスト鑑定</Link>
            <Link href="/blog/">ブログ</Link>
          </nav>
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Divination Methods</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">
            レイヴン・ブラックウッドの占術
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#5e625c]">
            レイヴンは占いを、未来を一方的に決めつけるものとして扱いません。状況の構造、時機、人との関係、変化の兆しを読み、相談者が次の判断を静かに選び直すための技術として扱います。
          </p>
        </header>

        <section className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="raven-card p-5">
            <p className="text-sm font-semibold text-[#6c5f3d]">Reading Policy</p>
            <h2 className="mt-2 text-2xl font-semibold">
              占術は、相談内容に合わせて組み合わせる
            </h2>
            <p className="mt-3 leading-7 text-[#5e625c]">
              相性、人間関係、仕事、転機、迷っている行動。問いの性質によって、見るべきものは変わります。レイヴンはひとつの占術だけに相談を押し込めず、必要に応じて複数の視点を重ねます。
            </p>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-[#596d51]">
              <Link className="underline underline-offset-4" href="/guild/">
                レイヴンの紹介へ戻る
              </Link>
              <Link className="underline underline-offset-4" href="/divination-dictionary/">
                古典占術辞典を読む
              </Link>
            </div>
          </aside>

          <div className="grid gap-4">
            {methods.map((method) => (
              <article key={method.slug} className="raven-card p-5">
                <p className="text-sm font-semibold text-[#6c5f3d]">{method.subtitle}</p>
                <h2 className="mt-2 text-3xl font-semibold">{method.title}</h2>
                <p className="mt-3 leading-8 text-[#5e625c]">{method.description}</p>
                <Link
                  className="mt-4 inline-block text-sm font-semibold text-[#596d51] underline underline-offset-4"
                  href={method.href}
                >
                  詳しい解説を読む
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="raven-card mt-8 p-5">
          <p className="text-sm font-semibold text-[#6c5f3d]">Foundations</p>
          <h2 className="mt-2 text-2xl font-semibold">占術を支える基礎理論</h2>
          <p className="mt-3 max-w-3xl leading-7 text-[#5e625c]">
            奇門遁甲、六壬神課、太乙神数、易経は別々の占術ですが、陰陽、五行、暦、方位といった共通の言葉を持っています。ここを押さえると、占術ごとの違いとつながりが読みやすくなります。
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {foundationLinks.map((item) => (
              <Link key={item.href} className="rounded border border-[#d7cabc] bg-white/70 p-4 transition hover:bg-white" href={item.href}>
                <h3 className="text-lg font-semibold text-[#20241f]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5e625c]">{item.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="raven-card mt-8 p-5">
          <p className="text-sm font-semibold text-[#6c5f3d]">Calendar Reading</p>
          <h2 className="mt-2 text-2xl font-semibold">六曜（ろくよう）</h2>
          <p className="mt-3 max-w-3xl leading-7 text-[#5e625c]">
            六曜は、先勝・友引・先負・仏滅・大安・赤口の六つを日ごとの暦に配し、時間帯や日の過ごし方を考える手がかりにする暦注です。結婚式や契約、移動などの日取りを決める際に参考にされてきましたが、吉凶を固定するものではありません。
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["先勝", "午前を吉、午後を凶と見る日"],
              ["友引", "朝夕を吉、昼を凶と見る日"],
              ["先負", "午前を凶、午後を吉と見る日"],
              ["仏滅", "一日を凶と見る日"],
              ["大安", "一日を吉と見る日"],
              ["赤口", "正午前後を除いて凶と見る日"],
            ].map(([name, description]) => (
              <article key={name} className="rounded border border-[#d7cabc] bg-white/70 p-4">
                <h3 className="text-lg font-semibold text-[#20241f]">{name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5e625c]">{description}</p>
              </article>
            ))}
          </div>
          <p className="mt-4 text-sm leading-7 text-[#5e625c]">
            レイヴンは六曜を、行動を縛る規則ではなく、予定や気持ちを整えるための補助線として扱います。大切な日取りでは、六曜だけで決めず、目的、相手の都合、季節、体調なども合わせて判断します。
          </p>
          <div className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4">
            <h3 className="text-lg font-semibold text-[#20241f]">西洋の曜日との関係</h3>
            <p className="mt-2 text-sm leading-7 text-[#5e625c]">
              西洋の曜日は、太陽・月・惑星に由来する七日周期で、月曜日は月、火曜日は火星、土曜日は土星といった象徴を持ちます。一方、六曜は先勝・友引・先負・仏滅・大安・赤口を日付に割り当てる日本の暦注です。基本的には別の体系であり、月曜日だから大安、火曜日だから仏滅という固定関係はありません。六曜は旧暦の日付との組み合わせで決まり、曜日とは独立して動きます。
            </p>
            <p className="mt-2 text-sm leading-7 text-[#5e625c]">
              ただし、占い・暦の読み方として曜日の象徴と六曜を重ね、行動日の雰囲気を読むことはできます。これは伝統的な固定ルールではなく、レイヴン独自の補助的な読み方として扱います。
            </p>
          </div>
          <div className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4">
            <h3 className="text-lg font-semibold text-[#20241f]">旧暦・現在の日付・西暦・和暦</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <h4 className="font-semibold text-[#20241f]">旧暦と現在の日付</h4>
                <p className="mt-2 text-sm leading-7 text-[#5e625c]">
                  現在、日本の日常生活で使う日付は、太陽の動きを基準にしたグレゴリオ暦です。一方、旧暦は月の満ち欠けを基準にしながら、季節とのずれを調整する太陰太陽暦でした。そのため、旧暦の一月一日や十五日は、毎年、現在のカレンダー上で日付が変わります。旧暦の日付を現在の日付にそのまま置き換えることはできません。
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-[#20241f]">西暦と和暦</h4>
                <p className="mt-2 text-sm leading-7 text-[#5e625c]">
                  西暦は、世界で広く使われる西暦年による表記です。和暦は、明治・大正・昭和・平成・令和などの元号を使って同じ日付を表す日本の年の数え方です。たとえば令和八年は西暦二〇二六年にあたり、和暦と西暦は別の日を指すのではなく、同じ日付を異なる方法で表します。
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#5e625c]">
              暦を読むときは、どの暦の日付を使っているかを最初に確認することが大切です。レイヴンは、現在の日付を基準にしつつ、旧暦や干支、六曜などを参照する場合は、その違いを明示して読み解きます。
            </p>
          </div>
          <div className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4">
            <h3 className="text-lg font-semibold text-[#20241f]">十干十二支（干支）</h3>
            <p className="mt-3 text-sm leading-7 text-[#5e625c]">
              十干十二支は、時間や方位を表すために使われてきた中国系の暦の基本単位です。十干は甲・乙・丙・丁・戊・己・庚・辛・壬・癸の十種類、十二支は子・丑・寅・卯・辰・巳・午・未・申・酉・戌・亥の十二種類から成ります。
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <article className="rounded border border-[#d7cabc] bg-white/70 p-4">
                <h4 className="font-semibold text-[#20241f]">十干</h4>
                <p className="mt-2 text-sm leading-6 text-[#5e625c]">五行を陰陽に分けた十の符号として、気の性質や方向を表します。</p>
              </article>
              <article className="rounded border border-[#d7cabc] bg-white/70 p-4">
                <h4 className="font-semibold text-[#20241f]">十二支</h4>
                <p className="mt-2 text-sm leading-6 text-[#5e625c]">年・月・日・時刻や方位に配され、季節や時間帯の流れを表します。</p>
              </article>
              <article className="rounded border border-[#d7cabc] bg-white/70 p-4">
                <h4 className="font-semibold text-[#20241f]">六十干支</h4>
                <p className="mt-2 text-sm leading-6 text-[#5e625c]">十干と十二支を順に組み合わせた六十の周期です。甲子、乙丑、丙寅のように進みます。</p>
              </article>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#5e625c]">
              干支は単なる動物占いではなく、年だけでなく月・日・時刻にも割り当てられます。八字、奇門遁甲、六壬神課、太乙神数などでは、この干支を五行、節気、方位、他の干支との関係と組み合わせて読みます。
            </p>
          </div>
          <div className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4">
            <h3 className="text-lg font-semibold text-[#20241f]">五行の考え方</h3>
            <p className="mt-3 text-sm leading-7 text-[#5e625c]">
              五行は、木・火・土・金・水という五つの性質の循環で、世界の変化や関係性を捉える考え方です。単なる物質の分類ではなく、成長、拡張、温める力、受け止める力、収束、冷却、流動といった働きの偏りとして読みます。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["木", "成長・発展・方向性。春、東、仁の性質"],
                ["火", "熱・明るさ・表現。夏、南、礼の性質"],
                ["土", "安定・受容・調整。季節の変わり目、中央、信の性質"],
                ["金", "収束・規律・切り分け。秋、西、義の性質"],
                ["水", "流動・蓄積・深さ。冬、北、智の性質"],
              ].map(([name, description]) => (
                <article key={name} className="rounded border border-[#d7cabc] bg-white/70 p-4">
                  <h4 className="font-semibold text-[#20241f]">{name}</h4>
                  <p className="mt-2 text-sm leading-6 text-[#5e625c]">{description}</p>
                </article>
              ))}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded border border-[#d7cabc] bg-white/70 p-4">
                <h4 className="font-semibold text-[#20241f]">相生（そうじょう）</h4>
                <p className="mt-2 text-sm leading-7 text-[#5e625c]">
                  木は火を生じ、火は土を生じ、土は金を生じ、金は水を生じ、水は木を生じるという、支え合いと循環の関係です。ある要素が次の要素を育てる流れとして読みます。
                </p>
              </div>
              <div className="rounded border border-[#d7cabc] bg-white/70 p-4">
                <h4 className="font-semibold text-[#20241f]">相剋（そうこく）</h4>
                <p className="mt-2 text-sm leading-7 text-[#5e625c]">
                  木は土を制し、土は水をせき止め、水は火を消し、火は金を溶かし、金は木を切るという、抑制と緊張の関係です。対立だけでなく、行き過ぎを整える働きとしても読みます。
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#5e625c]">
              五行は多ければよい、少なければ悪いというものではありません。八字では生まれた季節、日主の強弱、相生・相剋、干支の組み合わせを見て、どの働きが過剰・不足・停滞しているかを判断します。十干も五行を陰陽に分けたもので、たとえば甲・乙は木、丙・丁は火、戊・己は土、庚・辛は金、壬・癸は水に対応します。
            </p>
          </div>
          <div className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4">
            <h3 className="text-lg font-semibold text-[#20241f]">マヤ暦と中国の暦</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <h4 className="font-semibold text-[#20241f]">マヤの暦</h4>
                <p className="mt-2 text-sm leading-7 text-[#5e625c]">
                  マヤの暦は一つのカレンダーだけではなく、目的の異なる複数の周期から成り立っていました。代表的なものに、二百六十日の祭儀暦ツォルキン、三百六十五日の太陽暦ハアブ、長い期間を記録する長期暦があります。現代に流通する「マヤ暦占い」はこれらを独自に解釈したものも多いため、歴史的な暦の仕組みと現代の占い解釈は分けて扱います。
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-[#20241f]">中国の伝統暦</h4>
                <p className="mt-2 text-sm leading-7 text-[#5e625c]">
                  中国の伝統暦は、月の満ち欠けと太陽の季節変化を組み合わせた太陰太陽暦です。旧暦の月、二十四節気、十干十二支や六十干支などが、時日や季節を読むための言葉として使われてきました。現在の行政や日常では西暦が中心ですが、伝統行事や暦の読み方では今も参照されます。
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#5e625c]">
              レイヴンは、マヤの暦、中国の伝統暦、旧暦、六曜を同じものとして混ぜず、それぞれの成立背景と周期を確認したうえで、必要な場合だけ現在の日付との対応を示します。暦は未来を固定する答えではなく、時間の流れを複数の角度から見直すための補助線です。
            </p>
          </div>
          <div className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4">
            <h3 className="text-lg font-semibold text-[#20241f]">易と東洋占術における中国系の暦</h3>
            <p className="mt-3 text-sm leading-7 text-[#5e625c]">
              易や東洋占術は中国で発展したため、中国系の暦法を基盤にするものが多くあります。ただし、すべての占術が同じ暦を使うわけではありません。易経の卦辞や爻辞を思想として読む場合、中国暦は必須ではありません。一方、時間や方位を計算する占術では、年月日時を干支や節気に変換して用います。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["梅花易数", "年月日時や数を卦に変換して、問いの動きを読む"],
                ["奇門遁甲", "節気、干支、時刻、方位を盤に配置して見る"],
                ["六壬神課・太乙神数", "干支や時刻などを使い、出来事の流れや大局を読む"],
                ["四柱推命・八字", "生年月日時を干支にし、立春や二十四節気を重視する流派がある"],
              ].map(([name, description]) => (
                <article key={name} className="rounded border border-[#d7cabc] bg-white/70 p-4">
                  <h4 className="font-semibold text-[#20241f]">{name}</h4>
                  <p className="mt-2 text-sm leading-6 text-[#5e625c]">{description}</p>
                </article>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-[#5e625c]">
              日本で使われる場合は、流派によって旧暦、二十四節気、立春、標準時、真太陽時などの扱いが異なります。レイヴンは、採用した暦の基準と換算方法を明示し、暦の違いを曖昧にしたまま断定しない方針です。
            </p>
          </div>
          <div className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4">
            <h3 className="text-lg font-semibold text-[#20241f]">八字（四柱推命）の読み方</h3>
            <p className="mt-3 text-sm leading-7 text-[#5e625c]">
              八字は、生まれた年・月・日・時刻をそれぞれ一つの柱として、十干と十二支に変換して読む方法です。四つの柱に干と支が一つずつあるため、合計八文字になります。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["年柱", "家系、幼少期、社会的な背景"],
                ["月柱", "季節、環境、仕事の基盤。八字では特に重視される"],
                ["日柱", "本人の中心。日干を日主として性質や判断軸を見る"],
                ["時柱", "晩年、将来、才能、子ども、内面の動き"],
              ].map(([name, description]) => (
                <article key={name} className="rounded border border-[#d7cabc] bg-white/70 p-4">
                  <h4 className="font-semibold text-[#20241f]">{name}</h4>
                  <p className="mt-2 text-sm leading-6 text-[#5e625c]">{description}</p>
                </article>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-[#5e625c]">
              命式を作った後は、木・火・土・金・水の五行の偏り、日主の強弱、十神による人間関係や役割、財星・官星・印星・食傷などの働きを確認します。さらに大運や流年を重ね、時期によってどの要素が強まるか、補うとよい五行や用神・喜神を総合的に読みます。
            </p>
            <p className="mt-3 text-sm leading-7 text-[#5e625c]">
              「木が多いからこの性格」と単純に決めつけるのではなく、季節、配置、合・冲・刑・害、大運などを組み合わせることが大切です。月柱は旧暦の月ではなく二十四節気を基準に決める流派が多く、出生時刻も、出生地の時差、標準時か真太陽時か、立春の扱いなどで命式が変わる場合があります。
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
