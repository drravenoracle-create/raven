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

function parseSnapshot(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function methodLabel(value: unknown) {
  const labels: Record<string, string> = { yijing: "易経", qimen: "奇門遁甲", liuren: "六壬神課", taiyi: "太乙神数", integrated: "統合鑑定" };
  return labels[String(value || "")] || String(value || "");
}

function formatResult(value: unknown) {
  const parsed = parseSnapshot(value) as Record<string, unknown> | string;
  if (typeof parsed === "string") return parsed;
  if (!parsed || typeof parsed !== "object") return "";
  if (typeof parsed.text === "string") return parsed.text;
  const nested = parseSnapshot(parsed.reading);
  if (nested && typeof nested === "object") return formatResult(nested);

  const hexagram = parseSnapshot(parsed.yijingHexagram) as Record<string, unknown> | null;
  const card = parseSnapshot(parsed.card) as Record<string, unknown> | null;
  const sections = [
    ["概要", parsed.summary],
    ["読み", parsed.advice],
    ["注意点", parsed.caution],
    ["今日の一手", parsed.luckyAction],
  ].filter(([, text]) => typeof text === "string" && text.trim());
  const lines: string[] = [];
  if (hexagram?.name) lines.push(`今回出た卦: ${hexagram.name}${hexagram.reading ? `（${hexagram.reading}）` : ""}`);
  else if (card?.nameJa) lines.push(`開かれたカード: ${card.nameJa}`);
  if (parsed.title && typeof parsed.title === "string") lines.push(`\n${parsed.title}`);
  for (const [label, text] of sections) lines.push(`\n${label}\n${text}`);
  return lines.join("\n").trim() || valueText(parsed);
}

function formatInput(value: unknown) {
  const parsed = parseSnapshot(value) as Record<string, unknown> | string;
  if (typeof parsed === "string") return parsed;
  if (!parsed || typeof parsed !== "object") return "";
  const lines = [
    parsed.mode === "fortune" ? "メニュー: 無料占い" : parsed.mode === "reading" ? "メニュー: AIテキスト占い" : "",
    parsed.theme ? `テーマ: ${parsed.theme === "yijing" ? "易経" : parsed.theme}` : "",
    parsed.divination ? `占術: ${methodLabel(parsed.divination)}` : "",
    parsed.reading_mode ? `読み方: ${parsed.reading_mode}` : "",
    parsed.name ? `お名前: ${parsed.name}` : "",
    parsed.concern ? `相談内容: ${parsed.concern}` : "",
    parsed.source_text ? `入力文章: ${parsed.source_text}` : "",
  ].filter(Boolean);
  return lines.join("\n") || "入力内容はありません。";
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
            <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#20241f]">{formatResult(result) || payload?.error || "表示できる本文がありません。"}</div>
          </section>

          <section className="mt-4 rounded border border-[#d7cabc] bg-white/70 p-4">
            <h2 className="text-xl font-semibold">入力内容</h2>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5e625c]">{formatInput(input) || "入力スナップショットはありません。"}</div>
          </section>
        </article>
      </section>
    </main>
  );
}
