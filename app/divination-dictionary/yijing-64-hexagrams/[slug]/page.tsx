import Link from "next/link";
import { notFound } from "next/navigation";
import { getYijingHexagram, yijingHexagrams } from "../data";

const storyChapters = [
  {
    min: 1,
    max: 8,
    range: "01-08",
    title: "天地が開き、混沌から関係が生まれる",
    body: "世界がまだ形を決めきらない段階です。大きな力、受け止める力、始まりの混乱、未熟さ、待機、争い、集団、親和が順に現れます。",
  },
  {
    min: 9,
    max: 16,
    range: "09-16",
    title: "力を蓄え、礼を学び、通じる時と閉じる時を知る",
    body: "力をすぐ使わず、形を整える章です。耐える、踏み外さない、通じる、閉じる、人と同じ場に立つ、豊かさを扱う、謙虚に保つ、喜びを動力にする流れがあります。",
  },
  {
    min: 17,
    max: 24,
    range: "17-24",
    title: "従い、古い問題を直し、崩れたものが復る",
    body: "人や時勢に従うだけでなく、古くから残る歪みを修復する章です。近づき、観察し、障害を処理し、外見を整え、崩れを受け入れた先に回復が始まります。",
  },
  {
    min: 25,
    max: 32,
    range: "25-32",
    title: "自然な正しさから、危険と感応を越えて恒へ向かう",
    body: "作為を離れた正しさ、大きな蓄え、養い、過重、危険、明知、感応、持続が並びます。心が動くだけでなく、それを続けられる形へ変える章です。",
  },
  {
    min: 33,
    max: 40,
    range: "33-40",
    title: "退くこと、進むこと、傷ついた光を守ること",
    body: "退く勇気と進む勢いの調整が主題です。内側の秩序を守り、不一致や障害を越えて、張りつめた状況を解いていきます。",
  },
  {
    min: 41,
    max: 48,
    range: "41-48",
    title: "減らし、増やし、決断し、集まり、井戸へ戻る",
    body: "減らすことと増やすこと、決断と出会い、集合と上昇が交互に現れます。行き詰まりを経たあと、尽きない生活の源としての井戸へ戻る章です。",
  },
  {
    min: 49,
    max: 56,
    range: "49-56",
    title: "変革し、器を整え、衝撃を越えて旅へ出る",
    body: "古い形を脱ぎ、新しい器を作る章です。衝撃、停止、順序、不安定な関係、豊かさを経て、人は慣れた場所を離れ旅へ出ます。",
  },
  {
    min: 57,
    max: 64,
    range: "57-64",
    title: "浸透し、喜び、散り、節し、未完成へ帰る",
    body: "柔らかく入る力、喜び、散ること、節度、内なる誠、小さく越えることが描かれます。完成に見える既済のあと、未済で物語は再び始まりへ戻ります。",
  },
];

function getStoryChapter(number: number) {
  return storyChapters.find((chapter) => number >= chapter.min && number <= chapter.max) ?? storyChapters[0];
}

function getStoryPosition(number: number) {
  if (number === 1) {
    return "乾為天は六十四卦の第一卦です。ここでは、まだ出来事になる前の純粋な創造力が立ち上がります。物語は、天が動き始めるこの一息から始まります。";
  }
  if (number === 64) {
    return "火水未済は六十四卦の最後に置かれます。ただし終点ではありません。完成しきらないものを残すことで、易経の物語は次の始まりへ戻ります。";
  }
  const current = yijingHexagrams[number - 1];
  const previous = yijingHexagrams.find((item) => item.number === number - 1);
  const next = yijingHexagrams.find((item) => item.number === number + 1);
  return `${previous?.name ?? "前の卦"}から受け取った流れを、この卦は「${current?.summary ?? "時の兆し"}」という局面へ変えます。ここで得た課題は、次の${next?.name ?? "卦"}へ渡され、六十四卦の物語を一段進めます。`;
}

export function generateStaticParams() {
  return yijingHexagrams.map((hexagram) => ({ slug: hexagram.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const hexagram = getYijingHexagram(params.slug);
  if (!hexagram) return {};
  return {
    title: `${hexagram.name} | 易経・六十四卦`,
    description: `${hexagram.name}の意味、恋愛、仕事、変爻、変卦の読み方をレイヴン・ブラックウッドの古典占術辞典として解説します。`,
  };
}

export default function YijingHexagramPage({ params }: { params: { slug: string } }) {
  const hexagram = getYijingHexagram(params.slug);
  if (!hexagram) notFound();

  const story = getStoryChapter(hexagram.number);
  const previous = yijingHexagrams.find((item) => item.number === hexagram.number - 1);
  const next = yijingHexagrams.find((item) => item.number === hexagram.number + 1);
  const related = yijingHexagrams
    .filter((item) => item.slug !== hexagram.slug && item.number >= story.min && item.number <= story.max)
    .slice(0, 8);

  return (
    <main className="raven-page raven-dictionary min-h-screen text-[#20241f]">
      <section className="raven-content-shell mx-auto max-w-5xl px-5 py-8 sm:py-12">
        <header className="raven-dictionary-hero">
          <nav className="relative z-10 mb-6 flex flex-wrap gap-3 text-sm font-semibold text-[#e7d7b6]">
            <Link href="/">レイヴン・ブラックウッド</Link>
            <Link href="/divination-dictionary/">古典占術辞典</Link>
            <Link href="/divination-dictionary/yijing-64-hexagrams/">六十四卦一覧</Link>
          </nav>
          <div className="relative z-10 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d8b15f]">
              {String(hexagram.number).padStart(2, "0")} / {hexagram.reading}
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#fff8e7] sm:text-6xl">{hexagram.name}</h1>
            <p className="mt-5 text-base leading-8 text-[#e9dfcc] sm:text-lg">{hexagram.summary}</p>
          </div>
        </header>

        <article className="mt-8 grid gap-5">
          <section className="raven-dictionary-section p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8d6a2f]">{story.range}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#20241f]">物語上の位置: {story.title}</h2>
            <p className="mt-3 leading-8 text-[#5e625c]">{story.body}</p>
            <p className="mt-3 leading-8 text-[#5e625c]">{getStoryPosition(hexagram.number)}</p>
          </section>

          <section className="raven-dictionary-section p-6">
            <h2 className="text-2xl font-semibold text-[#20241f]">卦の意味</h2>
            <p className="mt-3 leading-8 text-[#5e625c]">{hexagram.detail}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {hexagram.keywords.map((keyword) => (
                <span key={keyword} className="rounded border border-[#d7cabc] bg-white/70 px-3 py-1 text-sm font-semibold text-[#6c5f3d]">{keyword}</span>
              ))}
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="raven-dictionary-section p-6">
              <h2 className="text-2xl font-semibold text-[#20241f]">恋愛での読み方</h2>
              <p className="mt-3 leading-8 text-[#5e625c]">{hexagram.love}</p>
            </div>
            <div className="raven-dictionary-section p-6">
              <h2 className="text-2xl font-semibold text-[#20241f]">仕事での読み方</h2>
              <p className="mt-3 leading-8 text-[#5e625c]">{hexagram.work}</p>
            </div>
          </section>

          <section className="raven-dictionary-section p-6">
            <h2 className="text-2xl font-semibold text-[#20241f]">変爻の解説</h2>
            <div className="mt-3 grid gap-3 leading-8 text-[#5e625c]">
              {hexagram.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>

          <section className="raven-dictionary-section p-6">
            <h2 className="text-2xl font-semibold text-[#20241f]">変卦の読み方</h2>
            <p className="mt-3 leading-8 text-[#5e625c]">{hexagram.changingHexagram}</p>
          </section>
        </article>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {previous ? (
            <Link className="raven-dictionary-card block p-5" href={`/divination-dictionary/yijing-64-hexagrams/${previous.slug}/`}>
              <p className="text-sm font-semibold text-[#8d6a2f]">前の卦</p>
              <h2 className="mt-1 text-2xl font-semibold">{String(previous.number).padStart(2, "0")} {previous.name}</h2>
            </Link>
          ) : (
            <Link className="raven-dictionary-card block p-5" href="/divination-dictionary/yijing-64-hexagrams/64-wei-ji/">
              <p className="text-sm font-semibold text-[#8d6a2f]">循環する前の卦</p>
              <h2 className="mt-1 text-2xl font-semibold">64 火水未済</h2>
            </Link>
          )}
          {next ? (
            <Link className="raven-dictionary-card block p-5" href={`/divination-dictionary/yijing-64-hexagrams/${next.slug}/`}>
              <p className="text-sm font-semibold text-[#8d6a2f]">次の卦</p>
              <h2 className="mt-1 text-2xl font-semibold">{String(next.number).padStart(2, "0")} {next.name}</h2>
            </Link>
          ) : (
            <Link className="raven-dictionary-card block p-5" href="/divination-dictionary/yijing-64-hexagrams/01-qian/">
              <p className="text-sm font-semibold text-[#8d6a2f]">循環する次の卦</p>
              <h2 className="mt-1 text-2xl font-semibold">01 乾為天</h2>
            </Link>
          )}
        </section>

        <section className="mt-8 border-t border-[#d7cabc] pt-6">
          <h2 className="text-2xl font-semibold">同じ章の卦を読む</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {related.map((item) => (
              <Link key={item.slug} className="raven-dictionary-card block p-4" href={`/divination-dictionary/yijing-64-hexagrams/${item.slug}/`}>
                <p className="text-sm font-semibold text-[#8d6a2f]">{String(item.number).padStart(2, "0")}</p>
                <h3 className="mt-1 text-xl font-semibold">{item.name}</h3>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
