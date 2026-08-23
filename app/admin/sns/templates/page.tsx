"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RAVEN_TENANT_CONFIG } from "@/app/lib/tenant-config";

type Template = { id: string; name: string; slug: string; format_key?: string; category: string; format_type: string; status: string; enabled?: number; is_system_preset?: number; version: number; duration_seconds: number; supported_platforms?: string; supported_characters?: string; description?: string };
const tenantId = RAVEN_TENANT_CONFIG.id;

const actionDescriptions: Record<string, string> = {
  preview: "企画の構成と入力データを確認します。",
  render: "秒数・シーン・対応媒体を確認します。MP4はまだ作成しません。",
  create_post: "このテンプレートを使ったSNS下書きを作成します。",
  duplicate: "元のプリセットを残したまま、複製版を作成します。",
  toggle: "投稿作成画面で使う・使わないを切り替えます。",
};

export default function SnsTemplateManagerPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState("読み込み中...");
  const [form, setForm] = useState({ name: "", slug: "", category: "custom", description: "" });

  async function load() {
    const response = await fetch(`/api/sns/templates?tenantId=${tenantId}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setStatus(payload.error || "テンプレートを取得できませんでした。"); return; }
    setTemplates(payload.templates || []); setStatus(`${(payload.templates || []).length}件のテンプレートを読み込みました。`);
  }
  useEffect(() => { load().catch(() => setStatus("テンプレートを取得できませんでした。")); }, []);

  async function action(id: string, actionName: string) {
    try {
      const response = await fetch(`/api/sns/templates/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, action: actionName, content: { title: "サンプル投稿", hook: "テーマを選んでください", cta: "詳しい鑑定はプロフィールへ", platform: "instagram" } }) });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>; setResult(payload);
      setStatus(response.ok ? `${actionName === "render" ? "動画構成" : actionName === "duplicate" ? "複製" : actionName === "create_post" ? "SNS下書き" : actionName === "toggle" ? "有効状態" : "プレビュー"}を更新しました。` : String(payload.error || "操作に失敗しました。"));
      if ((actionName === "duplicate" || actionName === "toggle") && response.ok) await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "操作に失敗しました。ネットワーク接続を確認してください。");
    }
  }
  async function toggle(template: Template) {
    await action(template.id, "toggle");
    await load();
  }
  async function createTemplate(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/sns/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenant_id: tenantId, ...form, format_type: "image", duration_seconds: 20, aspect_ratio: "9:16", supported_platforms: JSON.stringify(["instagram", "tiktok", "youtube-shorts"]), supported_characters: "[\"raven\"]", tags: "[\"custom\"]", scene_schema: JSON.stringify({ scenes: [] }), content_schema: "{}" }) });
    const payload = await response.json().catch(() => ({})); setStatus(response.ok ? "テンプレートを作成しました。" : (payload.error || "作成に失敗しました。"));
    if (response.ok) { setForm({ name: "", slug: "", category: "custom", description: "" }); await load(); }
  }
  async function archive(id: string) {
    const response = await fetch(`/api/sns/templates/${id}?tenantId=${tenantId}`, { method: "DELETE" });
    setStatus(response.ok ? "テンプレートをアーカイブしました。" : "アーカイブに失敗しました。"); if (response.ok) { setSelected(null); await load(); }
  }
  return <main className="mx-auto max-w-6xl px-5 py-8 text-[#f5f1e8]">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><Link href="/admin/sns" className="text-[#66e3dc]">SNS管理へ戻る</Link><h1 className="mt-3 text-3xl font-semibold">投稿フォーマット・テンプレート</h1><p className="mt-2 text-[#bfc8c4]">既存テンプレートを維持したまま、複製・プレビュー・版管理を行います。</p></div><div className="flex gap-2"><a href="/api/admin/drive/oauth/start?return_to=/admin/sns/templates" className="rounded border border-[#66e3dc] px-3 py-2">Google Driveを接続</a><Link href="/admin" className="rounded border border-[#5f7775] px-3 py-2">管理トップ</Link></div></div>
    <p className="mb-5 rounded border border-[#3d5856] px-4 py-3 text-sm text-[#bfc8c4]" role="status">{status}</p>
    <section className="mb-6 rounded border border-[#66e3dc]/50 bg-[#20302f] p-5">
      <h2 className="text-xl font-semibold text-[#f5f1e8]">テンプレートの使い方</h2>
      <ol className="mt-3 grid gap-3 text-sm leading-6 text-[#d3d8d2] md:grid-cols-4">
        <li><strong className="block text-[#66e3dc]">1. 企画を選ぶ</strong>一覧から使いたい投稿フォーマットを選択します。</li>
        <li><strong className="block text-[#66e3dc]">2. 構成を確認する</strong>「プレビュー」または「動画構成を確認」で内容と秒数を確認します。</li>
        <li><strong className="block text-[#66e3dc]">3. 下書きを作る</strong>問題がなければ「SNS下書きを作成」を押します。</li>
        <li><strong className="block text-[#66e3dc]">4. 投稿を整える</strong><Link className="underline underline-offset-4" href="/admin/sns">SNS管理</Link>で素材・本文・予約日時を確認します。</li>
      </ol>
      <p className="mt-4 text-xs leading-5 text-[#bfc8c4]">この画面は企画と構成を作る場所です。ボタンを押しても自動公開はされません。</p>
    </section>
    <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]"><div className="space-y-3">{templates.map((template) => <article key={template.id} className={`rounded border p-4 ${selected?.id === template.id ? "border-[#66e3dc]" : "border-[#405b59]"}`}><button type="button" className="w-full text-left" onClick={() => setSelected(template)}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{template.name}</h2><p className="mt-1 text-sm text-[#bfc8c4]">{template.category} / {template.format_key || template.format_type} / {template.duration_seconds}秒 / v{template.version}</p></div><span className="text-sm text-[#66e3dc]">{template.enabled === 0 ? "無効" : template.status}</span></div><p className="mt-3 text-sm text-[#d3d8d2]">{template.description || "説明なし"}</p></button><div className="mt-4 flex flex-wrap gap-2"><button title={actionDescriptions.preview} aria-label={`${template.name}: プレビュー。${actionDescriptions.preview}`} type="button" className="rounded border border-[#5f7775] px-3 py-1 text-sm" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void action(template.id, "preview"); }}>プレビュー</button><button title={actionDescriptions.render} aria-label={`${template.name}: 動画構成を確認。${actionDescriptions.render}`} type="button" className="rounded border border-[#5f7775] px-3 py-1 text-sm" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void action(template.id, "render"); }}>動画構成を確認</button><button title={actionDescriptions.create_post} aria-label={`${template.name}: SNS下書きを作成。${actionDescriptions.create_post}`} type="button" className="rounded border border-[#66e3dc] px-3 py-1 text-sm" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void action(template.id, "create_post"); }}>SNS下書きを作成</button><button title={actionDescriptions.duplicate} aria-label={`${template.name}: 複製。${actionDescriptions.duplicate}`} type="button" className="rounded border border-[#5f7775] px-3 py-1 text-sm" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void action(template.id, "duplicate"); }}>複製</button><button title={actionDescriptions.toggle} aria-label={`${template.name}: ${template.enabled === 0 ? "有効化" : "無効化"}`} type="button" className="rounded border border-[#5f7775] px-3 py-1 text-sm" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void toggle(template); }}>{template.enabled === 0 ? "有効化" : "無効化"}</button><button type="button" className="rounded border border-[#9b625f] px-3 py-1 text-sm" onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (window.confirm("このテンプレートをアーカイブしますか？")) void archive(template.id); }}>アーカイブ</button></div><p className="mt-3 text-xs leading-5 text-[#92aaa5]">{actionDescriptions.preview} 下書き作成後はSNS管理画面で投稿内容を整えます。</p></article>)}</div>
      <div className="space-y-6"><form onSubmit={createTemplate} className="rounded border border-[#405b59] p-5"><h2 className="text-xl font-semibold">カスタムテンプレートを追加</h2><p className="mt-2 text-sm leading-6 text-[#bfc8c4]">新しい企画の名前・識別子・用途を登録します。登録後は一覧からプレビューやSNS下書き作成を行えます。</p>{([ ["name", "名前"], ["slug", "識別子"], ["category", "カテゴリ"], ["description", "説明"] ] as const).map(([key, label]) => <label key={key} className="admin-field mt-4 block"><span>{label}</span><input required={key === "name" || key === "slug"} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}<button className="mt-5 rounded bg-[#66e3dc] px-4 py-2 font-semibold text-[#172120]">追加</button></form>{selected && <section className="rounded border border-[#405b59] p-5"><h2 className="text-xl font-semibold">選択中のテンプレート</h2><p className="mt-2 text-sm leading-6 text-[#bfc8c4]">この企画を使う場合は、上の「プレビュー」で構成を確認し、問題がなければ「SNS下書きを作成」を押してください。</p><pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs text-[#bfc8c4]">{JSON.stringify(selected, null, 2)}</pre></section>}{result && <section className="rounded border border-[#405b59] p-5"><h2 className="text-xl font-semibold">実行結果</h2><p className="mt-2 text-sm leading-6 text-[#bfc8c4]">プレビューは構成JSON、動画構成は秒数とシーンの確認結果です。SNS下書き作成後はSNS管理画面で本文・素材・予約日時を設定します。</p><pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs text-[#bfc8c4]">{JSON.stringify(result, null, 2)}</pre></section>}</div>
    </section></main>;
}
