import Link from "next/link";

const items = [
  { href: "/admin/analytics/", title: "アクセス分析", description: "GA4や手入力の数値から、次の改善アクションを整理します。" },
  { href: "/admin/blog/", title: "運用メモ管理", description: "公開メモ案、下書き、Markdown出力を管理します。" },
  { href: "/admin/sns/", title: "SNSコンテンツ生成", description: "Instagram向けスライド案、キャプション、投稿準備を作成します。" },
];

export const metadata = { title: "管理ダッシュボード | Raven Oracle" };

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-6xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/">Raven Oracle</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Admin</p>
          <h1 className="mt-2 text-4xl font-semibold">管理ダッシュボード</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#5e625c]">Raven Oracleの運用状況、メモ、SNS準備を確認する管理画面です。</p>
        </header>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <Link key={item.href} className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5" href={item.href} rel="nofollow">
              <h2 className="text-2xl font-semibold">{item.title}</h2>
              <p className="mt-3 leading-7 text-[#5e625c]">{item.description}</p>
              <span className="mt-5 inline-flex rounded bg-[#222820] px-4 py-2 text-sm font-semibold text-[#fff8ed]">開く</span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
