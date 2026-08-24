"use client";

import { useState } from "react";

type Proposal = {
  proposal_id: string;
  title: string;
  summary: string;
  rationale: string;
  observation?: string | null;
  hypothesis?: string | null;
  expected_outcome?: string | null;
  target_metric?: string | null;
  confidence: number;
  risk_class: string;
  evidence_ids_json: string;
  missing_evidence_json: string;
  market?: string | null;
  locale?: string | null;
  status: string;
  execution_allowed: number;
  created_at?: string;
  reviewed_by?: string | null;
  review_note?: string | null;
  experiment_id?: string | null;
  experiment_code?: string | null;
  experiment_status?: string | null;
  requires_start_approval?: number | null;
};

function list(value: string) { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

export default function ProposalReviewPanel({ initial }: { initial: Proposal[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState("");
  const review = async (proposalId: string, action: "approve" | "reject" | "defer") => {
    const proposal = items.find((item) => item.proposal_id === proposalId);
    if (!proposal || !window.confirm(`${proposal.title} を ${action} します。実行は発生しません。よろしいですか？`)) return;
    setBusy(proposalId);
    try {
      const response = await fetch("/api/growth-engine/proposals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposal_id: proposalId, tenant_id: "raven-oracle", action, review_note: `Admin review: ${action}` }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Review failed");
      setItems((current) => current.map((item) => item.proposal_id === proposalId ? { ...item, status: body.proposal.status, reviewed_at: body.proposal.reviewedAt, reviewed_by: body.proposal.reviewedBy, review_note: body.proposal.reviewNote } : item));
    } catch (error) { window.alert(error instanceof Error ? error.message : "Review failed"); }
    finally { setBusy(""); }
  };
  const createDraft = async (proposalId: string) => {
    const proposal = items.find((item) => item.proposal_id === proposalId);
    if (!proposal || !window.confirm(`${proposal.title} からExperiment draftを作成します。Experimentは開始されません。よろしいですか？`)) return;
    setBusy(proposalId);
    try {
      const response = await fetch("/api/growth-engine/proposals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposal_id: proposalId, tenant_id: "raven-oracle", action: "createExperimentDraft" }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Draft creation failed");
      const experiment = body.result?.experiment || {}; setItems((current) => current.map((item) => item.proposal_id === proposalId ? { ...item, experiment_id: experiment.experiment_id, experiment_code: experiment.experiment_code, experiment_status: experiment.status, requires_start_approval: 1 } : item));
    } catch (error) { window.alert(error instanceof Error ? error.message : "Draft creation failed"); }
    finally { setBusy(""); }
  };
  return <Panel title="Proposal Review / Human Decision">
    {items.map((item) => {
      const evidence = list(item.evidence_ids_json); const missing = list(item.missing_evidence_json); const locked = item.execution_allowed === 0;
      return <article key={item.proposal_id} className="rounded border border-[#d7cabc] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase text-[#6c5f3d]">{item.status} / {item.risk_class}</span><span className="text-xs text-[#5e625c]">confidence {item.confidence} / evidence {evidence.length}</span>{locked ? <span className="text-xs font-semibold text-[#596d51]">execution locked</span> : null}</div>
        <h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#5e625c]">{item.summary}</p><p className="mt-2 text-sm leading-6 text-[#5e625c]">Rationale: {item.rationale}</p>
        {item.hypothesis ? <p className="mt-2 text-xs leading-5 text-[#5e625c]">Hypothesis: {item.hypothesis}</p> : null}
        <p className="mt-2 text-xs text-[#5e625c]">Evidence IDs: {evidence.join(", ") || "なし"}</p>
        <p className="mt-2 text-xs text-[#5e625c]">{item.target_metric || "metric未設定"} / {item.expected_outcome || "expected outcome未設定"} / {item.market || "market未設定"} / {item.locale || "locale未設定"}</p>
        {item.experiment_id ? <p className="mt-2 text-xs font-semibold text-[#596d51]">Experiment: {item.experiment_code || item.experiment_id} / {item.experiment_status || "DRAFT"} / start approval required</p> : null}
        {missing.length ? <p className="mt-2 text-xs text-[#8a4f38]">Missing Evidence: {missing.join(", ")}</p> : null}
        {item.status === "review_required" ? <div className="mt-3 flex gap-2"><button className="rounded border border-[#596d51] px-3 py-2 text-xs font-semibold" disabled={busy === item.proposal_id} onClick={() => review(item.proposal_id, "approve")}>Approve</button><button className="rounded border border-[#8a4f38] px-3 py-2 text-xs font-semibold" disabled={busy === item.proposal_id} onClick={() => review(item.proposal_id, "reject")}>Reject</button><button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" disabled={busy === item.proposal_id} onClick={() => review(item.proposal_id, "defer")}>Defer</button></div> : null}
        {item.status === "approved" && !item.experiment_id ? <button className="mt-3 w-fit rounded border border-[#596d51] px-3 py-2 text-xs font-semibold" disabled={busy === item.proposal_id} onClick={() => createDraft(item.proposal_id)}>Create Experiment Draft</button> : null}
        {item.reviewed_by ? <p className="mt-2 text-xs text-[#5e625c]">reviewed by {item.reviewed_by}: {item.review_note || ""}</p> : null}
      </article>;
    })}
    {!items.length ? <Empty text="Proposalはまだありません。" /> : null}
  </Panel>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><h2 className="text-2xl font-semibold">{title}</h2><div className="mt-4 grid gap-3">{children}</div></section>; }
function Empty({ text }: { text: string }) { return <p className="text-sm text-[#5e625c]">{text}</p>; }
