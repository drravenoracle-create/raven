"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { blogPosts } from "../../lib/blog";

type DraftPost = { slug: string; title: string; description: string; pubDate: string; category: string; tags: string; featured: boolean; body: string };

const blankPost: DraftPost = {
  slug: "",
  title: "",
  description: "",
  pubDate: new Date().toISOString().slice(0, 10),
  category: "テキスト鑑定",
  tags: "Raven Oracle, 文章鑑定",
  featured: false,
  body: "## 見出し\n\n本文を入力してください。",
};

function toSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || `raven-${Date.now()}`;
}

export default function BlogAdminPage() {
  const [post, setPost] = useState<DraftPost>(blankPost);
  const [status, setStatus] = useState("未保存です。");
  const markdown = useMemo(() => {
    const tags = post.tags.split(",").map((tag) => `"${tag.trim()}"`).filter((tag) => tag !== '""').join(", ");
    return `---\ntitle: "${post.title}"\ndescription: "${post.description}"\npubDate: ${post.pubDate}\ncategory: "${post.category}"\ntags: [${tags}]\nfeatured: ${post.featured}\n---\n\n${post.body}\n`;
  }, [post]);

  function generateDraft() {
    const title = "返信前の文章を整えるチェックポイント";
    setPost({
      slug: toSlug(title),
      title,
      description: "送信前の文面を、温度、意図、相手への伝わり方から確認するためのメモです。",
      pubDate: new Date().toISOString().slice(0, 10),
      category: "テキスト鑑定",
      tags: "Raven Oracle, 文章鑑定, 返信前チェック",
      featured: false,
      body: "## まず目的を一文にする\n\n相手に何を伝えたいのか、最後にどう動いてほしいのかを一文で整理します。\n\n## 圧を確認する\n\n正しさが強すぎる文面は、相手に防御姿勢を作らせます。必要なら、要望と気持ちを分けて書きます。\n\n## 送る前に保留する\n\n感情が強い時は、送信前に少し時間を置きます。Raven Oracleの鑑定結果は、そのための確認材料として使います。",
    });
    setStatus("記事案を生成しました。内容確認後にMarkdownを使ってください。");
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown);
    setStatus("Markdownをコピーしました。");
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${post.slug || "raven-post"}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus("Markdownファイルを出力しました。");
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-6xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6"><p className="text-sm font-semibold uppercase text-[#6c5f3d]">Notes Admin</p><h1 className="mt-2 text-4xl font-semibold">運用メモ管理</h1><p className="mt-3 max-w-2xl leading-7 text-[#5e625c]">公開メモの確認、記事案生成、Markdown出力を行います。</p></header>
        <section className="mt-8 grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><h2 className="text-2xl font-semibold">公開メモ</h2><div className="mt-4 grid gap-3">{blogPosts.map((item) => <button key={item.slug} className="rounded border border-[#d7cabc] bg-white p-3 text-left" type="button" onClick={() => setPost({ ...item, tags: item.tags.join(", ") })}><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-xs text-[#5e625c]">{item.pubDate} / {item.category}</span></button>)}</div><button className="mt-4 w-full rounded bg-[#222820] px-4 py-3 font-semibold text-[#fff8ed]" type="button" onClick={generateDraft}>記事案を生成</button></aside>
          <div className="grid gap-5"><div className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><div className="grid gap-3 sm:grid-cols-2"><Field label="スラッグ" value={post.slug} onChange={(value) => setPost({ ...post, slug: toSlug(value) })} /><Field label="公開日" type="date" value={post.pubDate} onChange={(value) => setPost({ ...post, pubDate: value })} /></div><Field label="タイトル" value={post.title} onChange={(value) => setPost({ ...post, title: value })} /><label className="mt-3 grid gap-2 text-sm font-semibold">説明文<textarea className="admin-field min-h-24" value={post.description} onChange={(event) => setPost({ ...post, description: event.target.value })} /></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="カテゴリ" value={post.category} onChange={(value) => setPost({ ...post, category: value })} /><Field label="タグ" value={post.tags} onChange={(value) => setPost({ ...post, tags: value })} /></div><label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input checked={post.featured} type="checkbox" onChange={(event) => setPost({ ...post, featured: event.target.checked })} />トップに表示</label><label className="mt-3 grid gap-2 text-sm font-semibold">本文<textarea className="admin-field min-h-72 font-mono text-sm leading-7" value={post.body} onChange={(event) => setPost({ ...post, body: event.target.value })} /></label></div><div className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Markdown出力</h2><div className="flex flex-wrap gap-2"><button className="rounded border border-[#d7cabc] px-4 py-2 font-semibold" type="button" onClick={copyMarkdown}>コピー</button><button className="rounded bg-[#222820] px-4 py-2 font-semibold text-[#fff8ed]" type="button" onClick={downloadMarkdown}>ダウンロード</button></div></div><pre className="mt-4 max-h-96 overflow-auto rounded border border-[#d7cabc] bg-white p-4 text-sm"><code>{markdown}</code></pre><p className="mt-3 text-sm text-[#5e625c]">{status}</p></div></div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="mt-3 grid gap-2 text-sm font-semibold">{label}<input className="admin-field" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
