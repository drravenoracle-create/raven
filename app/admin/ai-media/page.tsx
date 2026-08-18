"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AiMediaJob = { job_id: string; status: string; media_type: string; model: string; estimated_cost: number; actual_cost: number; error_code?: string; error_message?: string; asset_id?: string; created_at?: string };
type AiMediaAsset = { asset_id: string; preview_url: string; media_type: string; aspect_ratio: string; provider: string; created_at?: string };
type AiMediaSettings = { enabled: number; provider: string; model: string; quality: string; default_aspect_ratio: string; monthly_budget_limit: number; per_post_cost_limit: number };

export default function AiMediaAdminPage() {
  const [settings, setSettings] = useState<AiMediaSettings | null>(null);
  const [jobs, setJobs] = useState<AiMediaJob[]>([]);
  const [assets, setAssets] = useState<AiMediaAsset[]>([]);
  const [monthlySpent, setMonthlySpent] = useState(0);
  const [status, setStatus] = useState("AI Media Generatorを確認しています。");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("あの人が今、あなたに隠している本音");
  const [characterId, setCharacterId] = useState("raven");
  const [mood, setMood] = useState("quiet mystical");
  const [scene, setScene] = useState("oracle cards on a quiet desk");
  const [aspectRatio, setAspectRatio] = useState("9:16");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/sns/ai-media?tenantId=raven-oracle", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.error || "AI Media情報の取得に失敗しました。");
        return;
      }
      setSettings(payload.settings || null);
      setJobs(payload.jobs || []);
      setAssets(payload.assets || []);
      setMonthlySpent(Number(payload.monthlySpent || 0));
      setStatus(`OpenAI Secret ${payload.hasOpenAiSecret ? "設定済み" : "未設定"} / Media Bucket ${payload.hasMediaBucket ? "設定済み" : "未設定"}`);
    } catch {
      setStatus("AI Media情報の取得に失敗しました。通信状態を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generateImage() {
    if (loading) return;
    setLoading(true);
    setStatus("AI画像生成ジョブを実行しています。");
    try {
      const response = await fetch("/api/sns/ai-media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "raven-oracle",
          action: "generate_image",
          theme,
          character_id: characterId,
          divination_type: "oracle",
          mood,
          scene,
          platform: "instagram",
          aspect_ratio: aspectRatio,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      setStatus(response.ok ? `生成しました: ${payload.assetId}` : `${payload.error || "生成に失敗しました。"} / job ${payload.jobId || "-"}`);
      await load();
    } catch {
      setStatus("生成に失敗しました。通信状態を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  const remaining = Math.max(Number(settings?.monthly_budget_limit || 0) - monthlySpent, 0);

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap gap-3">
          <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
          <Link className="text-sm font-semibold text-[#596d51]" href="/admin/sns/">SNS Engine</Link>
          <Link className="text-sm font-semibold text-[#596d51]" href="/admin/reels/">Reel Engine</Link>
        </nav>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">AI Media Generator</p>
          <h1 className="mt-2 text-4xl font-semibold">AI画像・動画素材生成</h1>
          <p className="mt-3 max-w-3xl leading-7 text-[#5e625c]">SNS投稿用画像を生成し、Media Libraryへ保存します。動画生成はProvider抽象化済みで、Worker内FFmpeg直実行には依存しません。</p>
        </header>
        <section className="mt-8 grid gap-3 md:grid-cols-4">
          <Metric label="生成機能" value={settings?.enabled ? "ON" : "OFF"} />
          <Metric label="今月コスト" value={`${monthlySpent.toFixed(0)}円`} />
          <Metric label="残予算" value={`${remaining.toFixed(0)}円`} />
          <Metric label="生成履歴" value={String(jobs.length)} />
        </section>
        <section className="mt-4 rounded border border-[#d7cabc] bg-[#fffaf2] p-4 text-sm leading-7 text-[#5e625c]">
          {status}
          {settings ? <p>Provider {settings.provider} / Model {settings.model} / Quality {settings.quality} / 1投稿上限 {settings.per_post_cost_limit}円</p> : null}
        </section>
        <section className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
            <label className="grid gap-2 text-sm font-semibold">テーマ<textarea className="admin-field min-h-24" value={theme} onChange={(event) => setTheme(event.target.value)} /></label>
            <label className="mt-3 grid gap-2 text-sm font-semibold">キャラクター<select className="admin-field" value={characterId} onChange={(event) => setCharacterId(event.target.value)}><option value="raven">Raven</option><option value="luna">Luna</option><option value="scarlet">Scarlet</option><option value="atlas">Atlas</option><option value="sol">Sol Aurora</option></select></label>
            <label className="mt-3 grid gap-2 text-sm font-semibold">Mood<input className="admin-field" value={mood} onChange={(event) => setMood(event.target.value)} /></label>
            <label className="mt-3 grid gap-2 text-sm font-semibold">Scene<input className="admin-field" value={scene} onChange={(event) => setScene(event.target.value)} /></label>
            <label className="mt-3 grid gap-2 text-sm font-semibold">Aspect Ratio<select className="admin-field" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}><option value="9:16">9:16</option><option value="4:5">4:5</option><option value="1:1">1:1</option></select></label>
            <button className="mt-4 rounded bg-[#222820] px-4 py-2 font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={generateImage} disabled={loading || !settings?.enabled}>{loading ? "処理中" : "AI画像生成"}</button>
            {!settings?.enabled ? <p className="mt-3 text-xs leading-5 text-[#7a451b]">現在はAI画像生成OFFです。OPENAI_API_KEYと予算設定を確認したうえで、DB設定をONにしてください。</p> : null}
          </aside>
          <div className="grid gap-6">
            <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
              <h2 className="text-2xl font-semibold">生成画像</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {assets.map((asset) => <article key={asset.asset_id} className="rounded border border-[#d7cabc] bg-white p-3"><img className="aspect-[9/16] w-full rounded border border-[#d7cabc] object-cover" src={asset.preview_url} alt="AI生成画像" /><p className="mt-2 break-all text-xs text-[#5e625c]">{asset.asset_id}</p><p className="text-xs text-[#5e625c]">{asset.provider} / {asset.aspect_ratio}</p></article>)}
                {!assets.length ? <p className="rounded border border-dashed border-[#d7cabc] bg-white p-4 text-sm leading-7 text-[#5e625c]">生成画像はまだありません。</p> : null}
              </div>
            </section>
            <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
              <h2 className="text-2xl font-semibold">生成ジョブ</h2>
              <div className="mt-4 grid gap-3">
                {jobs.map((job) => <article key={job.job_id} className="rounded border border-[#d7cabc] bg-white p-3"><p className="text-xs font-semibold text-[#6c5f3d]">{job.status} / {job.media_type} / {job.model}</p><p className="mt-1 break-all text-xs text-[#5e625c]">{job.job_id}</p>{job.error_message ? <p className="mt-2 text-xs text-red-700">{job.error_code}: {job.error_message}</p> : null}<p className="mt-1 text-xs text-[#5e625c]">cost {job.actual_cost || job.estimated_cost || 0} / {job.created_at || "-"}</p></article>)}
                {!jobs.length ? <p className="text-sm text-[#5e625c]">ジョブはまだありません。</p> : null}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="rounded border border-[#d7cabc] bg-[#fffaf2] p-4"><p className="text-sm font-semibold text-[#6c5f3d]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></article>;
}
