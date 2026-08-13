"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReelProject = { reel_id: string; title: string; objective: string; platform: string; aspect_ratio: string; duration: number; status: string; script_json: string; scenes_json: string; text_layers_json: string; background_asset_ids_json: string; renderer_provider: string; output_asset_id?: string; source_content_id?: string; created_at: string; updated_at: string };
type VideoAsset = { asset_id: string; source: string; storage_key: string; duration: number; width: number; height: number; tags_json: string; category: string; mood: string; usage_count: number; performance_score: number; license_type?: string; mime_type?: string; size_bytes?: number; checksum?: string; deleted_at?: string; created_at: string };
type RenderJob = { job_id: string; reel_id: string; provider: string; status: string; error_message?: string; created_at: string; updated_at: string };

type Script = { hook?: string; scenes?: Array<{ index: number; overlayText: string; narration: string }>; cta?: string; backgroundCategories?: string[]; tempo?: string; bgmMood?: string };

function parse<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export default function ReelAdminPage() {
  const [projects, setProjects] = useState<ReelProject[]>([]);
  const [assets, setAssets] = useState<VideoAsset[]>([]);
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("待機中です。");
  const [title, setTitle] = useState("迷った時に未来を決めつけず、選択肢を整える方法");
  const [objective, setObjective] = useState("ブログ記事から30秒Reelを作り、SNS下書きへ渡す");
  const [duration, setDuration] = useState(30);
  const [sourceContentId, setSourceContentId] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assetCategory, setAssetCategory] = useState("uploaded");
  const [assetMood, setAssetMood] = useState("calm_mystic");
  const [assetTags, setAssetTags] = useState("uploaded, reel");
  const [assetLicense, setAssetLicense] = useState("owned");
  const [assetPreviewId, setAssetPreviewId] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const selected = useMemo(() => projects.find((item) => item.reel_id === selectedId) || projects[0], [projects, selectedId]);
  const previewAsset = useMemo(() => assets.find((item) => item.asset_id === assetPreviewId), [assets, assetPreviewId]);
  const script = selected ? parse<Script>(selected.script_json, {}) : {};
  const scenes = selected ? parse<any[]>(selected.scenes_json, []) : [];
  const textLayers = selected ? parse<any[]>(selected.text_layers_json, []) : [];
  const backgroundAssetIds = selected ? parse<string[]>(selected.background_asset_ids_json, []) : [];

  async function loadAll() {
    const [projectResponse, libraryResponse, jobsResponse] = await Promise.all([
      fetch("/api/reel-engine/projects", { cache: "no-store" }),
      fetch("/api/reel-engine/library", { cache: "no-store" }),
      fetch("/api/reel-engine/render", { cache: "no-store" }),
    ]);
    if (projectResponse.ok) {
      const payload = await projectResponse.json();
      setProjects(payload.projects || []);
    }
    if (libraryResponse.ok) {
      const payload = await libraryResponse.json();
      setAssets(payload.assets || []);
    }
    if (jobsResponse.ok) {
      const payload = await jobsResponse.json();
      setJobs(payload.jobs || []);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  async function createProject() {
    if (isBusy) return;
    setIsBusy(true);
    setStatus("Reel企画を作成中です。");
    try {
      const response = await fetch("/api/reel-engine/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, objective, duration, platform: "instagram", source_content_id: sourceContentId, idempotency_key: `manual:${Date.now()}:${Math.random().toString(36).slice(2)}` }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus(payload.error || "Reel作成に失敗しました。"); return; }
      setStatus(payload.duplicate ? "既存Reel企画を表示します。" : "Reel企画を作成しました。");
      await loadAll();
      setSelectedId(payload.reelId);
    } finally {
      setIsBusy(false);
    }
  }

  async function updateStatus(nextStatus: string) {
    if (!selected) return;
    const response = await fetch("/api/reel-engine/projects", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reel_id: selected.reel_id, status: nextStatus }) });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? `Reelを ${nextStatus} に更新しました。` : payload.error || "更新に失敗しました。");
    await loadAll();
  }

  async function renderSelected() {
    if (!selected) return;
    setStatus("Render Jobを作成中です。");
    const response = await fetch("/api/reel-engine/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reel_id: selected.reel_id }) });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? payload.message || `Render状態: ${payload.status}` : payload.error || "Render要求に失敗しました。");
    await loadAll();
  }

  async function queueToSns() {
    if (!selected) return;
    const response = await fetch("/api/reel-engine/projects", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reel_id: selected.reel_id }) });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? (payload.duplicate ? "既にSNS下書きへ投入済みです。" : "SNS下書きへ投入しました。") : payload.error || "SNS投入に失敗しました。");
  }

  async function uploadAsset() {
    if (!assetFile) { setStatus("アップロードする素材を選択してください。"); return; }
    setIsUploading(true);
    setStatus("素材をアップロード中です。");
    try {
      const form = new FormData();
      form.set("file", assetFile);
      form.set("category", assetCategory);
      form.set("mood", assetMood);
      form.set("tags", assetTags);
      form.set("license_type", assetLicense);
      const response = await fetch("/api/reel-engine/assets", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus(payload.error || "素材アップロードに失敗しました。"); return; }
      setStatus(`素材をアップロードしました: ${payload.assetId}`);
      setAssetFile(null);
      await loadAll();
      setAssetPreviewId(payload.assetId);
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteAsset(asset: VideoAsset) {
    if (asset.source !== "uploaded") { setStatus("stock素材はこの画面から削除できません。"); return; }
    if (!window.confirm(`素材を削除しますか？\n${asset.asset_id}`)) return;
    const response = await fetch("/api/reel-engine/assets", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset_id: asset.asset_id }) });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "素材を削除しました。" : payload.error || "素材削除に失敗しました。");
    if (assetPreviewId === asset.asset_id) setAssetPreviewId("");
    if (response.ok) await loadAll();
  }

  function assetUrl(assetId: string) {
    return `/api/reel-engine/assets?assetId=${encodeURIComponent(assetId)}`;
  }

  function formatBytes(value?: number) {
    if (!value) return "-";
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-7xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6"><p className="text-sm font-semibold uppercase text-[#6c5f3d]">Reel Engine v1.0</p><h1 className="mt-2 text-4xl font-semibold">Reel Engine 管理</h1><p className="mt-3 max-w-3xl leading-7 text-[#5e625c]">既存SNS Engineを置き換えず、縦型ショート動画の企画、素材選択、Scene、テロップ、Render Job、SNS下書き投入を追加管理します。</p></header>
        <section className="sticky top-0 z-10 -mx-5 mt-5 border-y border-[#d7cabc] bg-[#f5f0e8]/95 px-5 py-3 backdrop-blur"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2 text-sm font-semibold"><Metric label="Reel" value={projects.length} /><Metric label="素材" value={assets.length} /><Metric label="Render" value={jobs.length} /></div><p className="text-sm font-semibold text-[#596d51]">{status}</p></div></section>
        <section className="mt-6 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="grid content-start gap-5">
            <Panel title="新規Reel作成" eyebrow="Create"><label className="grid gap-2 text-sm font-semibold">タイトル<textarea className="admin-field min-h-24" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="mt-3 grid gap-2 text-sm font-semibold">目的<textarea className="admin-field min-h-20" value={objective} onChange={(event) => setObjective(event.target.value)} /></label><label className="mt-3 grid gap-2 text-sm font-semibold">長さ<select className="admin-field" value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={15}>15秒</option><option value={30}>30秒</option><option value={60}>60秒</option></select></label><label className="mt-3 grid gap-2 text-sm font-semibold">元コンテンツID<input className="admin-field" value={sourceContentId} onChange={(event) => setSourceContentId(event.target.value)} placeholder="ブログ記事IDなど 任意" /></label><button className="mt-4 w-full rounded bg-[#222820] px-4 py-3 font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={createProject} disabled={isBusy}>{isBusy ? "作成中" : "Reel企画を作成"}</button></Panel>
            <Panel title="Reel一覧" eyebrow="Projects"><div className="grid gap-2">{projects.map((project) => <button key={project.reel_id} className={`rounded border p-3 text-left ${selected?.reel_id === project.reel_id ? "border-[#596d51] bg-white ring-2 ring-[#596d51]/20" : "border-[#d7cabc] bg-white"}`} type="button" onClick={() => setSelectedId(project.reel_id)}><span className="block text-xs font-semibold text-[#6c5f3d]">{project.status} / {project.duration}秒 / {project.platform}</span><span className="mt-1 block font-semibold leading-6">{project.title}</span><span className="mt-1 block text-xs text-[#5e625c]">{project.created_at}</span></button>)}{!projects.length ? <p className="text-sm text-[#5e625c]">Reel企画はまだありません。</p> : null}</div></Panel>
          </aside>
          <div className="grid gap-5">
            <Panel title="企画・台本" eyebrow="Script">{selected ? <div><p className="text-xs font-semibold text-[#6c5f3d]">{selected.status} / {selected.aspect_ratio} / renderer: {selected.renderer_provider}</p><h2 className="mt-2 text-2xl font-semibold">{selected.title}</h2><p className="mt-2 leading-7 text-[#5e625c]">{selected.objective}</p><div className="mt-4 rounded border border-[#d7cabc] bg-white p-4"><p className="text-sm font-semibold text-[#596d51]">Hook</p><p className="mt-1 leading-7">{script.hook}</p><p className="mt-3 text-sm font-semibold text-[#596d51]">CTA</p><p className="mt-1 leading-7">{script.cta}</p><p className="mt-3 text-sm font-semibold text-[#596d51]">Tempo / BGM</p><p className="mt-1 leading-7">{script.tempo} / {script.bgmMood}</p></div><div className="mt-4 flex flex-wrap gap-2"><button className="rounded border border-[#d7cabc] px-3 py-2 text-sm font-semibold" type="button" onClick={() => updateStatus("approved")}>承認</button><button className="rounded border border-[#d7cabc] px-3 py-2 text-sm font-semibold" type="button" onClick={() => updateStatus("scheduled")}>予約扱い</button><button className="rounded bg-[#222820] px-3 py-2 text-sm font-semibold text-[#fff8ed]" type="button" onClick={renderSelected}>Render</button><button className="rounded bg-[#596d51] px-3 py-2 text-sm font-semibold text-[#fff8ed]" type="button" onClick={queueToSns}>SNS下書きへ</button></div></div> : <p className="text-sm text-[#5e625c]">Reelを選択してください。</p>}</Panel>
            <section className="grid gap-5 lg:grid-cols-2"><Panel title="Scene構成" eyebrow="Scenes"><div className="grid gap-3">{scenes.map((scene, index) => <article key={index} className="rounded border border-[#d7cabc] bg-white p-3"><p className="text-xs font-semibold text-[#6c5f3d]">{scene.startTime}s - {scene.endTime}s / {scene.transition}</p><p className="mt-1 text-sm leading-6">素材: {scene.assetId || "未選択"}</p><p className="mt-1 text-sm leading-6">演出: {scene.fit} / {scene.motion}</p></article>)}</div></Panel><Panel title="テロップ" eyebrow="Text"><div className="grid gap-3">{textLayers.map((layer) => <article key={layer.id} className="rounded border border-[#d7cabc] bg-white p-3"><p className="text-xs font-semibold text-[#6c5f3d]">{layer.startTime}s - {layer.endTime}s / {layer.position}</p><p className="mt-1 font-semibold leading-6">{layer.text}</p></article>)}</div></Panel></section>
            <Panel title="Video Library" eyebrow="Assets">
              <div className="grid gap-4 rounded border border-[#d7cabc] bg-white p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_140px]">
                  <label className="grid gap-2 text-sm font-semibold">素材ファイル<input className="admin-field" type="file" accept="video/mp4,video/webm,image/png,image/jpeg,image/webp,audio/mpeg,audio/mp4,audio/wav" onChange={(event) => setAssetFile(event.target.files?.[0] || null)} /></label>
                  <label className="grid gap-2 text-sm font-semibold">カテゴリ<input className="admin-field" value={assetCategory} onChange={(event) => setAssetCategory(event.target.value)} /></label>
                  <label className="grid gap-2 text-sm font-semibold">ムード<input className="admin-field" value={assetMood} onChange={(event) => setAssetMood(event.target.value)} /></label>
                  <label className="grid gap-2 text-sm font-semibold">権利<select className="admin-field" value={assetLicense} onChange={(event) => setAssetLicense(event.target.value)}><option value="owned">自社保有</option><option value="licensed">ライセンス</option><option value="generated">生成素材</option></select></label>
                </div>
                <label className="grid gap-2 text-sm font-semibold">タグ<input className="admin-field" value={assetTags} onChange={(event) => setAssetTags(event.target.value)} placeholder="カンマ区切り" /></label>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="rounded bg-[#222820] px-4 py-3 text-sm font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={uploadAsset} disabled={isUploading}>{isUploading ? "アップロード中" : "R2へアップロード"}</button>
                  <p className="text-xs leading-5 text-[#5e625c]">R2未有効時はアップロード不可。Cloudflare DashboardでR2を有効化し、MEDIA_BUCKETを追加後に実ファイル保存が動きます。</p>
                </div>
              </div>
              {previewAsset ? <div className="mt-4 rounded border border-[#d7cabc] bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-[#6c5f3d]">Preview</p><h3 className="font-semibold">{previewAsset.asset_id}</h3></div><button className="rounded border border-[#d7cabc] px-3 py-2 text-sm font-semibold" type="button" onClick={() => setAssetPreviewId("")}>閉じる</button></div>
                {previewAsset.mime_type?.startsWith("video/") ? <video className="max-h-[520px] w-full rounded bg-black" src={assetUrl(previewAsset.asset_id)} controls /> : null}
                {previewAsset.mime_type?.startsWith("image/") ? <img className="max-h-[520px] w-full rounded object-contain" src={assetUrl(previewAsset.asset_id)} alt={previewAsset.asset_id} /> : null}
                {previewAsset.mime_type?.startsWith("audio/") ? <audio className="w-full" src={assetUrl(previewAsset.asset_id)} controls /> : null}
                {!previewAsset.mime_type ? <a className="text-sm font-semibold text-[#596d51]" href={assetUrl(previewAsset.asset_id)} target="_blank" rel="noreferrer">素材を開く</a> : null}
              </div> : null}
              <div className="mt-4 grid gap-3 md:grid-cols-3">{assets.map((asset) => <article key={asset.asset_id} className={`rounded border bg-white p-3 ${backgroundAssetIds.includes(asset.asset_id) ? "border-[#596d51] ring-2 ring-[#596d51]/20" : "border-[#d7cabc]"}`}><p className="text-xs font-semibold text-[#6c5f3d]">{asset.category} / {asset.mood}</p><h3 className="mt-1 font-semibold leading-6">{asset.asset_id}</h3><p className="mt-1 text-xs leading-5 text-[#5e625c]">{asset.width}x{asset.height} / {asset.duration}s / 使用 {asset.usage_count}</p><p className="mt-1 text-xs leading-5 text-[#5e625c]">{asset.source} / {asset.mime_type || "-"} / {formatBytes(asset.size_bytes)}</p><p className="mt-1 break-words text-xs leading-5 text-[#5e625c]">{asset.storage_key}</p>{asset.checksum ? <p className="mt-1 break-words text-xs leading-5 text-[#5e625c]">sha256: {asset.checksum.slice(0, 16)}...</p> : null}<div className="mt-3 flex flex-wrap gap-2"><button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" type="button" onClick={() => setAssetPreviewId(asset.asset_id)}>プレビュー</button>{asset.source === "uploaded" ? <button className="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-700" type="button" onClick={() => deleteAsset(asset)}>削除</button> : null}</div></article>)}</div>
            </Panel>
            <Panel title="Render Jobs" eyebrow="Jobs"><div className="grid gap-2">{jobs.map((job) => <article key={job.job_id} className="rounded border border-[#d7cabc] bg-white p-3"><p className="text-xs font-semibold text-[#6c5f3d]">{job.status} / {job.provider}</p><h3 className="mt-1 font-semibold leading-6">{job.job_id}</h3>{job.error_message ? <p className="mt-1 text-sm leading-6 text-red-700">{job.error_message}</p> : null}</article>)}</div></Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><p className="text-xs font-semibold uppercase text-[#6c5f3d]">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <span className="rounded border border-[#d7cabc] bg-white px-3 py-2">{label} {value}</span>;
}
