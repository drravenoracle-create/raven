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
  profile?: { birth_date?: string | null };
  trial_summary?: unknown;
  auth_links?: {
    login_url?: string;
    register_url?: string;
    google_login_url?: string;
    google_register_url?: string;
    email_login_url?: string;
    email_register_url?: string;
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
  const [birthDate, setBirthDate] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/member/status?return_to=/member/&menu_id=raven-member-home", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        setStatus(payload);
        setBirthDate(payload?.profile?.birth_date || "");
        if (payload?.session?.authenticated) {
          setMessage("ログイン済みです。鑑定履歴と無料利用枠を確認できます。");
        } else if (payload?.flags?.member_system_enabled && payload?.flags?.configured) {
          setMessage("ログインまたは登録すると、無料利用枠と鑑定履歴を利用できます。");
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
  const googleRegisterUrl = status?.auth_links?.google_register_url || registerUrl;
  const emailRegisterUrl = status?.auth_links?.email_register_url;
  const googleLoginUrl = status?.auth_links?.google_login_url || loginUrl;
  const emailLoginUrl = status?.auth_links?.email_login_url;

  async function saveBirthDate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileMessage("");
    try {
      const response = await fetch("/api/member/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ birth_date: birthDate }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "プロフィールを保存できませんでした。");
      setBirthDate(payload.profile?.birth_date || birthDate);
      setProfileMessage("生年月日を保存しました。次回から鑑定時の入力を省略できます。");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "プロフィールを保存できませんでした。");
    } finally {
      setProfileBusy(false);
    }
  }

  async function deleteBirthDate() {
    setProfileBusy(true);
    setProfileMessage("");
    try {
      const response = await fetch("/api/member/profile", { method: "DELETE" });
      if (!response.ok) throw new Error("生年月日を削除できませんでした。");
      setBirthDate("");
      setProfileMessage("生年月日を削除しました。");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "生年月日を削除できませんでした。");
    } finally {
      setProfileBusy(false);
    }
  }

  return (
    <main className="raven-page min-h-screen bg-[#f5f0e8] text-[#20241f]">
      <section className="raven-content-shell mx-auto max-w-6xl px-4 py-5 sm:px-5 sm:py-8">
        <a className="text-sm font-semibold text-[#596d51] underline underline-offset-4" href="/">トップへ戻る</a>

        <header className="raven-member-hero mt-4 p-5 sm:p-7">
            <p className="text-sm font-semibold text-[#d8b15f]">会員ページ</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight text-[#fff8e7] sm:text-6xl">ギルド共通マイページ</h1>
          <p className="mt-4 max-w-2xl leading-8 text-[#e9dfcc]">
            レイヴンの鑑定結果を保存し、次回からスムーズに利用するための会員ページです。
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
                <a className="raven-primary-button inline-flex items-center justify-center" href={googleRegisterUrl}>
                  Googleで登録
                </a>
                {emailRegisterUrl ? <a className="rounded border border-[#596d51] px-4 py-3 text-center font-semibold text-[#596d51]" href={emailRegisterUrl}>メールで登録</a> : null}
                <a className="rounded border border-[#596d51] px-4 py-3 text-center font-semibold text-[#596d51]" href={googleLoginUrl}>
                  Googleでログイン
                </a>
                {emailLoginUrl ? <a className="rounded border border-[#596d51] px-4 py-3 text-center font-semibold text-[#596d51]" href={emailLoginUrl}>メールでログイン</a> : null}
              </div>
            )}

            {session?.authenticated ? (
              <form className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4" onSubmit={saveBirthDate}>
                <p className="font-semibold text-[#20241f]">鑑定プロフィール</p>
                <p className="mt-1 text-sm leading-6 text-[#5e625c]">生年月日を一度保存すると、対応する鑑定で毎回入力する必要がなくなります。変更・削除はいつでもできます。</p>
                <label className="mt-3 flex flex-col gap-2">
                  <span className="text-sm font-semibold">生年月日</span>
                  <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} max={new Date().toISOString().slice(0, 10)} disabled={profileBusy} />
                </label>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button className="raven-primary-button disabled:opacity-60" type="submit" disabled={profileBusy || !birthDate}>{profileBusy ? "保存中..." : "生年月日を保存"}</button>
                  {birthDate ? <button className="rounded border border-[#596d51] px-4 py-2 font-semibold text-[#596d51] disabled:opacity-60" type="button" onClick={deleteBirthDate} disabled={profileBusy}>削除</button> : null}
                </div>
                {profileMessage ? <p className="mt-2 text-sm leading-6 text-[#596d51]" role="status">{profileMessage}</p> : null}
                <p className="mt-2 text-xs leading-5 text-[#6a6c66]">生年月日は公開せず、Ravenの鑑定プロフィールとしてのみ使用します。</p>
              </form>
            ) : null}

            <div className="mt-5 rounded border border-[#d7cabc] bg-white/70 p-4 text-sm leading-7 text-[#5e625c]">
              <p className="font-semibold text-[#20241f]">連携状態</p>
              <p>アカウント機能: {flags?.member_system_enabled ? "利用可能" : "準備中"}</p>
              <p>履歴連携: {flags?.configured ? "利用可能" : "準備中"}</p>
              <p>鑑定履歴: {flags?.reading_history_enabled ? "有効" : "無効"}</p>
            </div>
          </section>

          <section className="raven-card p-5">
            <p className="text-sm font-semibold text-[#6c5f3d]">鑑定履歴とギルド案内</p>
            <h2 className="mt-2 text-2xl font-semibold">鑑定結果を保存して、他の占い師の視点も見る</h2>
            <p className="mt-3 leading-7 text-[#5e625c]">
              登録すると、レイヴンで受けた鑑定結果をあとから見返せます。悩みの内容に合わせて、ギルドに所属する他の占い師の紹介もご覧いただけます。
            </p>
            <div className="mt-4 grid gap-3 rounded border border-[#d7cabc] bg-white/70 p-4 text-sm leading-7 text-[#5e625c]">
              <p><span className="font-semibold text-[#20241f]">無料鑑定：</span>{session?.authenticated ? "現在の利用状況を確認できます。" : "登録すると無料鑑定の利用状況を確認できます。"}</p>
              <p><span className="font-semibold text-[#20241f]">鑑定履歴：</span>{session?.authenticated ? "保存した結果をいつでも見返せます。" : "登録後に鑑定結果を保存できます。"}</p>
            </div>
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
