"use client";

import { useEffect, useState } from "react";

type MemberStatus = {
  ok?: boolean;
  flags?: {
    configured?: boolean;
    member_system_enabled?: boolean;
    trial_enabled?: boolean;
    reading_history_enabled?: boolean;
    cross_character_access_enabled?: boolean;
  };
  session?: {
    authenticated?: boolean;
    display_name?: string;
    member_id?: string;
    email_verified?: boolean;
  };
  trial_summary?: unknown;
  auth_links?: {
    login_url?: string;
    register_url?: string;
  };
  unavailable_reason?: string;
  error?: string;
};

const characterLinks = [
  { id: "raven", name: "レイヴン・ブラックウッド", href: "/guild/", status: "現在の鑑定室" },
  { id: "scarlet", name: "スカーレット", href: "/guild/", status: "ギルド紹介へ" },
  { id: "luna", name: "ルナ", href: "/guild/", status: "ギルド紹介へ" },
  { id: "atlas", name: "アトラス", href: "/guild/", status: "ギルド紹介へ" },
];

export default function MemberPageClient() {
  const [status, setStatus] = useState<MemberStatus | null>(null);
  const [message, setMessage] = useState("ギルド共通アカウントの状態を確認しています。");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/member/status?return_to=/member/&menu_id=raven-member-home", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        setStatus(payload);
        if (payload?.session?.authenticated) {
          setMessage("ログイン済みです。鑑定履歴とトライアル状況を確認できます。");
        } else if (payload?.flags?.member_system_enabled && payload?.flags?.configured) {
          setMessage("ログインまたは登録すると、無料トライアルと鑑定履歴をまとめて利用できます。");
        } else {
          setMessage("現在、履歴機能の一部を準備中です。公開サイトの鑑定機能はこれまで通り利用できます。");
        }
      })
      .catch(() => setMessage("ギルド共通アカウントの状態を確認できませんでした。"));
    return () => controller.abort();
  }, []);

  const flags = status?.flags;
  const session = status?.session;
  const loginUrl = status?.auth_links?.login_url || "/api/member/auth/start?mode=login&return_to=/member/";
  const registerUrl = status?.auth_links?.register_url || "/api/member/auth/start?mode=register&return_to=/member/";

  return (
    <main className="raven-page min-h-screen bg-[#f5f0e8] text-[#20241f]">
      <section className="raven-content-shell mx-auto max-w-6xl px-4 py-5 sm:px-5 sm:py-8">
        <a className="text-sm font-semibold text-[#596d51] underline underline-offset-4" href="/">トップへ戻る</a>

        <header className="raven-member-hero mt-4 p-5 sm:p-7">
          <p className="text-sm font-semibold text-[#d8b15f]">Guild Member Account</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight text-[#fff8e7] sm:text-6xl">ギルド共通マイページ</h1>
          <p className="mt-4 max-w-2xl leading-8 text-[#e9dfcc]">
            レイヴンの鑑定、無料トライアル、鑑定履歴をギルド共通アカウントに紐づけるための入口です。
          </p>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="raven-card p-5">
            <p className="text-sm font-semibold text-[#6c5f3d]">アカウント状態</p>
            <h2 className="mt-2 text-2xl font-semibold">{session?.authenticated ? session.display_name || "ログイン済み" : "未ログイン"}</h2>
            <p className="mt-3 leading-7 text-[#5e625c]">{message}</p>

            {session?.authenticated ? (
              <div className="mt-4 grid gap-3">
                <a className="raven-primary-button inline-flex items-center justify-center" href="/member/history/">
                  鑑定履歴を見る
                </a>
                <a className="rounded border border-[#596d51] px-4 py-3 text-center font-semibold text-[#596d51]" href="/text-reading/">
                  新しいAIテキスト鑑定へ
                </a>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a className="raven-primary-button inline-flex items-center justify-center" href={registerUrl}>
                  無料登録する
                </a>
                <a className="rounded border border-[#596d51] px-4 py-3 text-center font-semibold text-[#596d51]" href={loginUrl}>
                  ログイン
                </a>
              </div>
            )}

            <div className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4 text-sm leading-7 text-[#5e625c]">
              <p className="font-semibold text-[#20241f]">連携状態</p>
              <p>アカウント機能: {flags?.member_system_enabled ? "利用可能" : "準備中"}</p>
              <p>履歴連携: {flags?.configured ? "利用可能" : "準備中"}</p>
              <p>鑑定履歴: {flags?.reading_history_enabled ? "有効" : "無効"}</p>
            </div>
          </section>

          <section className="raven-card p-5">
            <p className="text-sm font-semibold text-[#6c5f3d]">トライアルと回遊</p>
            <h2 className="mt-2 text-2xl font-semibold">レイヴンから他メンバーへつなぐ</h2>
            <p className="mt-3 leading-7 text-[#5e625c]">
              鑑定履歴は必要な情報だけを安全に扱います。ギルド内の他メンバーへ移動するときも、同じアカウントで利用しやすい形を整えています。
            </p>
            <pre className="mt-4 max-h-44 overflow-auto rounded border border-[#d7cabc] bg-white/70 p-3 text-xs text-[#4e554a]">
              {JSON.stringify(status?.trial_summary || { trial: "準備中" }, null, 2)}
            </pre>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {characterLinks.map((item) => (
                <a
                  key={item.id}
                  className="rounded border border-[#d7cabc] bg-white/70 p-4 text-[#20241f]"
                  href={item.href}
                  onClick={() => {
                    fetch("/api/member/events", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ event_name: "character_switched", target_character_id: item.id, page_path: "/member/" }),
                    }).catch(() => {});
                  }}
                >
                  <span className="block font-semibold">{item.name}</span>
                  <span className="mt-1 block text-sm text-[#5e625c]">{item.status}</span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
