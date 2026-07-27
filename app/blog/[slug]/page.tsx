import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPost, getSortedBlogPosts } from "../../lib/blog";

type BlogParams = Promise<{ slug: string }>;

export function generateStaticParams() {
  return getSortedBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: BlogParams }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return { title: `${post.title} | Raven Oracle`, description: post.description };
}

export default async function BlogPostPage({ params }: { params: BlogParams }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <article className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/blog/">ブログ一覧</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold text-[#6c5f3d]">{post.pubDate} / {post.category}</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight">{post.title}</h1>
          <p className="mt-3 leading-7 text-[#5e625c]">{post.description}</p>
        </header>
        <div className="raven-article mt-8">
          {post.body.split("\n\n").map((block) => block.startsWith("## ") ? <h2 key={block}>{block.replace("## ", "")}</h2> : <p key={block}>{block}</p>)}
        </div>
      </article>
    </main>
  );
}