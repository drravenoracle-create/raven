"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Message = {
  id: number;
  role: "user" | "raven";
  text: string;
  at: string;
};

const openingMessages: Message[] = [
  {
    id: 1,
    role: "raven",
    text: "鑑定したい文章を貼り付けてください。文面の温度、意図、圧、次の一手を整理します。",
    at: "00:00",
  },
];

function scoreText(text: string) {
  const trimmed = text.trim();
  const lengthScore = Math.min(35, Math.round(trimmed.length / 12));
  const questionScore = (trimmed.match(/[?]/g) ?? []).length * 7;
  const emotionWords = [
    "不安",
    "怖い",
    "迷う",
    "好き",
    "嫌い",
    "つらい",
    "怒り",
    "寂しい",
    "信じる",
    "anxious",
    "afraid",
    "lost",
    "love",
    "hate",
    "hurt",
    "angry",
    "lonely",
    "trust",
  ];
  const emotionScore = emotionWords.reduce(
    (sum, word) => sum + (trimmed.toLowerCase().includes(word) ? 8 : 0),
    0,
  );
  const clarityScore = /したい|必要|なぜなら|だから|決める|予定|want|need|because|therefore|decide|plan/i.test(trimmed) ? 18 : 6;

  return Math.min(100, 18 + lengthScore + questionScore + emotionScore + clarityScore);
}

function createReading(text: string) {
  if (!text.trim()) {
    return {
      score: 0,
      title: "入力待ち",
      summary: "文章を入力すると、Raven Oracle用の仮鑑定がここに表示されます。",
      advice: "送信予定の文面、相談文、メモのどれかをそのまま貼り付けてください。",
      flags: ["入力待ち"],
    };
  }

  const score = scoreText(text);
  const lower = text.toLowerCase();
  const isQuestion = /[?？]|どう|なぜ|べき|かな|how|why|should|could|would/.test(lower);
  const isEmotional = /不安|怖い|迷う|好き|嫌い|つらい|怒り|寂しい|信じる|anxious|afraid|lost|love|hate|hurt|angry|lonely|trust/.test(lower);
  const isAction = /したい|必要|送る|会う|決める|止める|始める|変える|want|need|send|meet|decide|stop|start|change/.test(lower);

  return {
    score,
    title: score >= 75 ? "圧が強い文面" : score >= 50 ? "意図が見える文面" : "余白が多い文面",
    summary: isEmotional
      ? "感情が文面を運んでいます。誠実さは伝わりますが、要求や境界線は少し補強が必要です。"
      : isQuestion
        ? "問いかけが中心です。相手の返答を引き出しやすい一方で、結論はまだ開いた状態です。"
        : "落ち着いた説明文です。重要度や感情を一文足すと、意図がより明確になります。",
    advice: isAction
      ? "最後に「次にどうしてほしいか」を一文で明示すると、相手が返答しやすくなります。"
      : "改善するなら、希望、境界線、タイミングを一つずつ足してください。",
    flags: [
      isEmotional ? "感情強め" : "感情控えめ",
      isQuestion ? "問いかけ型" : "説明型",
      isAction ? "行動意図あり" : "行動意図が薄い",
    ],
  };
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export default function Home() {
  const [text, setText] = useState("");
  const [duration, setDuration] = useState(10);
  const [remaining, setRemaining] = useState(10 * 60);
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>(openingMessages);
  const [geminiReading, setGeminiReading] = useState("");
  const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "error">("idle");
  const [apiError, setApiError] = useState("");
  const [chatStatus, setChatStatus] = useState<"idle" | "loading">("idle");
  const reading = useMemo(() => createReading(text), [text]);

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      setRemaining((value) => {
        const next = Math.max(0, value - 1);
        if (next === 0) setActive(false);
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [active]);

  function startSession() {
    setRemaining(duration * 60);
    setActive(true);
    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        role: "raven",
        text: `${duration}分の時間制チャットを開始しました。焦点を一つに絞って進めます。`,
        at: formatSeconds(duration * 60),
      },
    ]);
  }

  function stopSession() {
    setActive(false);
  }

  function tickMinute() {
    setRemaining((value) => {
      const next = Math.max(0, value - 60);
      if (next === 0) setActive(false);
      return next;
    });
  }

  async function runGeminiReading() {
    if (!text.trim()) return;

    setApiStatus("loading");
    setApiError("");

    try {
      const response = await fetch("/api/raven", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "reading",
          sourceText: text,
        }),
      });
      const data = (await response.json()) as { text?: string; error?: string };

      if (!response.ok || !data.text) {
        throw new Error(data.error || "Gemini鑑定に失敗しました。");
      }

      setGeminiReading(data.text);
      setApiStatus("idle");
    } catch (error) {
      setApiStatus("error");
      setApiError(error instanceof Error ? error.message : "Gemini鑑定に失敗しました。");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;

    const currentDraft = draft.trim();
    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      text: currentDraft,
      at: formatSeconds(remaining),
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setChatStatus("loading");

    try {
      const response = await fetch("/api/raven", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "chat",
          sourceText: text,
          message: currentDraft,
          history: messages.map(({ role, text: messageText }) => ({
            role,
            text: messageText,
          })),
        }),
      });
      const data = (await response.json()) as { text?: string; error?: string };

      if (!response.ok || !data.text) {
        throw new Error(data.error || "Gemini chat failed.");
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "raven",
          text: data.text,
          at: formatSeconds(Math.max(0, remaining - 15)),
        },
      ]);
      setChatStatus("idle");
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "raven",
          text:
            reading.score > 0
              ? `${reading.title}です。今は「${reading.flags[1]}」として扱うと整理しやすいです。${reading.advice}`
              : "Geminiはまだ未設定です。鑑定対象の文章を貼ると、ローカル判定で補助できます。",
          at: formatSeconds(Math.max(0, remaining - 15)),
        },
      ]);
      setChatStatus("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f2ea] text-[#1d2320]">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-5">
          <header className="border-b border-[#d8d1c4] pb-5">
            <p className="text-sm font-semibold uppercase text-[#5f6f61]">
              Raven Oracle Review Site
            </p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">
              Raven Oracle テキスト鑑定
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#56615a]">
              ヒアリングシートで調整したRavenの人格と言葉遣いを使い、文面の温度、意図、リスク、次の一手を整理します。
            </p>
          </header>

          <div className="grid gap-3 rounded border border-[#d8d1c4] bg-[#fffaf1] p-4 text-sm text-[#4c574f] sm:grid-cols-3">
            <div>
              <p className="font-semibold text-[#28332c]">対象</p>
              <p className="mt-1">Raven Oracle</p>
            </div>
            <div>
              <p className="font-semibold text-[#28332c]">AI設定</p>
              <p className="mt-1">Gemini API / persona: raven-oracle</p>
            </div>
            <div>
              <p className="font-semibold text-[#28332c]">調整元</p>
              <p className="mt-1">ヒアリングシート反映済み</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_0.78fr]">
            <label className="flex min-h-[420px] flex-col rounded border border-[#d8d1c4] bg-[#fffaf1] p-4 shadow-sm">
              <span className="text-sm font-semibold text-[#2d372f]">鑑定する文章</span>
              <textarea
                className="mt-3 min-h-0 flex-1 resize-none bg-transparent text-base leading-7 outline-none placeholder:text-[#9a9184]"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="送信前のメッセージ、相談文、日記、メモを貼り付けます。"
              />
              <span className="mt-3 text-sm text-[#71695e]">{text.trim().length} 文字</span>
            </label>

            <aside className="rounded border border-[#cfd8cb] bg-[#eef4ec] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#526954]">鑑定スコア</p>
                  <h2 className="text-3xl font-semibold">{reading.score}</h2>
                </div>
                <div className="h-20 w-20 rounded-full border-8 border-[#8aa179] bg-[#fbfff7]" />
              </div>
              <h3 className="mt-5 text-xl font-semibold">{reading.title}</h3>
              <p className="mt-3 leading-7 text-[#4b574e]">{reading.summary}</p>
              <p className="mt-4 rounded bg-[#ffffffb8] p-3 leading-7 text-[#303a33]">{reading.advice}</p>
              <button
                className="mt-4 w-full rounded bg-[#1f2c24] px-4 py-3 text-sm font-semibold text-[#f8f5ec] disabled:opacity-45"
                onClick={runGeminiReading}
                disabled={!text.trim() || apiStatus === "loading"}
              >
                {apiStatus === "loading" ? "Geminiで鑑定中..." : "Gemini鑑定を実行"}
              </button>
              {apiError ? (
                <p className="mt-3 rounded border border-[#c99b83] bg-[#fff4ed] p-3 text-sm leading-6 text-[#7a351e]">
                  {apiError}
                </p>
              ) : null}
              {geminiReading ? (
                <div className="mt-3 rounded border border-[#b8c4b2] bg-[#fbfff7] p-3">
                  <p className="text-sm font-semibold text-[#526954]">Gemini鑑定結果</p>
                  <p className="mt-2 whitespace-pre-wrap leading-7 text-[#303a33]">{geminiReading}</p>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {reading.flags.map((flag) => (
                  <span key={flag} className="rounded border border-[#b8c4b2] px-3 py-1 text-sm">
                    {flag}
                  </span>
                ))}
              </div>
            </aside>
          </div>
        </div>

        <section className="flex min-h-[640px] flex-col rounded border border-[#cfc7ba] bg-[#171d1a] text-[#f8f5ec] shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#313b35] p-4">
            <div>
              <p className="text-sm font-semibold text-[#9eb28f]">Timed Chat</p>
              <h2 className="text-2xl font-semibold">時間制チャット</h2>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="rounded border border-[#48534d] bg-[#222a25] px-3 py-2 text-sm"
                value={duration}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setDuration(next);
                  if (!active) setRemaining(next * 60);
                }}
              >
                <option value={5}>5分</option>
                <option value={10}>10分</option>
                <option value={20}>20分</option>
                <option value={30}>30分</option>
              </select>
              <button className="rounded bg-[#d9efc8] px-4 py-2 text-sm font-semibold text-[#142017]" onClick={startSession}>
                開始
              </button>
              <button className="rounded border border-[#657167] px-4 py-2 text-sm" onClick={stopSession}>
                停止
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-[#313b35] px-4 py-3">
            <div className="font-mono text-4xl font-semibold">{formatSeconds(remaining)}</div>
            <button
              className="rounded border border-[#657167] px-3 py-2 text-sm disabled:opacity-40"
              disabled={!active || remaining === 0}
              onClick={tickMinute}
            >
              1分進める
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[86%] rounded p-3 ${
                  message.role === "user"
                    ? "ml-auto bg-[#e7ddc8] text-[#1e241f]"
                    : "bg-[#26302a] text-[#f8f5ec]"
                }`}
              >
                <div className="mb-1 flex justify-between gap-4 text-xs opacity-70">
                  <span>{message.role === "user" ? "あなた" : "Raven"}</span>
                  <span>{message.at}</span>
                </div>
                <p className="leading-7">{message.text}</p>
              </article>
            ))}
          </div>

          <form className="flex gap-2 border-t border-[#313b35] p-4" onSubmit={sendMessage}>
            <input
              className="min-w-0 flex-1 rounded border border-[#48534d] bg-[#222a25] px-3 py-3 outline-none placeholder:text-[#8b948e]"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={active ? "Ravenに相談する" : "セッション開始後に入力できます"}
              disabled={!active || chatStatus === "loading"}
            />
            <button className="rounded bg-[#d9efc8] px-5 py-3 font-semibold text-[#142017]" disabled={!active || chatStatus === "loading"}>
              {chatStatus === "loading" ? "送信中" : "送信"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
