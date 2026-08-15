import { env } from "cloudflare:workers";
import Link from "next/link";
import { getSortedBlogPosts } from "../lib/blog";

type DbPost = {
  slug: string;
  title: string;
  description: string;
  published_at?: string;
  created_at?: string;
  category: string;
  tags_json: string;
  view_count?: number;
};

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ブログ | レイヴン・ブラックウッド",
  description: "レイヴン・ブラックウッドの公開済みブログ記事一覧です。",
};

async function loadPublishedPosts() {
  const staticPosts = getSortedBlogPosts().map((post) => ({ ...post, viewCount: 0 }));
  try {
    const result = await env.DB.prepare(
      "SELECT a.slug, a.title, a.description, a.published_at, a.created_at, a.category, a.tags_json, COUNT(e.id) AS view_count FROM blog_engine_articles a LEFT JOIN analytics_events e ON e.tenant_id = a.tenant_id AND e.event_name = 'page_view' AND (e.page_path = '/blog/' || a.slug OR e.page_path = '/blog/' || a.slug || '/' ) WHERE a.tenant_id = 'raven-oracle' AND a.status = 'published' GROUP BY a.id ORDER BY datetime(COALESCE(a.published_at, a.created_at)) DESC LIMIT 100",
    ).all<DbPost>();
    const posts = (result.results || []).map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
      pubDate: (post.published_at || post.created_at || "").slice(0, 10),
      category: post.category,
      tags: JSON.parse(post.tags_json || "[]") as string[],
      viewCount: Number(post.view_count || 0),
    }));
    const slugs = new Set(posts.map((post) => post.slug));
    return [...posts, ...staticPosts.filter((post) => !slugs.has(post.slug))]
      .sort((a, b) => b.pubDate.localeCompare(a.pubDate));
  } catch {
    return staticPosts;
  }
}

export default async function BlogIndex() {
  const posts = await loadPublishedPosts();

  return (
    <main className="raven-page min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-5xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/">レイヴン・ブラックウッド</Link>
        <header className="raven-card mt-5 p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Blog</p>
          <h1 className="mt-2 text-4xl font-semibold">レイヴン・ブラックウッド ブログ</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#5e625c]">
            古典占術、鑑定の考え方、運用メモを公開しています。記事ごとの閲覧数もここで確認できます。
          </p>
        </header>
        <section className="mt-8 grid gap-4">
          {posts.map((post) => (
            <article key={post.slug} className="raven-card p-5">
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#6c5f3d]"><span>{post.pubDate}</span><span>{post.category}</span><span>{post.viewCount} views</span></div>
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




