import Link from "next/link";
import { notFound } from "next/navigation";
import { dictionaryArticles, getDictionaryArticle } from "../data";

export function generateStaticParams() {
  return dictionaryArticles.map((article) => ({ slug: article.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const article = getDictionaryArticle(params.slug);
  if (!article) return {};
  return {
    title: `${article.title} | 古典占術辞典`,
    description: article.description,
  };
}

export default function DictionaryArticlePage({ params }: { params: { slug: string } }) {
  const article = getDictionaryArticle(params.slug);
  if (!article) notFound();
  const related = dictionaryArticles.filter((item) => item.slug !== article.slug);

  return (
    <main className="raven-page raven-dictionary min-h-screen text-[#20241f]">
      <section className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        <header className="raven-dictionary-hero">
          <nav className="relative z-10 mb-6 flex flex-wrap gap-3 text-sm font-semibold text-[#e7d7b6]">
            <Link href="/">レイヴン・ブラックウッド</Link>
            <Link href="/divination-dictionary/">古典占術辞典</Link>
            <Link href="/divination-methods/">レイヴンの占術</Link>
          </nav>
          <div className="relative z-10 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d8b15f]">{article.category}</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#fff8e7] sm:text-6xl">{article.title}</h1>
            <p className="mt-5 text-base leading-8 text-[#e9dfcc] sm:text-lg">{article.description}</p>
          </div>
        </header>

        <article className="mt-8 grid gap-5">
          {article.sections.map((section) => (
            <section key={section.heading} className="raven-dictionary-section p-6">
              <h2 className="text-2xl font-semibold text-[#20241f]">{section.heading}</h2>
              <div className="mt-3 grid gap-3 leading-8 text-[#5e625c]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        {article.slug === "yijing-64-hexagrams" ? (
          <section className="mt-8 raven-dictionary-section p-6">
            <h2 className="text-2xl font-semibold text-[#20241f]">六十四卦を個別に読む</h2>
            <p className="mt-3 leading-8 text-[#5e625c]">
              乾為天から火水未済まで、各卦の意味、恋愛、仕事、変爻、変卦の読み方を個別ページに整理しています。
            </p>
            <Link className="mt-5 inline-flex text-sm font-semibold text-[#3f5439] underline underline-offset-4" href="/divination-dictionary/yijing-64-hexagrams/">
              六十四卦一覧を開く
            </Link>
          </section>
        ) : null}

        <section className="mt-8 border-t border-[#d7cabc] pt-6">
          <h2 className="text-2xl font-semibold">関連する辞典記事</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {related.map((item) => (
              <Link key={item.slug} className="raven-dictionary-card block p-4" href={`/divination-dictionary/${item.slug}`}>
                <p className="text-sm font-semibold text-[#8d6a2f]">{item.category}</p>
                <h3 className="mt-1 text-xl font-semibold">{item.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
