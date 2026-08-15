"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Experiment = {
  experiment_id: string;
  experiment_code: string;
  title: string;
  hypothesis: string;
  change_summary?: string;
  character_id?: string;
  target_type?: string;
  target_id?: string;
  primary_kpi?: string;
  primary_metric?: string;
  primary_kpi_direction?: string;
  baseline_value?: number;
  target_value?: number;
  measured_value?: number;
  relative_change?: number;
  estimated_revenue_impact?: number;
  status: string;
  priority?: string;
  priority_score?: number;
  impact_score?: number;
  confidence_score?: number;
  ease_score?: number;
  owner?: string;
  approval_required?: number;
  approved_by?: string;
  result_status?: string;
  result_summary?: string;
  planned_start_at?: string;
  planned_end_at?: string;
  actual_start_at?: string;
  actual_end_at?: string;
  learning?: string;
  next_action?: string;
  sample_size?: number;
};

type Recommendation = {
  id: string;
  topic?: string;
  summary?: string;
  recommended_action?: string;
  confidence?: number;
  risk_level?: string;
  experiment_id?: string;
  experiment_code?: string;
};

type Detail = {
  experiment: Experiment;
  metrics: Record<string, unknown>[];
  events: Record<string, unknown>[];
  approvals: Record<string, unknown>[];
  audit: Record<string, unknown>[];
};

const emptyForm = {
  title: "",
  character_id: "raven",
  target_type: "CTA",
  target_id: "",
  hypothesis: "",
  change_summary: "",
  primary_kpi: "Paid Conversion Rate",
  primary_kpi_direction: "increase",
  guardrail_kpis: "Bounce Rate, Complaint Rate",
  baseline_value: "",
  target_value: "",
  planned_start_at: "",
  planned_end_at: "",
  impact_score: "60",
  confidence_score: "50",
  ease_score: "50",
  owner: "Raven運用",
};

export default function GrowthExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [detail, setDetail] = useState<Detail | null>(null);
  const [status, setStatus] = useState("読み込み中...");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ q: "", status: "", character_id: "", result_status: "" });
  const [resultForm, setResultForm] = useState({ result_status: "NOT_MEASURED", measured_value: "", result_summary: "", learning: "", next_action: "", estimated_revenue_impact: "", sample_size: "" });

  const selected = detail?.experiment || null;
  const filtered = useMemo(() => experiments, [experiments]);

  async function readJson(response: Response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`APIレスポンスを読めませんでした: ${response.status}`);
    }
  }

  async function loadAll() {
    setStatus("Experimentを読み込んでいます...");
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    try {
      const response = await fetch(`/api/growth-engine/experiments?${query.toString()}`, { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Experimentの読み込みに失敗しました。");
      setExperiments(payload.experiments || []);
      setRecommendations(payload.recommendations || []);
      setSummary(payload.summary || {});
      setStatus("Experimentを読み込みました。");
      if (!detail && payload.experiments?.[0]) await loadDetail(payload.experiments[0].experiment_id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Experimentの読み込みに失敗しました。");
    }
  }

  async function loadDetail(id: string) {
    try {
      const response = await fetch(`/api/growth-engine/experiments?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Experiment詳細の読み込みに失敗しました。");
      setDetail(payload.detail);
      const experiment = payload.detail.experiment;
      setResultForm({
        result_status: experiment.result_status || "NOT_MEASURED",
        measured_value: String(experiment.measured_value ?? ""),
        result_summary: experiment.result_summary || "",
        learning: experiment.learning || "",
        next_action: experiment.next_action || "",
        estimated_revenue_impact: String(experiment.estimated_revenue_impact ?? ""),
        sample_size: String(experiment.sample_size ?? ""),
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Experiment詳細の読み込みに失敗しました。");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setStatus("保存しています...");
    try {
      const response = await fetch("/api/growth-engine/experiments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: "raven-oracle", ...body }),
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "操作に失敗しました。");
      setStatus(successMessage);
      await loadAll();
      const id = payload.experiment?.experiment_id || payload.experiment?.experiment_code || selected?.experiment_id;
      if (id) await loadDetail(id);
      return payload;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "操作に失敗しました。");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createManual() {
    await post({
      action: "create",
      ...form,
      guardrail_kpis: form.guardrail_kpis.split(",").map((item) => item.trim()).filter(Boolean),
      baseline_value: form.baseline_value || undefined,
      target_value: form.target_value || undefined,
    }, "手動Experimentを作成しました。");
  }

  async function createFromRecommendation(item: Recommendation) {
    await post({
      action: "createFromRecommendation",
      recommendation_id: item.id,
      primary_kpi: "Paid Conversion Rate",
      target_type: "CONTENT",
      character_id: "raven",
    }, "Growth提案からExperiment候補を作成しました。");
  }

  async function runAction(action: string, reason = "") {
    if (!selected) return;
    if (["reject", "cancel", "archive"].includes(action) && !window.confirm(`${selected.experiment_code} を ${action} します。よろしいですか？`)) return;
    await post({ action, id: selected.experiment_id, reason }, `${selected.experiment_code} に ${action} を実行しました。`);
  }

  async function recordResult(action: "recordResult" | "complete") {
    if (!selected) return;
    await post({
      action,
      id: selected.experiment_id,
      ...resultForm,
      baseline_value: selected.baseline_value,
      source: "manual",
      calculation_method: "manual_pre_post_comparison",
      data_quality: "manual",
    }, action === "complete" ? "結果を保存し、Experimentを完了しました。" : "結果を保存しました。");
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-7xl">
        <nav className="flex flex-wrap justify-between gap-3">
          <Link className="text-sm font-semibold text-[#596d51]" href="/admin/growth/">Growth Engineへ戻る</Link>
          <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
        </nav>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Growth Engine / Experiment Manager v1.0</p>
          <h1 className="mt-2 text-4xl font-semibold">Experiment Manager</h1>
          <p className="mt-3 max-w-4xl leading-7 text-[#5e625c]">改善施策を、仮説、承認、実施、測定、判定、学習の単位で管理します。現段階はPre/Post Comparisonであり、A/B配信や自動勝者判定は行いません。</p>
        </header>

        <section className="sticky top-0 z-10 -mx-5 mt-5 border-y border-[#d7cabc] bg-[#f5f0e8]/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <Metric label="Active" value={summary.active || 0} />
              <Metric label="Waiting" value={summary.waiting || 0} />
              <Metric label="Completed" value={summary.completed || 0} />
              <Metric label="Win Rate" value={`${summary.win_rate || 0}%`} />
              <Metric label="推定Impact" value={Number(summary.estimated_revenue_impact || 0).toLocaleString("ja-JP")} />
            </div>
            <p className="text-sm font-semibold text-[#596d51]">{status}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[360px_1fr_420px]">
          <aside className="grid content-start gap-5">
            <Panel title="手動Experiment作成" eyebrow="Manual">
              <div className="grid gap-3">
                <Field label="タイトル" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
                <label className="grid gap-2 text-sm font-semibold">キャラクター<select className="admin-field" value={form.character_id} onChange={(event) => setForm({ ...form, character_id: event.target.value })}><option value="raven">Raven</option><option value="luna">Luna</option><option value="scarlet">Scarlet</option><option value="atlas">Atlas</option><option value="sol">Sol</option><option value="">Tenant全体</option></select></label>
                <label className="grid gap-2 text-sm font-semibold">対象<select className="admin-field" value={form.target_type} onChange={(event) => setForm({ ...form, target_type: event.target.value })}><option>PAGE</option><option>CTA</option><option>MENU</option><option>PRICE</option><option>FREE_TRIAL</option><option>CHARACTER</option><option>CONTENT</option><option>SEO</option><option>SNS</option><option>FUNNEL</option><option>MEMBERSHIP</option><option>OTHER</option></select></label>
                <Field label="対象ID/URL" value={form.target_id} onChange={(value) => setForm({ ...form, target_id: value })} />
                <TextField label="仮説" value={form.hypothesis} onChange={(value) => setForm({ ...form, hypothesis: value })} />
                <TextField label="変更内容" value={form.change_summary} onChange={(value) => setForm({ ...form, change_summary: value })} />
                <Field label="Primary KPI" value={form.primary_kpi} onChange={(value) => setForm({ ...form, primary_kpi: value })} />
                <Field label="Guardrail KPI（カンマ区切り）" value={form.guardrail_kpis} onChange={(value) => setForm({ ...form, guardrail_kpis: value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Baseline" value={form.baseline_value} onChange={(value) => setForm({ ...form, baseline_value: value })} />
                  <Field label="Target" value={form.target_value} onChange={(value) => setForm({ ...form, target_value: value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Impact" value={form.impact_score} onChange={(value) => setForm({ ...form, impact_score: value })} />
                  <Field label="Confidence" value={form.confidence_score} onChange={(value) => setForm({ ...form, confidence_score: value })} />
                  <Field label="Ease" value={form.ease_score} onChange={(value) => setForm({ ...form, ease_score: value })} />
                </div>
                <button className="rounded bg-[#222820] px-4 py-3 text-sm font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={createManual} disabled={busy || !form.hypothesis}>作成</button>
              </div>
            </Panel>

            <Panel title="Growth提案から登録" eyebrow="Recommendation">
              <div className="grid gap-2">
                {recommendations.map((item) => (
                  <article key={item.id} className="rounded border border-[#d7cabc] bg-white p-3">
                    <p className="text-xs font-semibold text-[#6c5f3d]">{item.risk_level || "risk未設定"} / confidence {item.confidence || 0}</p>
                    <h3 className="mt-1 font-semibold">{item.topic || "提案"}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#5e625c]">{item.recommended_action || item.summary}</p>
                    {item.experiment_id ? <p className="mt-2 text-xs font-semibold text-[#596d51]">登録済み: {item.experiment_code}</p> : <button className="mt-3 rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold disabled:opacity-60" type="button" onClick={() => createFromRecommendation(item)} disabled={busy}>Experiment候補化</button>}
                  </article>
                ))}
                {!recommendations.length ? <p className="text-sm text-[#5e625c]">候補化できるGrowth提案はまだありません。</p> : null}
              </div>
            </Panel>
          </aside>

          <section className="grid content-start gap-5">
            <Panel title="Experiment一覧" eyebrow="List">
              <div className="grid gap-3 md:grid-cols-4">
                <input className="admin-field" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="検索" />
                <select className="admin-field" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">全Status</option><option>DRAFT</option><option>PROPOSED</option><option>WAITING_APPROVAL</option><option>APPROVED</option><option>RUNNING</option><option>PAUSED</option><option>MEASURING</option><option>COMPLETED</option><option>REJECTED</option><option>CANCELLED</option><option>ARCHIVED</option></select>
                <select className="admin-field" value={filters.result_status} onChange={(event) => setFilters({ ...filters, result_status: event.target.value })}><option value="">全Result</option><option>WIN</option><option>LOSS</option><option>NEUTRAL</option><option>INCONCLUSIVE</option><option>NOT_MEASURED</option></select>
                <button className="rounded border border-[#d7cabc] px-4 py-2 text-sm font-semibold" type="button" onClick={loadAll}>絞り込み</button>
              </div>
              <div className="mt-4 grid gap-3">
                {filtered.map((item) => (
                  <button key={item.experiment_id} className={`rounded border bg-white p-4 text-left ${selected?.experiment_id === item.experiment_id ? "border-[#596d51] ring-2 ring-[#596d51]/20" : "border-[#d7cabc]"}`} type="button" onClick={() => loadDetail(item.experiment_id)}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[#6c5f3d]">{item.experiment_code} / {item.status} / {item.result_status || "NOT_MEASURED"}</p>
                        <h3 className="mt-1 text-lg font-semibold">{item.title || item.hypothesis}</h3>
                      </div>
                      <span className="rounded bg-[#222820] px-2 py-1 text-xs font-semibold text-[#fff8ed]">ICE {item.priority_score || 0}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#5e625c]">{item.hypothesis}</p>
                    <p className="mt-2 text-xs text-[#5e625c]">{item.character_id || "tenant"} / {item.target_type || "OTHER"} / {item.primary_kpi || item.primary_metric}</p>
                  </button>
                ))}
                {!filtered.length ? <p className="rounded border border-dashed border-[#d7cabc] bg-white/70 p-4 text-sm text-[#5e625c]">Experimentはまだありません。</p> : null}
              </div>
            </Panel>
          </section>

          <aside className="grid content-start gap-5">
            <Panel title="詳細" eyebrow="Detail">
              {selected ? (
                <div className="grid gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#6c5f3d]">{selected.experiment_code} / {selected.status}</p>
                    <h2 className="mt-1 text-2xl font-semibold">{selected.title || selected.hypothesis}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#5e625c]">{selected.hypothesis}</p>
                  </div>
                  <Info label="対象" value={`${selected.character_id || "tenant"} / ${selected.target_type || "OTHER"} / ${selected.target_id || "-"}`} />
                  <Info label="変更内容" value={selected.change_summary || "-"} />
                  <Info label="KPI" value={`${selected.primary_kpi || "-"} / ${selected.primary_kpi_direction || "increase"} / Baseline ${selected.baseline_value ?? "-"} / Measured ${selected.measured_value ?? "-"}`} />
                  <Info label="Result" value={`${selected.result_status || "NOT_MEASURED"} / 変化率 ${selected.relative_change ?? "-"}% / 推定Revenue Impact ${selected.estimated_revenue_impact ?? "-"}`} />
                  <Info label="Learning" value={`${selected.learning || "-"} / Next: ${selected.next_action || "-"}`} />
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" type="button" disabled={busy} onClick={() => runAction("approve")}>承認</button>
                    <button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" type="button" disabled={busy} onClick={() => runAction("reject")}>却下</button>
                    <button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" type="button" disabled={busy} onClick={() => runAction("start")}>開始</button>
                    <button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" type="button" disabled={busy} onClick={() => runAction("pause")}>停止</button>
                    <button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" type="button" disabled={busy} onClick={() => runAction("resume")}>再開</button>
                    <button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" type="button" disabled={busy} onClick={() => runAction("measure")}>測定へ</button>
                    <button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" type="button" disabled={busy} onClick={() => runAction("archive")}>保管</button>
                  </div>
                </div>
              ) : <p className="text-sm text-[#5e625c]">Experimentを選択してください。</p>}
            </Panel>

            {selected ? (
              <Panel title="結果登録" eyebrow="Result">
                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm font-semibold">Result<select className="admin-field" value={resultForm.result_status} onChange={(event) => setResultForm({ ...resultForm, result_status: event.target.value })}><option>WIN</option><option>LOSS</option><option>NEUTRAL</option><option>INCONCLUSIVE</option><option>NOT_MEASURED</option></select></label>
                  <Field label="測定値" value={String(resultForm.measured_value)} onChange={(value) => setResultForm({ ...resultForm, measured_value: value })} />
                  <Field label="Sample Size" value={String(resultForm.sample_size)} onChange={(value) => setResultForm({ ...resultForm, sample_size: value })} />
                  <Field label="推定Revenue Impact" value={String(resultForm.estimated_revenue_impact)} onChange={(value) => setResultForm({ ...resultForm, estimated_revenue_impact: value })} />
                  <TextField label="結果要約" value={resultForm.result_summary} onChange={(value) => setResultForm({ ...resultForm, result_summary: value })} />
                  <TextField label="学び" value={resultForm.learning} onChange={(value) => setResultForm({ ...resultForm, learning: value })} />
                  <TextField label="次アクション" value={resultForm.next_action} onChange={(value) => setResultForm({ ...resultForm, next_action: value })} />
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded border border-[#d7cabc] px-4 py-2 text-sm font-semibold disabled:opacity-60" type="button" disabled={busy} onClick={() => recordResult("recordResult")}>結果だけ保存</button>
                    <button className="rounded bg-[#222820] px-4 py-2 text-sm font-semibold text-[#fff8ed] disabled:opacity-60" type="button" disabled={busy} onClick={() => recordResult("complete")}>保存して完了</button>
                  </div>
                </div>
              </Panel>
            ) : null}

            {detail ? (
              <Panel title="Timeline / Audit" eyebrow="Audit">
                <div className="grid gap-2">
                  {detail.events.slice(0, 8).map((item, index) => <Info key={index} label={String(item.event_type || item.action || "event")} value={`${item.from_status || "-"} -> ${item.to_status || "-"} / ${item.actor || "system"} / ${item.created_at || ""}`} />)}
                  {!detail.events.length ? <p className="text-sm text-[#5e625c]">履歴はまだありません。</p> : null}
                </div>
              </Panel>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5 shadow-sm"><p className="text-sm font-semibold uppercase text-[#6c5f3d]">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <span className="rounded border border-[#d7cabc] bg-white px-3 py-2">{label}: {value}</span>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}<input className="admin-field" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}<textarea className="admin-field min-h-24" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-[#d7cabc] bg-white p-3"><p className="text-xs font-semibold uppercase text-[#6c5f3d]">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#5e625c]">{value}</p></div>;
}
