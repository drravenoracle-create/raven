import Link from "next/link";
import { dictionaryArticles } from "./data";

export const metadata = {
  title: "古典占術辞典 | レイヴン・ブラックウッド",
  description:
    "奇門遁甲、六壬神課、太乙神数、易経の用語、構造、歴史、読み方を整理する古典占術辞典です。",
};

export default function DivinationDictionaryPage() {
  return (
    <main className="raven-page raven-dictionary min-h-screen text-[#20241f]">
      <section className="raven-content-shell mx-auto max-w-6xl px-5 py-8 sm:py-12">
        <header className="raven-dictionary-hero">
          <nav className="relative z-10 mb-6 flex flex-wrap gap-3 text-sm font-semibold text-[#e7d7b6]">
            <Link href="/">レイヴン・ブラックウッド</Link>
            <Link href="/divination-methods/">レイヴンの占術</Link>
            <Link href="/blog/">ブログ</Link>
          </nav>
          <div className="relative z-10 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d8b15f]">
              Classical Divination Dictionary
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#fff8e7] sm:text-6xl">
              古典占術辞典
            </h1>
            <p className="mt-5 text-base leading-8 text-[#e9dfcc] sm:text-lg">
              奇門遁甲、六壬神課、太乙神数、易経を、鑑定にも読み物にも使いやすい形で整理する書庫です。
              用語、構造、歴史、読み方を深く掘り下げ、レイヴン・ブラックウッドの鑑定世界とつなげます。
            </p>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {dictionaryArticles.map((article) => (
            <Link key={article.slug} className="raven-dictionary-card block p-6" href={`/divination-dictionary/${article.slug}`}>
              <p className="text-sm font-semibold text-[#8d6a2f]">{article.category}</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#20241f]">{article.title}</h2>
              <p className="mt-3 leading-7 text-[#5e625c]">{article.description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-[#3f5439] underline underline-offset-4">
                詳しく読む
              </span>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
