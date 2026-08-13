"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Summary = { period: string; visits: number; readings: number; chatStarts: number; noteViews: number };
type AnalyticsPayload = {
  periodDays: number;
  visits: number;
  readings: number;
  chatStarts: number;
  noteViews: number;
  primaryActions: number;
  uniqueVisitors: number;
  topPages: { page_path: string; count: number }[];
  referrers: { referrer_host: string; count: number }[];
  daily: { day: string; count: number }[];
  externalMetrics: { source: string; metric_name: string; metric_value: number; measured_at: string; data_quality: string }[];
  externalConnectors: { source: string; provider: string; enabled: number; sync_status: string; last_success_at?: string; last_attempt_at?: string; last_error?: string }[];
  generatedAt: string;
};

const eventDefinitions = [
  { name: "page_view", label: "ページ閲覧", purpose: "訪問の入口と流入傾向を確認" },
  { name: "raven_text_reading", label: "テキスト鑑定実行", purpose: "無料鑑定から有料導線への入口" },
  { name: "timed_chat_start", label: "時間制チャット開始", purpose: "相談意欲が高いユーザーの行動" },
  { name: "admin_note_view", label: "運用メモ閲覧", purpose: "内部運用確認イベント" },
  { name: "raven_primary_action", label: "主要リンククリック", purpose: "CTAと内部導線の反応確認" },
];

function rate(value: number, total: number) {
  if (!total) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

export default function AnalyticsAdminPage() {
  const [periodDays, setPeriodDays] = useState(30);
  const [summary, setSummary] = useState<Summary>({ period: "直近30日", visits: 0, readings: 0, chatStarts: 0, noteViews: 0 });
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loadState, setLoadState] = useState("実データを読み込み中です。");
  const [syncState, setSyncState] = useState("外部分析は未同期です。");
  const [memo, setMemo] = useState("");

  function applyPayload(payload: AnalyticsPayload) {
    setAnalytics(payload);
    setSummary({
      period: `直近${payload.periodDays}日`,
      visits: payload.visits || 0,
      readings: payload.readings || 0,
      chatStarts: payload.chatStarts || 0,
      noteViews: payload.noteViews || 0,
    });
    setLoadState(`D1実データを表示中です。最終集計: ${payload.generatedAt.slice(0, 16).replace("T", " ")}`);
  }

  useEffect(() => {
    let active = true;
    setLoadState("実データを読み込み中です。");
    fetch(`/api/analytics/summary?days=${periodDays}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("summary failed"))))
      .then((payload: AnalyticsPayload) => {
        if (active) applyPayload(payload);
      })
      .catch(() => {
        if (active) setLoadState("実データを取得できませんでした。手入力で確認してください。");
      });
    return () => {
      active = false;
    };
  }, [periodDays]);

  const nextAction = useMemo(() => {
    if (!summary.visits) return "GA4またはCloudflareの数値を入力してください。";
    const readingRate = summary.readings / summary.visits;
    const chatRate = summary.chatStarts / summary.visits;
    if (readingRate < 0.08) return "トップページの鑑定ボタン周辺と入力欄の案内文を見直してください。";
    if (chatRate < 0.05) return "時間制チャット開始までの導線を短くし、利用前の不安を減らしてください。";
    return "鑑定結果からチャットへ進む流れを検証し、次の改善メモに残してください。";
  }, [summary]);

  const readingRateValue = summary.visits ? summary.readings / summary.visits : 0;
  const chatRateValue = summary.visits ? summary.chatStarts / summary.visits : 0;
  const noteRateValue = summary.visits ? summary.noteViews / summary.visits : 0;
  const funnel = [
    { label: "訪問", value: summary.visits, width: 100 },
    { label: "鑑定実行", value: summary.readings, width: summary.visits ? Math.max(6, readingRateValue * 100) : 6 },
    { label: "チャット開始", value: summary.chatStarts, width: summary.visits ? Math.max(6, chatRateValue * 100) : 6 },
  ];
  const diagnosis = [
    readingRateValue >= 0.08 ? "鑑定実行率は最低ラインを超えています。" : "鑑定実行率が低めです。ファーストビューの説明とボタン文言を見直してください。",
    chatRateValue >= 0.05 ? "チャット開始率は良好です。" : "チャット開始率が低めです。料金・相談例・所要時間の不安を減らしてください。",
    noteRateValue > 0 ? "運用メモ閲覧イベントは動いています。" : "運用メモ閲覧は未計測です。イベント名と導線を確認してください。",
  ];

  function updateNumber(key: keyof Summary, value: string) {
    setSummary((current) => ({ ...current, [key]: Number(value.replace(/,/g, "")) || 0 }));
  }

  function syncExternalAnalytics() {
    setSyncState("GA4 / Search Console / Cloudflare Analyticsを同期中です。");
    fetch("/api/growth-engine/external-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: "raven-oracle", days: periodDays }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("external sync failed"))))
      .then((payload) => {
        const ok = (payload.results || []).filter((item: { ok: boolean }) => item.ok).length;
        const total = (payload.results || []).length;
        setSyncState(`外部分析同期完了: ${ok}/${total} 接続成功、保存メトリクス ${payload.metrics || 0} 件`);
        return fetch(`/api/analytics/summary?days=${periodDays}`, { cache: "no-store" });
      })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: AnalyticsPayload | null) => {
        if (payload) applyPayload(payload);
      })
      .catch(() => setSyncState("外部分析同期に失敗しました。SecretsまたはProvider権限を確認してください。"));
  }

  function generateMemo() {
    setMemo(`${summary.period}の振り返りです。訪問数は${summary.visits.toLocaleString("ja-JP")}、テキスト鑑定実行率は${rate(summary.readings, summary.visits)}、チャット開始率は${rate(summary.chatStarts, summary.visits)}、運用メモ閲覧率は${rate(summary.noteViews, summary.visits)}でした。\n\n次の一手: ${nextAction}\n\n個人情報を含む相談文は保存せず、イベント名と集計値だけで判断します。`);
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-6xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Analytics</p>
          <h1 className="mt-2 text-4xl font-semibold">アクセス分析</h1>
          <p className="mt-3 max-w-3xl leading-7 text-[#5e625c]">D1内蔵解析、GA4、Search Console、Cloudflare Analyticsの状態を確認します。外部Provider未設定時は未設定として安全に表示します。</p>
          <p className="mt-3 text-sm font-semibold text-[#596d51]">{loadState}</p>
        </header>

        <div className="mt-5 flex flex-wrap gap-2">
          {[7, 30, 90].map((days) => <button key={days} className={`rounded border border-[#d7cabc] px-4 py-2 font-semibold ${periodDays === days ? "bg-[#222820] text-[#fff8ed]" : "bg-white text-[#20241f]"}`} type="button" onClick={() => setPeriodDays(days)}>直近{days}日</button>)}
          <button className="rounded border border-[#596d51] bg-[#edf3e8] px-4 py-2 font-semibold text-[#20241f]" type="button" onClick={syncExternalAnalytics}>外部分析を同期</button>
          <span className="rounded border border-[#d7cabc] bg-white px-4 py-2 text-sm text-[#5e625c]">{syncState}</span>
        </div>

        <section className="mt-8 grid gap-3 md:grid-cols-4">
          <Metric label="訪問数" value={summary.visits.toLocaleString("ja-JP")} />
          <Metric label="推定ユニーク" value={(analytics?.uniqueVisitors || 0).toLocaleString("ja-JP")} />
          <Metric label="鑑定実行率" value={rate(summary.readings, summary.visits)} />
          <Metric label="チャット開始率" value={rate(summary.chatStarts, summary.visits)} />
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
            <label className="grid gap-2 text-sm font-semibold">期間<input className="admin-field" value={summary.period} onChange={(event) => setSummary({ ...summary, period: event.target.value })} /></label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">訪問数<input className="admin-field" inputMode="numeric" onChange={(event) => updateNumber("visits", event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-semibold">鑑定実行<input className="admin-field" inputMode="numeric" onChange={(event) => updateNumber("readings", event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-semibold">チャット開始<input className="admin-field" inputMode="numeric" onChange={(event) => updateNumber("chatStarts", event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-semibold">メモ閲覧<input className="admin-field" inputMode="numeric" onChange={(event) => updateNumber("noteViews", event.target.value)} /></label>
            </div>
            <button className="mt-4 rounded bg-[#222820] px-5 py-3 font-semibold text-[#fff8ed]" type="button" onClick={generateMemo}>振り返りメモを生成</button>
          </div>
          <div className="grid gap-4">
            <div className="rounded border border-[#cbd4c4] bg-[#edf3e8] p-5"><p className="text-sm font-semibold text-[#596d51]">NEXT ACTION</p><p className="mt-2 text-lg font-semibold">{nextAction}</p></div>
            <div className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
              <h2 className="text-2xl font-semibold">簡易ファネル</h2>
              <div className="mt-4 grid gap-3">{funnel.map((item) => <div key={item.label}><div className="flex justify-between text-sm font-semibold"><span>{item.label}</span><span>{item.value.toLocaleString("ja-JP")}</span></div><div className="mt-2 h-3 bg-white"><div className="h-3 bg-[#596d51]" style={{ width: `${Math.min(100, item.width)}%` }} /></div></div>)}</div>
            </div>
            <textarea className="admin-field min-h-52 leading-7" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="生成した振り返りメモがここに入ります。" />
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <Panel title="診断">{diagnosis.map((item) => <p key={item} className="rounded border border-[#d7cabc] bg-white p-3 leading-7">{item}</p>)}</Panel>
          <Panel title="改善チェックリスト">{["ファーストビューに無料鑑定の入口が見えている", "鑑定結果から有料導線への説明が自然につながる", "時間制チャットの料金・使い方・相談例が分かる", "SNS・ブログからの流入にUTMを付けている", "個人情報を含む相談本文を解析DBへ保存していない"].map((item) => <label key={item} className="flex gap-2 rounded border border-[#d7cabc] bg-white p-3"><input type="checkbox" /><span>{item}</span></label>)}</Panel>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <DataPanel title="外部Connector" rows={(analytics?.externalConnectors || []).map((item) => ({ title: `${item.source} / ${item.provider} / ${item.sync_status}${item.last_error ? ` / ${item.last_error}` : ""}`, value: item.enabled }))} empty="GA4 / Search Console / Cloudflare Analyticsの接続状態はまだありません。" />
          <DataPanel title="外部メトリクス" rows={(analytics?.externalMetrics || []).map((item) => ({ title: `${item.source} / ${item.metric_name} / ${item.data_quality}`, value: Number(item.metric_value || 0) }))} empty="外部分析データはまだ同期されていません。" />
          <DataPanel title="人気ページ" rows={(analytics?.topPages || []).map((item) => ({ title: item.page_path, value: item.count }))} empty="ページ閲覧データはまだありません。" />
          <DataPanel title="参照元" rows={(analytics?.referrers || []).map((item) => ({ title: item.referrer_host, value: item.count }))} empty="参照元データはまだありません。" />
          <DataPanel title="日別イベント" rows={(analytics?.daily || []).slice(-10).map((item) => ({ title: item.day, value: item.count }))} empty="日別データはまだありません。" />
        </section>

        <section className="mt-8 rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><h2 className="text-2xl font-semibold">計測イベント</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{eventDefinitions.map((event) => <article key={event.name} className="rounded border border-[#d7cabc] bg-white p-3"><code className="text-sm font-semibold">{event.name}</code><p className="mt-2 text-sm font-semibold">{event.label}</p><p className="mt-1 text-sm leading-6 text-[#5e625c]">{event.purpose}</p></article>)}</div></section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-[#d7cabc] bg-[#fffaf2] p-4"><p className="text-sm text-[#5e625c]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><h2 className="text-2xl font-semibold">{title}</h2><div className="mt-4 grid gap-3">{children}</div></section>;
}

function DataPanel({ title, rows, empty }: { title: string; rows: { title: string; value: number }[]; empty: string }) {
  return (
    <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-4 grid gap-2">
        {rows.map((row) => <div key={row.title} className="flex justify-between gap-3 rounded border border-[#d7cabc] bg-white p-3 text-sm"><span className="break-all">{row.title || "未設定"}</span><strong>{row.value.toLocaleString("ja-JP")}</strong></div>)}
        {!rows.length ? <p className="text-sm text-[#5e625c]">{empty}</p> : null}
      </div>
    </section>
  );
}
