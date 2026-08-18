"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Template = { id: string; name: string; slug: string; category: string; format_type: string; status: string; version: number; duration_seconds: number; aspect_ratio: string; description?: string };
const tenantId = "raven-oracle";

export default function SnsTemplateManagerPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [result, setResult] = useState<unknown>(null);
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
    const response = await fetch(`/api/sns/templates/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, action: actionName, content: { title: "サンプル投稿", hook: "テーマを選んでください", cta: "詳しい鑑定はプロフィールへ" } }) });
    const payload = await response.json().catch(() => ({})); setResult(payload);
    setStatus(response.ok ? `${actionName === "render" ? "Render Plan" : actionName === "duplicate" ? "複製" : "プレビュー"}を作成しました。` : (payload.error || "操作に失敗しました。"));
    if (actionName === "duplicate" && response.ok) await load();
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
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><Link href="/admin/sns" className="text-[#66e3dc]">SNS管理へ戻る</Link><h1 className="mt-3 text-3xl font-semibold">投稿フォーマット・テンプレート</h1><p className="mt-2 text-[#bfc8c4]">既存テンプレートを維持したまま、複製・プレビュー・版管理を行います。</p></div><Link href="/admin" className="rounded border border-[#5f7775] px-3 py-2">管理トップ</Link></div>
    <p className="mb-5 rounded border border-[#3d5856] px-4 py-3 text-sm text-[#bfc8c4]">{status}</p>
    <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]"><div className="space-y-3">{templates.map((template) => <article key={template.id} className={`rounded border p-4 ${selected?.id === template.id ? "border-[#66e3dc]" : "border-[#405b59]"}`}><button className="w-full text-left" onClick={() => setSelected(template)}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{template.name}</h2><p className="mt-1 text-sm text-[#bfc8c4]">{template.category} / {template.format_type} / v{template.version}</p></div><span className="text-sm text-[#66e3dc]">{template.status}</span></div><p className="mt-3 text-sm text-[#d3d8d2]">{template.description || "説明なし"}</p></button><div className="mt-4 flex flex-wrap gap-2"><button className="rounded border border-[#5f7775] px-3 py-1 text-sm" onClick={() => action(template.id, "preview")}>プレビュー</button><button className="rounded border border-[#5f7775] px-3 py-1 text-sm" onClick={() => action(template.id, "render")}>Render Plan</button><button className="rounded border border-[#5f7775] px-3 py-1 text-sm" onClick={() => action(template.id, "duplicate")}>複製</button><button className="rounded border border-[#9b625f] px-3 py-1 text-sm" onClick={() => archive(template.id)}>アーカイブ</button></div></article>)}</div>
      <div className="space-y-6"><form onSubmit={createTemplate} className="rounded border border-[#405b59] p-5"><h2 className="text-xl font-semibold">カスタムテンプレートを追加</h2>{([ ["name", "名前"], ["slug", "識別子"], ["category", "カテゴリ"], ["description", "説明"] ] as const).map(([key, label]) => <label key={key} className="admin-field mt-4 block"><span>{label}</span><input required={key === "name" || key === "slug"} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}<button className="mt-5 rounded bg-[#66e3dc] px-4 py-2 font-semibold text-[#172120]">追加</button></form>{selected && <section className="rounded border border-[#405b59] p-5"><h2 className="text-xl font-semibold">選択中のテンプレート</h2><pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs text-[#bfc8c4]">{JSON.stringify(selected, null, 2)}</pre></section>}{result && <section className="rounded border border-[#405b59] p-5"><h2 className="text-xl font-semibold">プレビュー / Render Plan</h2><p className="mt-2 text-sm text-[#bfc8c4]">構成確認用のJSONです。実MP4化はVideo Renderer接続後に実行されます。</p><pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs text-[#bfc8c4]">{JSON.stringify(result, null, 2)}</pre></section>}</div>
    </section></main>;
}
