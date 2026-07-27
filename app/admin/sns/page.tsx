"use client";

import Link from "next/link";
import { useState } from "react";

type Slide = { heading: string; body: string };

const ideas = [
  "今日の流れを整えるAI占いの使い方",
  "返信を待つ時間に心を守る3つの視点",
  "仕事運が揺れる日に見直したい小さな習慣",
];

export default function SnsAdminPage() {
  const [topic, setTopic] = useState(ideas[0]);
  const [goal, setGoal] = useState("無料占いへの誘導");
  const [tone, setTone] = useState("静かで知的");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("投稿前です。");

  function generateSlides() {
    const generated = [
      { heading: topic, body: "今の気持ちを責めずに、まず一文で整理します。" },
      { heading: "問いを短くする", body: "知りたいことを絞るほど、占い結果を行動に移しやすくなります。" },
      { heading: "結果を固定しない", body: "占いは未来の断定ではなく、選択肢を見直すための補助線です。" },
      { heading: "小さく動く", body: "大きな決断の前に、今日できる小さな開運行動を選びます。" },
      { heading: "Raven Oracle", body: "無料AI占いで、今日の流れと注意点を確認できます。" },
    ];
    setSlides(generated);
    setCaption(`${topic}\n\n${tone}なトーンで、迷いを短く整えるための投稿です。\n\n${goal}として、Raven Oracleの無料AI占いへ案内します。\n\n#AI占い #今日の運勢 #RavenOracle #開運`);
    setStatus("スライド案を生成しました。内容を確認してから投稿準備してください。");
  }

  async function copyCaption() {
    await navigator.clipboard.writeText(caption);
    setStatus("キャプションをコピーしました。");
  }

  function downloadSlide(index: number) {
    const slide = slides[index];
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
    gradient.addColorStop(0, "#f5f0e8");
    gradient.addColorStop(0.55, "#edf3e8");
    gradient.addColorStop(1, "#171d1a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#20241f";
    ctx.font = "700 48px sans-serif";
    ctx.fillText("Raven Oracle", 90, 150);
    ctx.font = "700 78px sans-serif";
    wrap(ctx, slide.heading, 90, 430, 900, 96);
    ctx.font = "500 48px sans-serif";
    wrap(ctx, slide.body, 90, 760, 900, 72);
    ctx.fillStyle = "#fff8ed";
    ctx.font = "500 36px sans-serif";
    ctx.fillText(`${index + 1}/${slides.length}`, 90, 1760);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `raven-oracle-${String(index + 1).padStart(2, "0")}.png`;
    link.click();
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-6xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">SNS Creator</p>
          <h1 className="mt-2 text-4xl font-semibold">SNSコンテンツ生成</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#5e625c]">Instagram向けスライド案、PNG、キャプションを作成します。</p>
        </header>
        <section className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
            <label className="grid gap-2 text-sm font-semibold">投稿テーマ<textarea className="admin-field min-h-24" value={topic} onChange={(event) => setTopic(event.target.value)} /></label>
            <label className="mt-3 grid gap-2 text-sm font-semibold">目的<select className="admin-field" value={goal} onChange={(event) => setGoal(event.target.value)}><option>無料占いへの誘導</option><option>ブログへの誘導</option><option>AIテキスト鑑定の事前認知</option></select></label>
            <label className="mt-3 grid gap-2 text-sm font-semibold">トーン<select className="admin-field" value={tone} onChange={(event) => setTone(event.target.value)}><option>静かで知的</option><option>やさしく寄り添う</option><option>短く実用的</option></select></label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded border border-[#d7cabc] px-4 py-2 font-semibold" type="button" onClick={() => setTopic(ideas[Math.floor(Math.random() * ideas.length)])}>テーマ提案</button>
              <button className="rounded bg-[#222820] px-4 py-2 font-semibold text-[#fff8ed]" type="button" onClick={generateSlides}>生成</button>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#5e625c]">自動投稿は行いません。本人確認後にPNGとキャプションを使って投稿します。</p>
          </aside>
          <div className="grid gap-6">
            <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
              <h2 className="text-2xl font-semibold">スライド</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {slides.map((slide, index) => (
                  <article key={`${slide.heading}-${index}`} className="rounded border border-[#d7cabc] bg-white p-4">
                    <div className="aspect-[9/16] rounded border border-[#cbd4c4] bg-[#edf3e8] p-5">
                      <p className="text-xs font-semibold uppercase text-[#596d51]">Raven Oracle</p>
                      <h3 className="mt-8 text-2xl font-semibold">{slide.heading}</h3>
                      <p className="mt-5 leading-7 text-[#3f4b3d]">{slide.body}</p>
                      <p className="mt-8 text-sm text-[#596d51]">{index + 1}/{slides.length}</p>
                    </div>
                    <button className="mt-3 rounded bg-[#222820] px-4 py-2 text-sm font-semibold text-[#fff8ed]" type="button" onClick={() => downloadSlide(index)}>PNG</button>
                  </article>
                ))}
              </div>
            </section>
            <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
              <h2 className="text-2xl font-semibold">キャプション</h2>
              <textarea className="admin-field mt-4 min-h-44 leading-7" value={caption} onChange={(event) => setCaption(event.target.value)} />
              <button className="mt-3 rounded bg-[#222820] px-4 py-2 font-semibold text-[#fff8ed]" type="button" onClick={copyCaption}>コピー</button>
              <p className="mt-3 text-sm text-[#5e625c]">{status}</p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  let line = "";
  for (const char of text) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, y);
}
