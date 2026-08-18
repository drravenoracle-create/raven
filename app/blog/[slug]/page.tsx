import { env } from "cloudflare:workers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPost, getSortedBlogPosts } from "../../lib/blog";

type BlogParams = Promise<{ slug: string }>;
type DbPost = {
  slug: string;
  title: string;
  description: string;
  body: string;
  published_at?: string;
  created_at?: string;
  category: string;
  view_count?: number;
};

async function loadPost(slug: string) {
  try {
    const post = await env.DB.prepare(
      "SELECT a.slug, a.title, a.description, a.body, a.published_at, a.created_at, a.category, COUNT(e.id) AS view_count FROM blog_engine_articles a LEFT JOIN analytics_events e ON e.tenant_id = a.tenant_id AND e.event_name = 'page_view' AND (e.page_path = '/blog/' || a.slug OR e.page_path = '/blog/' || a.slug || '/' ) WHERE a.tenant_id = 'raven-oracle' AND a.slug = ? AND a.status = 'published' GROUP BY a.id LIMIT 1",
    )
      .bind(slug)
      .first<DbPost>();
    if (post) {
      return {
        slug: post.slug,
        title: post.title,
        description: post.description,
        body: post.body,
        pubDate: (post.published_at || post.created_at || "").slice(0, 10),
        category: post.category,
        viewCount: Number(post.view_count || 0),
      };
    }
  } catch {
    // Fall through to static fallback.
  }
  const fallback = getBlogPost(slug);
  return fallback ? { ...fallback, viewCount: 0 } : fallback;
}

export function generateStaticParams() {
  return getSortedBlogPosts().map((post) => ({ slug: post.slug }));
}

function renderInlineLinks(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!match) return part;
    return <Link key={`${match[2]}-${index}`} className="font-semibold text-[#596d51] underline underline-offset-4" href={match[2]}>{match[1]}</Link>;
  });
}

export async function generateMetadata({ params }: { params: BlogParams }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return {};
  return { title: `${post.title} | レイヴン・ブラックウッド`, description: post.description };
}

export default async function BlogPostPage({ params }: { params: BlogParams }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <article className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/blog/">ブログ一覧</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold text-[#6c5f3d]">{post.pubDate} / {post.category} / 閲覧 {post.viewCount}</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight">{post.title}</h1>
          <p className="mt-3 leading-7 text-[#5e625c]">{post.description}</p>
        </header>
        <div className="raven-article mt-8">
          {post.body.split("\n\n").map((block) => block.startsWith("## ") ? <h2 key={block}>{block.replace("## ", "")}</h2> : <p key={block}>{renderInlineLinks(block)}</p>)}
        </div>
      </article>
    </main>
  );
}


