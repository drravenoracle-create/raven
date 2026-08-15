"use client";

import { useEffect, useState } from "react";

type Theme = "today" | "love" | "work" | "money" | "yijing";

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

const themes: Array<{ id: Theme; label: string; description: string; prompt: string }> = [
  {
    id: "today",
    label: "今日の流れ",
    description: "一日のリズム、先に整えること、急がなくてよいことを見ます。",
    prompt: "例: 今日を落ち着いて過ごすために、最初に意識することを知りたい",
  },
  {
    id: "love",
    label: "恋愛・相性",
    description: "相手との距離感、連絡の温度、踏み込みすぎない一手を見ます。",
    prompt: "例: 相手に連絡してよいか、少し待つべきか迷っている",
  },
  {
    id: "work",
    label: "仕事",
    description: "優先順位、交渉姿勢、力を入れる場所と抜く場所を見ます。",
    prompt: "例: 今の仕事で、どこに集中すれば流れが良くなるか知りたい",
  },
  {
    id: "money",
    label: "金運",
    description: "支出、回収できる価値、衝動的な判断を避ける視点を見ます。",
    prompt: "例: 買うか待つか、今のお金の使い方を見直したい",
  },
  {
    id: "yijing",
    label: "易断",
    description: "今の変化、守るもの、手放すもの、小さな一手を見ます。",
    prompt: "例: このまま進めるべきか、一度立ち止まるべきかを見たい",
  },
];

const themeNames: Record<Theme, string> = {
  today: "今日の流れ",
  love: "恋愛・相性",
  work: "仕事",
  money: "金運",
  yijing: "易断",
};

export default function FreeFortuneClient() {
  const [theme, setTheme] = useState<Theme>("today");
  const [name, setName] = useState("");
  const [concern, setConcern] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  const [model, setModel] = useState("");
  const [status, setStatus] = useState("テーマを選んで、今の流れを短く確認できます。");
  const [memberNotice, setMemberNotice] = useState("");
  const [authLinks, setAuthLinks] = useState<{ login_url?: string; register_url?: string }>({});
  const [busy, setBusy] = useState(false);

  const selectedTheme = themes.find((item) => item.id === theme) || themes[0];

  useEffect(() => {
    fetch(`/api/member/status?return_to=/free-fortune/&menu_id=raven-free-${theme}`)
      .then((response) => response.json())
      .then((payload) => {
        setAuthLinks(payload.auth_links || {});
        if (payload.flags?.member_system_enabled && payload.flags?.configured && !payload.session?.authenticated) {
          setMemberNotice("無料トライアルを履歴に残すには、ギルド共通アカウントへの登録またはログインが必要です。");
        } else if (payload.flags?.member_system_enabled && payload.session?.authenticated) {
          setMemberNotice("ギルド共通アカウントにログイン済みです。結果は履歴保存の対象になります。");
        } else {
          setMemberNotice("");
        }
      })
      .catch(() => setMemberNotice(""));
  }, [theme]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("レイヴンがカードを開き、今の流れを整理しています。");
    setReading(null);
    setModel("");

    try {
      const response = await fetch("/api/raven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "fortune", theme, name, concern }),
      });
      const payload = (await response.json()) as { reading?: Reading; model?: string; error?: string; auth_url?: string; register_url?: string };
      if (!response.ok || !payload.reading) {
        if (payload.auth_url || payload.register_url) setAuthLinks({ login_url: payload.auth_url, register_url: payload.register_url });
        throw new Error(payload.error || "鑑定結果を取得できませんでした。");
      }
      setReading(payload.reading);
      setModel(payload.model || "");
      if (payload.model) {
        setStatus(`AI鑑定完了: ${payload.model}`);
      } else if (payload.reading.source === "safety") {
        setStatus("安全確認を優先した結果を表示しています。");
      } else {
        setStatus("鑑定完了。現在は補助結果を表示しています。");
      }
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
              レイヴン・ブラックウッドの鑑定室へ入る前に、今日の兆しを軽く確認できます。
              無料占いは結論を決めつけるものではなく、今の気持ちと次の一手を整理する入口です。
            </p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {themes.map((item) => (
              <button
                key={item.id}
                className={`min-h-32 rounded border p-3 text-left ${theme === item.id ? "border-[#222820] bg-[#eef1e8]" : "border-[#d7cabc] bg-[#fffaf2]"}`}
                type="button"
                onClick={() => setTheme(item.id)}
              >
                <span className="block font-semibold">{item.label}</span>
                <span className="mt-1 block text-sm leading-6 text-[#66645d]">{item.description}</span>
              </button>
            ))}
          </div>

          <form className="raven-card raven-fortune-form p-4 sm:p-5" onSubmit={submit}>
            {memberNotice ? (
              <div className="mb-4 rounded border border-[#d7cabc] bg-white/70 p-3 text-sm leading-6 text-[#5e625c]">
                <p>{memberNotice}</p>
                <div className="mt-2 flex flex-wrap gap-3 font-semibold text-[#596d51]">
                  {authLinks.register_url ? <a className="underline underline-offset-4" href={authLinks.register_url}>無料登録</a> : null}
                  {authLinks.login_url ? <a className="underline underline-offset-4" href={authLinks.login_url}>ログイン</a> : null}
                  <a className="underline underline-offset-4" href="/member/">マイページ</a>
                </div>
              </div>
            ) : null}
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
                placeholder={selectedTheme.prompt}
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
                <p className="text-xs font-semibold text-[#596d51]">開かれたカード</p>
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
              結果はここに表示されます。テーマごとに、見る角度と次の一手が変わります。
              もっと具体的に読みたい場合は、AIテキスト占いで相談文や相手の文章を貼って確認できます。
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
