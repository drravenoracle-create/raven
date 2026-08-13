"use client";

import { FormEvent, useMemo, useState } from "react";

type ReadingMode = "message" | "reply" | "consultation";
type DivinationMenu = "integrated" | "qimen" | "liuren" | "taiyi" | "yijing";

const trialPrice = "0円";

const modes: Array<{ id: ReadingMode; label: string; description: string; placeholder: string }> = [
  {
    id: "message",
    label: "受け取った文章",
    description: "相手の文章の温度、意図、距離感を整理します。",
    placeholder: "相手から届いた文章を貼ってください。相手との関係や、気になっている点を少し添えると読みやすくなります。",
  },
  {
    id: "reply",
    label: "送る前の文章",
    description: "言い方の強さ、誤解されやすさ、整え方を見ます。",
    placeholder: "送る前の文章を貼ってください。どう見られたいか、避けたい印象があれば一緒に書いてください。",
  },
  {
    id: "consultation",
    label: "相談文",
    description: "問いの焦点と、次に選べる行動を整理します。",
    placeholder: "相談したい内容を書いてください。迷っている選択肢、期限、相手との関係があれば入れてください。",
  },
];

const divinationMenus: Array<{
  id: DivinationMenu;
  label: string;
  description: string;
  output: string;
}> = [
  {
    id: "integrated",
    label: "統合鑑定",
    description: "文章、感情、状況、次の一手を総合的に読みます。",
    output: "意図 / 温度 / 注意点 / 次の一手",
  },
  {
    id: "qimen",
    label: "奇門遁甲",
    description: "動く時期、待つべきか、連絡の順番を見ます。",
    output: "時機 / 動く方針 / 避ける動き / 一手",
  },
  {
    id: "liuren",
    label: "六壬神課",
    description: "相手の姿勢、関係の流れ、隠れた障害を読みます。",
    output: "相手の姿勢 / 障害 / 流れ / 接し方",
  },
  {
    id: "taiyi",
    label: "太乙神数",
    description: "長期運、環境、転機、大きな流れを見ます。",
    output: "大局 / 環境圧 / 転機 / 戦略",
  },
  {
    id: "yijing",
    label: "易経",
    description: "今の変化、取るべき姿勢、守るものと手放すものを見ます。",
    output: "今の卦意 / 変化 / 守るもの / 手放すもの",
  },
];

export default function TextReadingPage() {
  const [mode, setMode] = useState<ReadingMode>("message");
  const [divination, setDivination] = useState<DivinationMenu>("integrated");
  const [sourceText, setSourceText] = useState("");
  const [result, setResult] = useState("");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState("文章を入力すると、AIテキスト鑑定結果を表示します。");
  const [busy, setBusy] = useState(false);

  const selectedMode = useMemo(() => modes.find((item) => item.id === mode) || modes[0], [mode]);
  const selectedDivination = useMemo(() => divinationMenus.find((item) => item.id === divination) || divinationMenus[0], [divination]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = sourceText.trim();
    if (!text) {
      setStatus("鑑定したい文章・相談内容を入力してください。");
      return;
    }

    setBusy(true);
    setResult("");
    setModel("");
    setStatus(`レイヴンが「${selectedDivination.label}」で読んでいます...`);
    try {
      const response = await fetch("/api/raven", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "reading",
          readingMode: mode,
          readingModeLabel: selectedMode.label,
          divination,
          divinationLabel: selectedDivination.label,
          sourceText: text,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "AI鑑定に失敗しました。");
      setResult(payload.text || "");
      setModel(payload.model || "");
      setStatus(payload.model ? `AI鑑定完了: ${payload.model}` : "AI鑑定完了");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI鑑定に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="raven-page min-h-screen bg-[#f5f0e8] text-[#20241f]">
      <section className="raven-text-shell mx-auto grid w-full max-w-6xl gap-6 px-4 py-4 sm:px-5 sm:py-6 lg:grid-cols-[minmax(0,1fr)_0.82fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <a className="text-sm font-semibold text-[#596d51] underline underline-offset-4" href="/">トップへ戻る</a>

          <header className="raven-card p-5 sm:p-6">
            <p className="text-sm font-semibold text-[#6c5f3d]">AIテキスト占い</p>
            <h1 className="mt-2 text-[2rem] font-semibold leading-tight sm:text-5xl">
              文章と問いを、<br />
              占術別に読む
            </h1>
            <p className="mt-3 leading-7 text-[#5e625c]">
              受け取った文章、送る前の文章、相談文を、
              <br className="sm:hidden" />
              レイヴン・ブラックウッドの視点で整理します。
              <br className="sm:hidden" />
              選んだ占術ごとに、見る場所と結果の構造が変わります。
            </p>
          </header>

          <section className="raven-card p-4">
            <p className="text-sm font-semibold text-[#6c5f3d]">トライアル価格</p>
            <p className="mt-1 text-3xl font-semibold text-[#20241f]">{trialPrice}</p>
            <p className="mt-2 leading-7 text-[#5e625c]">
              現在は全メニューを0円で試せます。
              <br className="sm:hidden" />
              出力品質と導線を確認したうえで、
              <br className="sm:hidden" />
              有料化やメニュー拡張を進めます。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">文章タイプ</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {modes.map((item) => (
                <button
                  key={item.id}
                  className={`min-h-28 rounded border p-3 text-left ${mode === item.id ? "border-[#222820] bg-[#eef1e8]" : "border-[#d7cabc] bg-[#fffaf2]"}`}
                  type="button"
                  onClick={() => setMode(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{item.label}</p>
                    <span className="rounded bg-[#222820] px-2 py-1 text-xs font-semibold text-[#fff8ed]">{trialPrice}</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#66645d]">{item.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">占術メニュー</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {divinationMenus.map((item) => (
                <button
                  key={item.id}
                  className={`min-h-36 rounded border p-3 text-left ${divination === item.id ? "border-[#222820] bg-[#eef1e8]" : "border-[#d7cabc] bg-[#fffaf2]"}`}
                  type="button"
                  onClick={() => setDivination(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{item.label}</p>
                    <span className="rounded bg-[#222820] px-2 py-1 text-xs font-semibold text-[#fff8ed]">{trialPrice}</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#66645d]">{item.description}</p>
                </button>
              ))}
            </div>
          </section>

          <form className="raven-card raven-fortune-form p-4" onSubmit={submit}>
            <div className="rounded border border-[#d7cabc] bg-white/70 p-3 text-sm leading-6 text-[#5e625c]">
              <p className="font-semibold text-[#20241f]">現在の読み方: {selectedMode.label} / {selectedDivination.label}</p>
              <p className="mt-1">出力構造: {selectedDivination.output}</p>
            </div>
            <label className="mt-4 flex flex-col gap-2">
              <span className="text-sm font-semibold">鑑定したい文章・相談内容</span>
              <textarea
                className="min-h-44"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder={selectedMode.placeholder}
              />
            </label>
            <button className="raven-primary-button mt-4 disabled:opacity-60" type="submit" disabled={busy}>
              {busy ? "鑑定中..." : `${selectedDivination.label}でAI鑑定する`}
            </button>
          </form>
        </div>

        <aside className="raven-card p-5 lg:sticky lg:top-5 lg:self-start">
          <p className="text-sm font-semibold text-[#596d51]">テキスト鑑定結果</p>
          <p className="mt-2 text-sm leading-6 text-[#5e625c]">{status}</p>
          {model ? <p className="mt-1 text-xs font-semibold text-[#596d51]">AI生成 / {model}</p> : null}
          {result ? (
            <div className="mt-4 whitespace-pre-wrap rounded border border-[#d7cabc] bg-white/75 p-4 leading-8 text-[#20241f]">
              {result}
            </div>
          ) : (
            <div className="mt-4 rounded border border-[#d7cabc] bg-white/75 p-4 leading-7 text-[#586052]">
              現在の選択: {selectedMode.label} / {selectedDivination.label}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
