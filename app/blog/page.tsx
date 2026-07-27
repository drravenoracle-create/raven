import Link from "next/link";
import { getSortedBlogPosts } from "../lib/blog";

export const metadata = {
  title: "ブログ | Raven Oracle",
  description: "Raven OracleのAI占い、テキスト鑑定、開運行動に関する記事一覧です。",
};

export default function BlogIndex() {
  const posts = getSortedBlogPosts();

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-5xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/">Raven Oracle</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Blog</p>
          <h1 className="mt-2 text-4xl font-semibold">Raven Oracle Blog</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#5e625c]">AI占い、文章鑑定、今日の流れを整えるための短いガイドを掲載します。</p>
        </header>
        <section className="mt-8 grid gap-4">
          {posts.map((post) => (
            <article key={post.slug} className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#6c5f3d]"><span>{post.pubDate}</span><span>{post.category}</span></div>
              <h2 className="mt-2 text-2xl font-semibold"><Link href={`/blog/${post.slug}/`}>{post.title}</Link></h2>
              <p className="mt-2 leading-7 text-[#5e625c]">{post.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => <span key={tag} className="rounded border border-[#d7cabc] px-2 py-1 text-xs text-[#5e625c]">{tag}</span>)}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}