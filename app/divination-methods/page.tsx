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
      </section>
    </main>
  );
}
