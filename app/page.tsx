"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type FortuneTheme = "love" | "work" | "money" | "today";

type FortuneResult = {
  score: number;
  title: string;
  summary: string;
  advice: string;
  lucky: string;
};

declare global {
  interface Window {
    gtag?: (
      command: "event",
      eventName: string,
      params?: Record<string, string | number | boolean>,
    ) => void;
  }
}

const copy = {
  site: "Raven Oracle",
  heroTitle: "AI\u7121\u6599\u5360\u3044",
  heroText:
    "\u540d\u524d\u3068\u6c17\u306b\u306a\u308b\u30c6\u30fc\u30de\u3092\u5165\u308c\u308b\u3060\u3051\u3067\u3001\u4eca\u65e5\u306e\u6d41\u308c\u3068\u5c0f\u3055\u306a\u958b\u904b\u30a2\u30c9\u30d0\u30a4\u30b9\u3092\u7121\u6599\u3067\u78ba\u8a8d\u3067\u304d\u307e\u3059\u3002",
  name: "\u304a\u540d\u524d",
  namePlaceholder: "\u4f8b: \u30ec\u30a4\u30f4\u30f3",
  theme: "\u5360\u3044\u305f\u3044\u30c6\u30fc\u30de",
  concern: "\u4eca\u6c17\u306b\u306a\u3063\u3066\u3044\u308b\u3053\u3068",
  concernPlaceholder:
    "\u4e00\u8a00\u3067\u3082\u5927\u4e08\u592b\u3067\u3059\u3002\u4f8b: \u9023\u7d61\u3092\u5f85\u3064\u3079\u304d\u304b\u8ff7\u3063\u3066\u3044\u308b",
  submit: "\u7121\u6599\u3067\u5360\u3046",
  resultTitle: "\u7121\u6599\u5360\u3044\u7d50\u679c",
  waiting: "\u5165\u529b\u5f8c\u306b\u3001Raven Oracle\u306e\u7121\u6599\u5360\u3044\u7d50\u679c\u304c\u3053\u3053\u306b\u8868\u793a\u3055\u308c\u307e\u3059\u3002",
  fortune: "\u904b\u6c17",
  lucky: "\u30e9\u30c3\u30ad\u30fc\u30a2\u30a4\u30c6\u30e0",
  textReading: "AI\u30c6\u30ad\u30b9\u30c8\u9451\u5b9a",
  comingBody:
    "\u6587\u7ae0\u306e\u6e29\u5ea6\u3001\u610f\u56f3\u3001\u30ea\u30b9\u30af\u3001\u6b21\u306e\u4e00\u624b\u3092\u8aad\u3080AI\u30c6\u30ad\u30b9\u30c8\u9451\u5b9a\u306f\u6e96\u5099\u4e2d\u3067\u3059\u3002\u516c\u958b\u307e\u3067\u3082\u3046\u5c11\u3057\u304a\u5f85\u3061\u304f\u3060\u3055\u3044\u3002",
};

const themeLabels: Record<FortuneTheme, string> = {
  love: "\u604b\u611b",
  work: "\u4ed5\u4e8b",
  money: "\u91d1\u904b",
  today: "\u4eca\u65e5",
};

const themeOptions: Array<{ id: FortuneTheme; label: string; description: string }> = [
  { id: "love", label: themeLabels.love, description: "\u76f8\u624b\u3068\u306e\u8ddd\u96e2\u611f\u3084\u4eca\u306e\u6d41\u308c" },
  { id: "work", label: themeLabels.work, description: "\u52d5\u304f\u3079\u304d\u30bf\u30a4\u30df\u30f3\u30b0\u3068\u6ce8\u610f\u70b9" },
  { id: "money", label: themeLabels.money, description: "\u4f7f\u3046\u30fb\u5b88\u308b\u30fb\u6574\u3048\u308b\u5224\u65ad" },
  { id: "today", label: themeLabels.today, description: "\u4e00\u65e5\u306e\u6d41\u308c\u3068\u5c0f\u3055\u306a\u958b\u904b\u884c\u52d5" },
];

function buildFortune(theme: FortuneTheme, name: string, concern: string): FortuneResult {
  const seed = `${theme}:${name.trim()}:${concern.trim()}`;
  const value = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 17);
  const score = 54 + (value % 43);
  const nameLabel = name.trim() || "\u3042\u306a\u305f";
  const hasConcern = concern.trim().length > 0;

  const titles: Record<FortuneTheme, string[]> = {
    love: ["\u8ddd\u96e2\u3092\u8a70\u3081\u308b\u3088\u308a\u3001\u6e29\u5ea6\u3092\u305d\u308d\u3048\u308b\u65e5", "\u8a00\u8449\u306e\u9078\u3073\u65b9\u3067\u6d41\u308c\u304c\u5909\u308f\u308b\u65e5"],
    work: ["\u6bb5\u53d6\u308a\u3092\u6574\u3048\u308b\u307b\u3069\u5f37\u304f\u306a\u308b\u65e5", "\u5c0f\u3055\u306a\u6c7a\u65ad\u304c\u52b9\u304f\u65e5"],
    money: ["\u5b88\u308a\u3092\u56fa\u3081\u308b\u3068\u904b\u304c\u6b8b\u308b\u65e5", "\u8a18\u9332\u304c\u91d1\u904b\u3092\u6574\u3048\u308b\u65e5"],
    today: ["\u5348\u524d\u306f\u6574\u3048\u3001\u5348\u5f8c\u306b\u52d5\u304f\u65e5", "\u9759\u304b\u306a\u96c6\u4e2d\u304c\u7d50\u679c\u306b\u3064\u306a\u304c\u308b\u65e5"],
  };

  const advice: Record<FortuneTheme, string> = {
    love: "\u8fd4\u4e8b\u3092\u6025\u304c\u305a\u3001\u76f8\u624b\u304c\u53d7\u3051\u53d6\u308a\u3084\u3059\u3044\u4e00\u6587\u306b\u6574\u3048\u3066\u304b\u3089\u52d5\u3044\u3066\u304f\u3060\u3055\u3044\u3002",
    work: "\u4e00\u756a\u91cd\u3044\u4f5c\u696d\u3092\u5148\u306b15\u5206\u3060\u3051\u9032\u3081\u308b\u3068\u3001\u6b8b\u308a\u306e\u5224\u65ad\u304c\u8efd\u304f\u306a\u308a\u307e\u3059\u3002",
    money: "\u4eca\u65e5\u306e\u51fa\u8cbb\u306f\u76ee\u7684\u3092\u66f8\u3044\u3066\u304b\u3089\u6c7a\u3081\u308b\u3068\u3001\u5f8c\u6094\u306e\u5c11\u306a\u3044\u9078\u629e\u306b\u306a\u308a\u307e\u3059\u3002",
    today: "\u4e88\u5b9a\u3092\u4e00\u3064\u6e1b\u3089\u3057\u3001\u6b8b\u3057\u305f\u4e88\u5b9a\u306e\u7cbe\u5ea6\u3092\u4e0a\u3052\u308b\u3068\u6d41\u308c\u304c\u5b89\u5b9a\u3057\u307e\u3059\u3002",
  };

  const luckyItems = ["\u767d\u3044\u7d19", "\u6e29\u304b\u3044\u98f2\u307f\u7269", "\u7d30\u3044\u30da\u30f3", "\u671d\u306e\u63db\u6c17", "\u77ed\u3044\u30e1\u30e2", "\u9280\u8272\u306e\u5c0f\u7269"];
  const title = titles[theme][value % titles[theme].length];

  return {
    score,
    title,
    summary: hasConcern
      ? `${nameLabel}\u3055\u3093\u306e\u300c${themeLabels[theme]}\u300d\u306f\u3001\u4eca\u3059\u3050\u5927\u304d\u304f\u52d5\u304b\u3059\u3088\u308a\u3001\u72b6\u6cc1\u3092\u4e00\u6bb5\u3060\u3051\u6574\u7406\u3059\u308b\u3068\u904b\u304c\u5165\u308a\u3084\u3059\u3044\u6d41\u308c\u3067\u3059\u3002`
      : `${nameLabel}\u3055\u3093\u306e\u300c${themeLabels[theme]}\u300d\u306f\u3001\u4f59\u767d\u3092\u4f5c\u308b\u307b\u3069\u6574\u3046\u6d41\u308c\u3067\u3059\u3002`,
    advice: advice[theme],
    lucky: luckyItems[value % luckyItems.length],
  };
}

function trackEvent(eventName: string, params?: Record<string, string | number | boolean>) {
  window.gtag?.("event", eventName, params);
}

export default function Home() {
  const [theme, setTheme] = useState<FortuneTheme>("today");
  const [name, setName] = useState("");
  const [concern, setConcern] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const result = useMemo(() => buildFortune(theme, name, concern), [theme, name, concern]);

  useEffect(() => {
    trackEvent("coming_soon_text_reading_view");
  }, []);

  function submitFortune(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    trackEvent("free_fortune_submit", {
      fortune_theme: theme,
      has_name: name.trim().length > 0,
      has_concern: concern.trim().length > 0,
      concern_length: concern.trim().length,
      fortune_score: result.score,
    });
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#20241f]">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-5 py-6 lg:grid-cols-[1fr_0.82fr]">
        <div className="flex flex-col gap-5">
          <header className="border-b border-[#d7cabc] pb-5">
            <nav className="mb-4 flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]"><span className="uppercase text-[#6c5f3d]">{copy.site}</span><Link href="/blog/">ブログ</Link><Link href="/admin/" rel="nofollow">管理</Link></nav>
            <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">{copy.heroTitle}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#5e625c]">{copy.heroText}</p>
          </header>

          <form className="rounded border border-[#d7cabc] bg-[#fffaf2] p-4 shadow-sm" onSubmit={submitFortune}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">{copy.name}</span>
                <input className="rounded border border-[#cbbfac] bg-white px-3 py-3 outline-none focus:border-[#746844]" value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.namePlaceholder} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">{copy.theme}</span>
                <select className="rounded border border-[#cbbfac] bg-white px-3 py-3 outline-none focus:border-[#746844]" value={theme} onChange={(event) => {
                  const nextTheme = event.target.value as FortuneTheme;
                  setTheme(nextTheme);
                  trackEvent("fortune_theme_select", { fortune_theme: nextTheme, source: "select" });
                }}>
                  {themeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-4 flex flex-col gap-2">
              <span className="text-sm font-semibold">{copy.concern}</span>
              <textarea className="min-h-32 resize-none rounded border border-[#cbbfac] bg-white px-3 py-3 leading-7 outline-none focus:border-[#746844]" value={concern} onChange={(event) => setConcern(event.target.value)} placeholder={copy.concernPlaceholder} />
            </label>
            <button className="mt-4 w-full rounded bg-[#222820] px-5 py-3 font-semibold text-[#fff8ed]" type="submit">{copy.submit}</button>
          </form>

          <div className="grid gap-3 sm:grid-cols-3">
            {themeOptions.map((option) => (
              <button key={option.id} className={`rounded border p-3 text-left transition ${theme === option.id ? "border-[#222820] bg-[#eef1e8]" : "border-[#d7cabc] bg-[#fffaf2]"}`} onClick={() => {
                setTheme(option.id);
                trackEvent("fortune_theme_select", { fortune_theme: option.id, source: "card" });
              }} type="button">
                <p className="font-semibold">{option.label}</p>
                <p className="mt-1 text-sm leading-6 text-[#66645d]">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        <section className="flex flex-col gap-4">
          <aside className="rounded border border-[#cbd4c4] bg-[#edf3e8] p-5 shadow-sm">
            <p className="text-sm font-semibold text-[#596d51]">{copy.resultTitle}</p>
            {submitted ? (
              <div className="mt-4">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-2xl font-semibold">{result.title}</h2>
                  <div className="text-right"><p className="text-sm text-[#596d51]">{copy.fortune}</p><p className="text-4xl font-semibold">{result.score}</p></div>
                </div>
                <p className="mt-4 leading-7 text-[#3f4b3d]">{result.summary}</p>
                <p className="mt-4 rounded bg-[#ffffffb8] p-3 leading-7">{result.advice}</p>
                <p className="mt-4 text-sm font-semibold text-[#596d51]">{copy.lucky}: {result.lucky}</p>
              </div>
            ) : <div className="mt-4 rounded bg-[#ffffffb8] p-4 leading-7 text-[#586052]">{copy.waiting}</div>}
          </aside>

          <aside className="rounded border border-[#d5c8ba] bg-[#171d1a] p-5 text-[#f8f2e8] shadow-xl">
            <p className="text-sm font-semibold uppercase text-[#a8b897]">Coming soon</p>
            <h2 className="mt-2 text-3xl font-semibold">{copy.textReading}</h2>
            <p className="mt-3 leading-7 text-[#d8d1c6]">{copy.comingBody}</p>
            <div className="mt-4 rounded border border-[#3a443d] bg-[#222a25] p-3 text-sm text-[#c9d7bf]">Coming soon...</div>
          </aside>
        </section>
      </section>
    </main>
  );
}
