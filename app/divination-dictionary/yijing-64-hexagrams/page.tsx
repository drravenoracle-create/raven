import Link from "next/link";
import { yijingHexagrams } from "./data";

export const metadata = {
  title: "易経・六十四卦一覧 | レイヴン・ブラックウッド",
  description: "易経の六十四卦を、卦の意味、恋愛、仕事、変爻、変卦の読み方から個別に解説します。",
};

const chapters = [
  ["01-08", "天地が開き、混沌から関係が生まれる", "乾為天と坤為地で世界の二つの力が立ち上がり、始まりの混乱、待つこと、争い、集団、親和が順に現れます。"],
  ["09-16", "力を蓄え、礼を学び、通じる時と閉じる時を知る", "小畜と履で力の使い方を整え、泰と否で時代が開く時と閉じる時を見ます。同人と大有では、人と成果が集まる時の扱いが問われます。"],
  ["17-24", "従い、古い問題を直し、崩れたものが復る", "流れに従うこと、古い歪みを修復すること、観察と処理、外見の整え、崩れを受け入れた後の回復が描かれます。"],
  ["25-32", "自然な正しさから、危険と感応を越えて恒へ向かう", "無妄から大畜、頤、大過、坎、離、咸、恒へと進み、心が動くだけではなく、それを続けられる形へ変えます。"],
  ["33-40", "退くこと、進むこと、傷ついた光を守ること", "退く勇気と進む勢いの調整が主題です。明夷で光を守り、家人と睽で内側の秩序と不一致を見て、蹇と解で困難を越えます。"],
  ["41-48", "減らし、増やし、決断し、集まり、井戸へ戻る", "損と益の呼吸、決断と出会い、集合と上昇が現れます。困窮を経たあと、尽きない生活の源としての井戸へ戻ります。"],
  ["49-56", "変革し、器を整え、衝撃を越えて旅へ出る", "革と鼎で古い形を脱ぎ、新しい器を作ります。震と艮で動くことと止まることを学び、漸と帰妹、豊と旅で関係の不安定さへ向かいます。"],
  ["57-64", "浸透し、喜び、散り、節し、未完成へ帰る", "巽と兌で柔らかく入る力と喜びを見ます。渙で散り、節で区切り、中孚で誠を確かめ、小過で控えめに越え、既済から未済へ戻ります。"],
];

export default function YijingHexagramIndexPage() {
  return (
    <main className="raven-page raven-dictionary min-h-screen text-[#20241f]">
      <section className="raven-content-shell mx-auto max-w-6xl px-5 py-8 sm:py-12">
        <header className="raven-dictionary-hero">
          <nav className="relative z-10 mb-6 flex flex-wrap gap-3 text-sm font-semibold text-[#e7d7b6]">
            <Link href="/">レイヴン・ブラックウッド</Link>
            <Link href="/divination-dictionary/">古典占術辞典</Link>
            <Link href="/divination-methods/yijing/">易経とは</Link>
          </nav>
          <div className="relative z-10 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d8b15f]">Yijing Hexagrams</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#fff8e7] sm:text-6xl">易経・六十四卦一覧</h1>
            <p className="mt-5 text-base leading-8 text-[#e9dfcc] sm:text-lg">
              六十四卦をそれぞれ個別に読み、卦意、恋愛、仕事、変爻、変卦の見方まで整理します。
            </p>
          </div>
        </header>

        <section className="raven-dictionary-section mt-8 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8d6a2f]">The Story of 64 Hexagrams</p>
          <h2 className="mt-2 text-3xl font-semibold text-[#20241f]">六十四卦の物語</h2>
          <p className="mt-3 leading-8 text-[#5e625c]">
            易経の六十四卦は、ばらばらの占断ではなく、天地が開き、混沌が生まれ、人が関係を結び、衰えと回復を経験し、完成の先でまた未完成へ戻る物語として読むことができます。
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {chapters.map(([range, title, body]) => (
              <article key={range} className="rounded border border-[#d7cabc] bg-white/70 p-4">
                <p className="text-sm font-semibold text-[#8d6a2f]">{range}</p>
                <h3 className="mt-1 text-xl font-semibold text-[#20241f]">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#5e625c]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {yijingHexagrams.map((hexagram) => (
            <Link key={hexagram.slug} className="raven-dictionary-card block p-5" href={`/divination-dictionary/yijing-64-hexagrams/${hexagram.slug}/`}>
              <p className="text-sm font-semibold text-[#8d6a2f]">{String(hexagram.number).padStart(2, "0")} / {hexagram.reading}</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#20241f]">{hexagram.name}</h2>
              <p className="mt-3 text-sm leading-6 text-[#5e625c]">{hexagram.summary}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-[#3f5439] underline underline-offset-4">詳しく読む</span>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
