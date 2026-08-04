"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Summary = { period: string; visits: number; readings: number; chatStarts: number; noteViews: number };

function rate(value: number, total: number) {
  if (!total) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

export default function AnalyticsAdminPage() {
  const [summary, setSummary] = useState<Summary>({ period: "2026年7月 第4週", visits: 0, readings: 0, chatStarts: 0, noteViews: 0 });
  const [memo, setMemo] = useState("");

  const nextAction = useMemo(() => {
    if (!summary.visits) return "GA4またはCloudflareの数値を入力してください。";
    const readingRate = summary.readings / summary.visits;
    const chatRate = summary.chatStarts / summary.visits;
    if (readingRate < 0.08) return "トップページの鑑定ボタン周辺と入力欄の案内文を見直してください。";
    if (chatRate < 0.05) return "時間制チャット開始までの導線を短くし、利用前の不安を減らしてください。";
    return "鑑定結果からチャットへ進む流れを検証し、次の改善メモに残してください。";
  }, [summary]);

  function updateNumber(key: keyof Summary, value: string) {
    setSummary((current) => ({ ...current, [key]: Number(value.replace(/,/g, "")) || 0 }));
  }

  function generateMemo() {
    setMemo(`${summary.period}の振り返りです。訪問数は${summary.visits.toLocaleString("ja-JP")}、テキスト鑑定実行率は${rate(summary.readings, summary.visits)}、チャット開始率は${rate(summary.chatStarts, summary.visits)}、運用メモ閲覧率は${rate(summary.noteViews, summary.visits)}でした。\n\n次の一手: ${nextAction}\n\n個人情報を含む相談文は保存せず、イベント名と集計値だけで判断します。`);
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-6xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6"><p className="text-sm font-semibold uppercase text-[#6c5f3d]">Analytics</p><h1 className="mt-2 text-4xl font-semibold">アクセス分析</h1><p className="mt-3 max-w-2xl leading-7 text-[#5e625c]">テキスト鑑定と時間制チャットの利用状況から、次の改善アクションを整理します。</p></header>
        <section className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
            <label className="grid gap-2 text-sm font-semibold">期間<input className="admin-field" value={summary.period} onChange={(event) => setSummary({ ...summary, period: event.target.value })} /></label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">訪問数<input className="admin-field" inputMode="numeric" onChange={(event) => updateNumber("visits", event.target.value)} /></label><label className="grid gap-2 text-sm font-semibold">鑑定実行<input className="admin-field" inputMode="numeric" onChange={(event) => updateNumber("readings", event.target.value)} /></label><label className="grid gap-2 text-sm font-semibold">チャット開始<input className="admin-field" inputMode="numeric" onChange={(event) => updateNumber("chatStarts", event.target.value)} /></label><label className="grid gap-2 text-sm font-semibold">メモ閲覧<input className="admin-field" inputMode="numeric" onChange={(event) => updateNumber("noteViews", event.target.value)} /></label></div>
            <button className="mt-4 rounded bg-[#222820] px-5 py-3 font-semibold text-[#fff8ed]" type="button" onClick={generateMemo}>振り返りメモを生成</button>
          </div>
          <div className="grid gap-4"><div className="grid gap-3 sm:grid-cols-3"><Metric label="鑑定実行率" value={rate(summary.readings, summary.visits)} /><Metric label="チャット開始率" value={rate(summary.chatStarts, summary.visits)} /><Metric label="メモ閲覧率" value={rate(summary.noteViews, summary.visits)} /></div><div className="rounded border border-[#cbd4c4] bg-[#edf3e8] p-5"><p className="text-sm font-semibold text-[#596d51]">NEXT ACTION</p><p className="mt-2 text-lg font-semibold">{nextAction}</p></div><textarea className="admin-field min-h-52 leading-7" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="生成した振り返りメモがここに入ります。" /></div>
        </section>
        <section className="mt-8 rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><h2 className="text-2xl font-semibold">計測イベント</h2><div className="mt-4 grid gap-2 sm:grid-cols-3">{["raven_text_reading", "timed_chat_start", "admin_note_view"].map((event) => <code key={event} className="rounded border border-[#d7cabc] bg-white px-3 py-2 text-sm">{event}</code>)}</div></section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-[#d7cabc] bg-[#fffaf2] p-4"><p className="text-sm text-[#5e625c]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>;
}
