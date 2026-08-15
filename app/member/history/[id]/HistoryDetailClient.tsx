"use client";

import { useEffect, useState } from "react";

type DetailPayload = {
  ok?: boolean;
  reading?: Record<string, unknown>;
  item?: Record<string, unknown>;
  error?: string;
};

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default function HistoryDetailClient({ id }: { id: string }) {
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [status, setStatus] = useState("鑑定内容を読み込んでいます。");

  useEffect(() => {
    fetch(`/api/member/history/${encodeURIComponent(id)}`)
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        setPayload(body);
        setStatus(ok ? "保存済みの鑑定内容です。" : body.error || "鑑定内容を取得できません。");
      })
      .catch(() => setStatus("鑑定内容を読み込めませんでした。"));
  }, [id]);

  const reading = payload?.reading || payload?.item || {};
  const result = reading.result_snapshot || reading.result || reading.text || "";
  const input = reading.input_snapshot || reading.input || "";

  return (
    <main className="raven-page min-h-screen bg-[#f5f0e8] text-[#20241f]">
      <section className="raven-content-shell mx-auto max-w-4xl px-4 py-5 sm:px-5 sm:py-8">
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]">
          <a className="underline underline-offset-4" href="/member/history/">履歴一覧へ戻る</a>
          <a className="underline underline-offset-4" href="/text-reading/">もう一度鑑定する</a>
        </div>
        <article className="raven-card mt-4 p-5 sm:p-6">
          <p className="text-sm font-semibold text-[#6c5f3d]">Saved Reading</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">{valueText(reading.title) || "保存済み鑑定"}</h1>
          <p className="mt-3 leading-7 text-[#5e625c]">{status}</p>

          <section className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4">
            <h2 className="text-xl font-semibold">鑑定結果</h2>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#20241f]">{valueText(result) || payload?.error || "表示できる本文がありません。"}</pre>
          </section>

          <section className="mt-4 rounded border border-[#d7cabc] bg-white/70 p-4">
            <h2 className="text-xl font-semibold">入力内容</h2>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5e625c]">{valueText(input) || "入力スナップショットはありません。"}</pre>
          </section>
        </article>
      </section>
    </main>
  );
}
