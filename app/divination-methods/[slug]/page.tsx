import Link from "next/link";
import { notFound } from "next/navigation";
import { getMethodBySlug, methodDetails } from "../data";

export function generateStaticParams() {
  return methodDetails.map((method) => ({ slug: method.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const method = getMethodBySlug(params.slug);
  if (!method) return {};
  return {
    title: `${method.title} | レイヴン・ブラックウッドの占術`,
    description: method.description,
  };
}

export default function MethodDetailPage({ params }: { params: { slug: string } }) {
  const method = getMethodBySlug(params.slug);
  if (!method) notFound();
  const related = methodDetails.filter((item) => item.slug !== method.slug);

  return (
    <main className="raven-page min-h-screen bg-[#f5f0e8] text-[#20241f]">
      <section className="mx-auto max-w-5xl px-5 py-8">
        <header className="border-b border-[#d7cabc] pb-7">
          <nav className="mb-5 flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]">
            <Link href="/">レイヴン・ブラックウッド</Link>
            <Link href="/divination-methods/">占術一覧</Link>
            <Link href="/guild/">ギルド紹介</Link>
            <Link href="/text-reading/">AIテキスト占い</Link>
          </nav>
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">{method.reading}</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">{method.title}</h1>
          <p className="mt-3 text-xl font-semibold text-[#3c463f]">{method.subtitle}</p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#5e625c]">{method.description}</p>
        </header>

        <article className="mt-8 grid gap-4">
          {method.sections.map((section) => (
            <section key={section.heading} className="raven-card p-5">
              <h2 className="text-2xl font-semibold">{section.heading}</h2>
              <p className="mt-3 leading-8 text-[#5e625c]">{section.body}</p>
            </section>
          ))}
        </article>

        <section className="mt-8 raven-card p-5">
          <p className="text-sm font-semibold text-[#6c5f3d]">Consultation Themes</p>
          <h2 className="mt-2 text-2xl font-semibold">{method.name}で見やすい相談</h2>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-[#4b574e] sm:grid-cols-3">
            {method.examples.map((example) => (
              <p key={example} className="rounded bg-white/70 p-3">{example}</p>
            ))}
          </div>
        </section>

        <section className="mt-8 border-t border-[#d7cabc] pt-6">
          <h2 className="text-2xl font-semibold">他の占術も読む</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {related.map((item) => (
              <Link key={item.slug} className="raven-card block p-4" href={`/divination-methods/${item.slug}`}>
                <p className="text-sm font-semibold text-[#6c5f3d]">{item.reading}</p>
                <h3 className="mt-1 text-xl font-semibold">{item.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5e625c]">{item.subtitle}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
