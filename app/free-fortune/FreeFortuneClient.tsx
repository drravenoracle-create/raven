"use client";

import { useState } from "react";

type Theme = "today" | "love" | "work" | "money";

type Reading = {
  source: "ai" | "fallback" | "safety";
  theme: Theme;
  card: {
    nameJa: string;
    name: string;
    meaning: string;
  };
  title: string;
  summary: string;
  advice: string;
  caution: string;
  luckyAction: string;
};

const themes: Array<{ id: Theme; label: string; description: string }> = [
  { id: "today", label: "今日", description: "一日の流れ、整える順番、小さな開運行動" },
  { id: "love", label: "恋愛・相性", description: "相手との距離感、連絡の温度、関係の流れ" },
  { id: "work", label: "仕事", description: "動くタイミング、優先順位、避けたい進め方" },
  { id: "money", label: "金運", description: "支出の見直し、回収できる価値、判断の置き所" },
];

const themeNames: Record<Theme, string> = {
  today: "今日",
  love: "恋愛・相性",
  work: "仕事",
  money: "金運",
};

export default function FreeFortuneClient() {
  const [theme, setTheme] = useState<Theme>("today");
  const [name, setName] = useState("");
  const [concern, setConcern] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  const [model, setModel] = useState("");
  const [status, setStatus] = useState("気になるテーマを選んで、いまの流れを確認できます。");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("鑑定中です。問いの輪郭を整えています。");
    setReading(null);
    setModel("");

    try {
      const response = await fetch("/api/raven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "fortune", theme, name, concern }),
      });
      const payload = await response.json() as { reading?: Reading; model?: string; error?: string };
      if (!response.ok || !payload.reading) throw new Error(payload.error || "鑑定結果を取得できませんでした。");
      setReading(payload.reading);
      setModel(payload.model || "");
      setStatus(payload.model ? `AI鑑定完了: ${payload.model}` : payload.reading.source === "safety" ? "安全確認を優先した結果です。" : "鑑定完了。現在は補助結果で表示しています。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "鑑定中にエラーが発生しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="raven-page min-h-screen bg-[#f5f0e8] text-[#20241f]">
      <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-4 sm:px-5 sm:py-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <a className="text-sm font-semibold text-[#596d51] underline underline-offset-4" href="/">トップへ戻る</a>

          <header className="raven-card p-5 sm:p-6">
            <p className="text-sm font-semibold text-[#6c5f3d]">AI無料占い</p>
            <h1 className="mt-2 text-[2rem] font-semibold leading-tight sm:text-5xl">今の流れを、短く確かめる</h1>
            <p className="mt-3 leading-7 text-[#5e625c]">
              レイヴン・ブラックウッドが、選んだテーマに合わせて「兆し・読み・注意点・今日の一手」を整理します。
              深刻に決めつけるためではなく、次の行動を軽く整えるための無料鑑定です。
            </p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {themes.map((item) => (
              <button
                key={item.id}
                className={`min-h-28 rounded border p-3 text-left ${theme === item.id ? "border-[#222820] bg-[#eef1e8]" : "border-[#d7cabc] bg-[#fffaf2]"}`}
                type="button"
                onClick={() => setTheme(item.id)}
              >
                <span className="block font-semibold">{item.label}</span>
                <span className="mt-1 block text-sm leading-6 text-[#66645d]">{item.description}</span>
              </button>
            ))}
          </div>

          <form className="raven-card raven-fortune-form p-4 sm:p-5" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">お名前</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例: レイヴン" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">占うテーマ</span>
                <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
                  {themes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-4 flex flex-col gap-2">
              <span className="text-sm font-semibold">気になっていること</span>
              <textarea
                className="min-h-32"
                value={concern}
                onChange={(event) => setConcern(event.target.value)}
                placeholder="例: 返信するべきか、少し待つべきか迷っている"
              />
            </label>
            <button className="raven-primary-button mt-4 disabled:opacity-60" type="submit" disabled={busy}>
              {busy ? "鑑定中..." : `${themeNames[theme]}を無料で占う`}
            </button>
          </form>
        </div>

        <aside className="raven-card p-5 lg:sticky lg:top-5 lg:self-start">
          <p className="text-sm font-semibold text-[#596d51]">鑑定結果</p>
          <p className="mt-1 text-sm leading-6 text-[#5e625c]">{status}</p>
          {model ? <p className="mt-1 text-xs font-semibold text-[#596d51]">AI生成 / {model}</p> : null}

          {reading ? (
            <div className="mt-4">
              <div className="rounded border border-[#cbd4c4] bg-[#edf3e8] p-4">
                <p className="text-xs font-semibold text-[#596d51]">選ばれたカード</p>
                <h2 className="mt-1 text-2xl font-semibold leading-tight">{reading.card.nameJa}</h2>
                <p className="mt-1 text-sm text-[#5e625c]">{reading.card.meaning}</p>
              </div>

              <div className="mt-4 grid gap-3 leading-7 text-[#3f4b3d]">
                <section className="rounded border border-[#d7cabc] bg-white/75 p-4">
                  <p className="text-xs font-semibold text-[#596d51]">兆し</p>
                  <h3 className="mt-1 text-xl font-semibold">{reading.title}</h3>
                  <p className="mt-2">{reading.summary}</p>
                </section>
                <section className="rounded border border-[#d7cabc] bg-white/75 p-4">
                  <p className="text-xs font-semibold text-[#596d51]">読み</p>
                  <p className="mt-1">{reading.advice}</p>
                </section>
                <section className="rounded border border-[#d7cabc] bg-white/75 p-4">
                  <p className="text-xs font-semibold text-[#596d51]">注意点</p>
                  <p className="mt-1">{reading.caution}</p>
                </section>
                <section className="rounded border border-[#d7cabc] bg-white/75 p-4">
                  <p className="text-xs font-semibold text-[#596d51]">今日の一手</p>
                  <p className="mt-1">{reading.luckyAction}</p>
                </section>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded border border-[#d7cabc] bg-white/75 p-4 leading-7 text-[#586052]">
              結果はここに表示されます。テーマごとに視点が変わるため、同じ相談でも「恋愛」「仕事」「金運」では読みの焦点が変わります。
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
