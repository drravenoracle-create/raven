"use client";

import { useEffect, useState } from "react";

type ReadingItem = {
  id?: string;
  reading_id?: string;
  title?: string;
  menu_id?: string;
  character_id?: string;
  created_at?: string;
  is_trial?: boolean;
  summary?: string;
};

type HistoryPayload = {
  ok?: boolean;
  readings?: ReadingItem[];
  items?: ReadingItem[];
  data?: ReadingItem[];
  error?: string;
  code?: string;
};

export default function HistoryPageClient() {
  const [payload, setPayload] = useState<HistoryPayload | null>(null);
  const [status, setStatus] = useState("鑑定履歴を読み込んでいます。");

  useEffect(() => {
    fetch("/api/member/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_name: "reading_history_viewed", page_path: "/member/history/" }),
    }).catch(() => {});

    fetch("/api/member/history?character_id=raven")
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        setPayload(body);
        setStatus(ok ? "鑑定履歴を表示しています。" : body.error || "鑑定履歴は現在利用できません。");
      })
      .catch(() => setStatus("鑑定履歴を読み込めませんでした。"));
  }, []);

  const readings = payload?.readings || payload?.items || payload?.data || [];

  return (
    <main className="raven-page min-h-screen bg-[#f5f0e8] text-[#20241f]">
      <section className="raven-content-shell mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-8">
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]">
          <a className="underline underline-offset-4" href="/member/">マイページへ戻る</a>
          <a className="underline underline-offset-4" href="/text-reading/">新しい鑑定へ</a>
        </div>
        <header className="raven-card mt-4 p-5 sm:p-6">
          <p className="text-sm font-semibold text-[#6c5f3d]">Reading History</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">鑑定履歴</h1>
          <p className="mt-3 leading-7 text-[#5e625c]">{status}</p>
        </header>

        <div className="mt-5 grid gap-3">
          {readings.length ? (
            readings.map((item) => {
              const id = item.reading_id || item.id || "";
              return (
                <article key={id || item.created_at} className="raven-card p-5">
                  <p className="text-xs font-semibold text-[#6c5f3d]">
                    {item.created_at || "日時未取得"} / {item.menu_id || "raven-reading"} / {item.is_trial ? "trial" : "reading"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">{item.title || "レイヴン鑑定"}</h2>
                  {item.summary ? <p className="mt-2 leading-7 text-[#5e625c]">{item.summary}</p> : null}
                  {id ? (
                    <a className="mt-3 inline-flex text-sm font-semibold text-[#596d51] underline underline-offset-4" href={`/member/history/${id}/`}>
                      詳細を読む
                    </a>
                  ) : null}
                </article>
              );
            })
          ) : (
            <section className="raven-card p-5 leading-7 text-[#5e625c]">
              <p>{payload?.error || "まだ表示できる鑑定履歴がありません。"}</p>
              <p className="mt-2">Member Core未接続時は、履歴はここには保存されません。</p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
