import { env } from "cloudflare:workers";
import { getSortedBlogPosts } from "./lib/blog";

type HomePost = {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  category: string;
};

type DbPost = {
  slug: string;
  title: string;
  description: string;
  published_at?: string;
  created_at?: string;
  category: string;
};

export const dynamic = "force-dynamic";

const navLinks = [
  { href: "/guild/", label: "ギルド" },
  { href: "/divination-methods/", label: "占術" },
  { href: "/divination-dictionary/", label: "占術辞典" },
  { href: "/free-fortune/", label: "AI無料占い" },
  { href: "/text-reading/", label: "AIテキスト占い" },
  { href: "/member/", label: "マイページ" },
  { href: "/faq/", label: "FAQ" },
  { href: "/blog/", label: "ブログ" },
];

const methodLinks = [
  { href: "/divination-methods/qimen-dunjia/", label: "奇門遁甲", body: "時と方位を読み、動くべき入口を探る。" },
  { href: "/divination-methods/liu-ren/", label: "六壬神課", body: "問いの発端、相手の意図、流れの変化を見る。" },
  { href: "/divination-methods/taiyi/", label: "太乙神数", body: "長期の運勢、環境、時代の大きな流れを読む。" },
  { href: "/divination-methods/yijing/", label: "易経", body: "変化の中で取るべき姿勢を整える。" },
];

const serviceLinks = [
  {
    href: "/free-fortune/",
    label: "AI無料占い",
    title: "今の流れを軽く確かめる",
    body: "今日、恋愛・相性、仕事・金運、易断から選び、短い占い結果で今の兆しを確認できます。",
  },
  {
    href: "/text-reading/",
    label: "AIテキスト占い",
    title: "文章の温度と次の一手を見る",
    body: "相手から来た文章、送る前の文章、相談文を貼り、意図・注意点・整え方を確認できます。現在は無料トライアルとして利用できます。",
  },
];

const routeLinks = [
  {
    href: "/free-fortune/",
    title: "まず軽く確かめたい",
    label: "AI無料占い",
    body: "名前と気になることを入れて、今日・恋愛・仕事・金運・易断の短い兆しを確認します。",
  },
  {
    href: "/text-reading/",
    title: "文章や相談を具体的に見たい",
    label: "AIテキスト占い",
    body: "相手の文章、送る前の返事、相談文を貼り、占術別に読み分けます。",
  },
  {
    href: "/divination-methods/",
    title: "占術の考え方から知りたい",
    label: "レイヴンの占術",
    body: "奇門遁甲、六壬神課、太乙神数、易経を、現実の判断に戻す視点で解説します。",
  },
];

async function loadLatestPosts(): Promise<HomePost[]> {
  try {
    const result = await env.DB.prepare(
      "SELECT slug, title, description, published_at, created_at, category FROM blog_engine_articles WHERE tenant_id = 'raven-oracle' AND status = 'published' ORDER BY datetime(COALESCE(published_at, created_at)) DESC LIMIT 3",
    ).all<DbPost>();
    const posts = (result.results || []).map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
      pubDate: (post.published_at || post.created_at || "").slice(0, 10),
      category: post.category,
    }));
    if (posts.length) return posts;
  } catch {}

  return getSortedBlogPosts()
    .filter((post) => post.slug !== "timed-chat-review-flow")
    .slice(0, 3)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
      pubDate: post.pubDate,
      category: post.category,
    }));
}

export default async function Home() {
  const latestPosts = await loadLatestPosts();

  return (
    <main className="raven-page min-h-screen text-[#20241f]">
      <section className="raven-home-hero">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-5 text-sm font-semibold text-[#e7d7b6]">
          <span className="mr-2 uppercase tracking-[0.14em] text-[#d8b15f]">レイヴン・ブラックウッド</span>
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
        </nav>

        <div className="mx-auto grid max-w-7xl gap-8 px-5 pb-10 pt-4 lg:grid-cols-[1fr_420px] lg:items-end">
          <div className="max-w-3xl pb-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d8b15f]">レイヴン・ブラックウッド 鑑定室</p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight text-[#fff8e7] sm:text-7xl">
              古典占術で、<br />
              迷いを次の一手へ。
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#e9dfcc] sm:text-lg">
              レイヴン・ブラックウッドは、奇門遁甲、六壬神課、太乙神数、易経を判断の地図として扱う案内役です。
              <br className="sm:hidden" />
              未来を断定せず、問いを整え、現実に戻し、
              <br className="sm:hidden" />
              今選べる行動を見つけます。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a className="raven-hero-button" href="/text-reading/">AIテキスト占いへ</a>
              <a className="raven-hero-button raven-hero-button-secondary" href="/divination-methods/">占術を読む</a>
            </div>
            <div className="raven-hero-trust mt-7 grid gap-3 sm:grid-cols-3">
              <div><strong>4系統</strong><span>問いに合わせて占術を選択</span></div>
              <div><strong>64卦</strong><span>易経ページを個別解説</span></div>
              <div><strong>5入口</strong><span>軽い確認から具体相談まで</span></div>
            </div>
          </div>

          <aside className="raven-profile-panel">
            <img className="raven-profile-image" src="/raven-blackwood-cover.png" alt="レイヴン・ブラックウッド" />
            <div className="p-5">
              <p className="text-sm font-semibold text-[#8d6a2f]">Founder / Oracle Strategist</p>
              <h2 className="mt-1 text-2xl font-semibold">レイヴン・ブラックウッド</h2>
              <p className="mt-3 leading-7 text-[#5e625c]">
                神秘を飾りにせず、相談者が恐れではなく判断軸から次の行動を選べるよう導く、静かな鑑定室の主です。
              </p>
              <a className="mt-4 inline-flex text-sm font-semibold text-[#596d51] underline underline-offset-4" href="/guild/">人物紹介を読む</a>
            </div>
          </aside>
        </div>
      </section>

      <section className="raven-home-band">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-7 md:grid-cols-3">
          <a className="raven-path-card" href="/text-reading/">
            <p>相談文・返信文を見る</p>
            <h2>AIテキスト占い</h2>
            <span>文章の温度、相手に与える印象、次の一手を整理します。</span>
          </a>
          <a className="raven-path-card" href="/free-fortune/">
            <p>軽く兆しを確かめる</p>
            <h2>AI無料占い</h2>
            <span>今日・恋愛・仕事金運・易断から、短い結果を確認できます。</span>
          </a>
          <a className="raven-path-card" href="/divination-dictionary/yijing-64-hexagrams/">
            <p>古典占術を読む</p>
            <h2>易経 六十四卦</h2>
            <span>各卦の意味、変爻、変卦、物語上の位置を個別に読めます。</span>
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-4">
          <p className="text-sm font-semibold text-[#8d6a2f]">どこから入るか</p>
          <h2 className="mt-1 text-3xl font-semibold">迷いの深さで入口を選ぶ</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {routeLinks.map((route) => (
            <a key={route.href} className="raven-route-card p-5" href={route.href}>
              <p className="text-sm font-semibold text-[#8d6a2f]">{route.title}</p>
              <h3 className="mt-2 text-2xl font-semibold">{route.label}</h3>
              <p className="mt-3 leading-7 text-[#5e625c]">{route.body}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-[#596d51] underline underline-offset-4">この入口へ進む</span>
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="raven-home-card p-6">
          <p className="text-sm font-semibold text-[#8d6a2f]">自己紹介</p>
          <h2 className="mt-2 text-3xl font-semibold">レイヴンについて</h2>
          <p className="mt-4 leading-8 text-[#5e625c]">
            レイヴンの鑑定は、恐れを煽るためのものではありません。感情、状況、相手との距離、動く時期を分けて見ながら、相談者が自分の判断を取り戻すための道具として占術を扱います。
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]">
            <a className="underline underline-offset-4" href="/guild/">ギルドメンバー紹介を見る</a>
            <a className="underline underline-offset-4" href="/divination-dictionary/">古典占術辞典を読む</a>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {methodLinks.map((method) => (
            <a key={method.href} className="raven-home-method p-5" href={method.href}>
              <h3 className="text-xl font-semibold">{method.label}</h3>
              <p className="mt-2 leading-7 text-[#5e625c]">{method.body}</p>
            </a>
          ))}
        </section>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 pb-10 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {serviceLinks.map((service) => (
            <a key={service.href} className="raven-home-card block p-5" href={service.href}>
              <p className="text-sm font-semibold text-[#8d6a2f]">{service.label}</p>
              <h2 className="mt-2 text-2xl font-semibold">{service.title}</h2>
              <p className="mt-3 leading-7 text-[#5e625c]">{service.body}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-[#596d51] underline underline-offset-4">専用ページへ</span>
            </a>
          ))}
        </section>

        <section className="raven-home-card p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#8d6a2f]">ブログ</p>
              <h2 className="mt-1 text-2xl font-semibold">最新記事</h2>
            </div>
            <a className="text-sm font-semibold text-[#596d51] underline underline-offset-4" href="/blog/">一覧を見る</a>
          </div>
          <div className="grid gap-3">
            {latestPosts.map((post) => (
              <article key={post.slug} className="border-t border-[#d7cabc] pt-4 first:border-t-0 first:pt-0">
                <p className="text-xs font-semibold text-[#8d6a2f]">{post.category} / {post.pubDate}</p>
                <h3 className="mt-2 text-xl font-semibold"><a href={`/blog/${post.slug}/`}>{post.title}</a></h3>
                <p className="mt-2 leading-7 text-[#5e625c]">{post.description}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <footer className="border-t border-[#d8cdbd] px-5 py-6">
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-4 text-sm font-semibold text-[#596d51]">
          <a href="/guild/">ギルドメンバー紹介</a>
          <a href="/divination-methods/">レイヴンの占術</a>
          <a href="/divination-dictionary/">古典占術辞典</a>
          <a href="/member/">マイページ</a>
          <a href="/faq/">FAQ</a>
          <a href="/tokushoho/">特定商取引法に基づく表記</a>
          <a href="/privacy/">個人情報保護方針</a>
          <a href="/disclaimer/">免責事項</a>
        </nav>
      </footer>
    </main>
  );
}
