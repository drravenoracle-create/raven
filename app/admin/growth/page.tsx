import Link from "next/link";

type Connector = { source: string; provider: string; enabled: number; sync_status: string; last_success_at?: string; last_error?: string };
type Conversion = { event_name: string; goal_name?: string; goal_value?: number; attribution_type: string; occurred_at?: string };
type Insight = { insight_type: string; topic?: string; summary: string; recommended_action: string; guard_status: string; status: string };
type Segment = { segment_key: string; label: string; basis: string; estimated: number; sensitive_attribute_used: number; confidence: number };
type Experiment = { experiment_id: string; hypothesis: string; primary_metric: string; sample_size: number; confidence: number; status: string };
type Customer = { customer_key: string; journey_stage: string; consent_status: string; opt_out: number; total_revenue: number; lifetime_value: number };
type Revenue = { service_key?: string; revenue: number; attribution_type: string; revenue_kind: string; occurred_at?: string };
type Action = { id: string; action_type: string; channel?: string; risk_level: string; requires_approval: number; guard_result: string; status: string };
type Report = { period_type: string; period_start: string; period_end: string; summary: string; status: string };
type CalendarItem = { channel?: string; content_type?: string; topic?: string; scheduled_at?: string; status?: string; guard_status?: string };

async function loadDashboard() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/growth-engine/dashboard`, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) {
    return { connectors: [], conversions: [], insights: [], calendar: [], segments: [], experiments: [], customers: [], revenue: [], actions: [], reports: [] };
  }
  return response.json();
}

export const metadata = { title: "Growth Engine | Raven Blackwood" };

export default async function GrowthAdminPage() {
  const dashboard = await loadDashboard();
  const connectors = (dashboard.connectors || []) as Connector[];
  const conversions = (dashboard.conversions || []) as Conversion[];
  const insights = (dashboard.insights || []) as Insight[];
  const segments = (dashboard.segments || []) as Segment[];
  const experiments = (dashboard.experiments || []) as Experiment[];
  const customers = (dashboard.customers || []) as Customer[];
  const revenue = (dashboard.revenue || []) as Revenue[];
  const actions = (dashboard.actions || []) as Action[];
  const reports = (dashboard.reports || []) as Report[];
  const calendar = (dashboard.calendar || []) as CalendarItem[];
  const approvalCount = actions.filter((item) => item.requires_approval && item.status === "queued").length;
  const measuredRevenue = revenue.filter((item) => item.revenue_kind === "measured").reduce((sum, item) => sum + Number(item.revenue || 0), 0);

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-7xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Raven Oracle Growth Engine v3.0</p>
          <h1 className="mt-2 text-4xl font-semibold">Growth Engine</h1>
          <p className="mt-3 max-w-3xl leading-7 text-[#5e625c]">検索、SNS、CTA、顧客ジャーニー、売上、LTV、承認待ちActionを確認します。外部Provider未接続の値は実測として扱いません。</p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Summary title="Connector" value={`${connectors.filter((item) => item.enabled).length}/${connectors.length}`} note="有効なデータソース" />
          <Summary title="Conversion" value={`${conversions.length}`} note="直近イベント" />
          <Summary title="Measured Revenue" value={measuredRevenue.toLocaleString("ja-JP")} note="実測売上" />
          <Summary title="Approval" value={`${approvalCount}`} note="承認待ちAction" />
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <Panel title="Executive Brief">
            {reports.map((item, index) => <Row key={`${item.period_type}-${index}`} title={`${item.period_type}: ${item.period_start} - ${item.period_end}`} meta={item.status} body={item.summary} />)}
            {!reports.length ? <Empty text="Executive Reportはまだありません。" /> : null}
          </Panel>

          <Panel title="Next Calendar">
            {calendar.map((item, index) => <Row key={`${item.topic}-${index}`} title={item.topic || "予定タイトル未設定"} meta={`${item.channel || "channel未設定"} / ${item.status || "status未設定"} / ${item.guard_status || "guard未評価"}`} body={`${item.content_type || "content未設定"} / ${item.scheduled_at || "日時未設定"}`} />)}
            {!calendar.length ? <Empty text="投稿・改善カレンダーはまだありません。" /> : null}
          </Panel>

          <Panel title="Approval Center / Autonomous Actions">
            {actions.map((item) => <Row key={item.id} title={item.action_type} meta={`${item.risk_level} / ${item.guard_result} / ${item.status}`} body={`${item.channel || "channel未設定"} / approval ${item.requires_approval ? "required" : "not required"}`} />)}
            {!actions.length ? <Empty text="Autonomous Actionはまだありません。" /> : null}
          </Panel>

          <Panel title="Content Intelligence">
            {insights.map((item, index) => <Row key={`${item.insight_type}-${index}`} title={item.topic || item.insight_type} meta={`${item.guard_status} / ${item.status}`} body={`${item.summary} ${item.recommended_action}`} />)}
            {!insights.length ? <Empty text="改善候補はまだありません。" /> : null}
          </Panel>

          <Panel title="Data Connector Status">
            {connectors.map((item) => <Row key={`${item.source}-${item.provider}`} title={`${item.source} / ${item.provider}`} meta={item.sync_status || "未同期"} body={item.last_error || item.last_success_at || "未同期"} />)}
            {!connectors.length ? <Empty text="Connector設定はまだありません。" /> : null}
          </Panel>

          <Panel title="Conversion Funnel">
            {conversions.map((item, index) => <Row key={`${item.event_name}-${index}`} title={item.event_name} meta={item.attribution_type} body={`${item.goal_name || "goal未設定"} / ${item.goal_value || 0} / ${item.occurred_at || ""}`} />)}
            {!conversions.length ? <Empty text="conversion eventはまだありません。" /> : null}
          </Panel>

          <Panel title="Customer Journey / CRM">
            {customers.map((item) => <Row key={item.customer_key} title={item.customer_key} meta={`${item.journey_stage} / consent ${item.consent_status}`} body={`opt-out ${item.opt_out ? "yes" : "no"} / revenue ${item.total_revenue || 0} / LTV ${item.lifetime_value || 0}`} />)}
            {!customers.length ? <Empty text="Customer Journeyはまだありません。" /> : null}
          </Panel>

          <Panel title="Audience / Experiment">
            {segments.map((item) => <Row key={item.segment_key} title={item.label} meta={item.basis} body={`推定 ${item.estimated ? "yes" : "no"} / sensitive ${item.sensitive_attribute_used ? "yes" : "no"} / confidence ${item.confidence}`} />)}
            {experiments.map((item) => <Row key={item.experiment_id} title={item.hypothesis} meta={item.status} body={`${item.primary_metric} / sample ${item.sample_size} / confidence ${item.confidence}`} />)}
            {!segments.length && !experiments.length ? <Empty text="Audience/Experimentデータはまだありません。" /> : null}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Summary({ title, value, note }: { title: string; value: string; note: string }) {
  return <div className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><p className="text-sm font-semibold uppercase text-[#6c5f3d]">{title}</p><p className="mt-2 text-3xl font-semibold">{value}</p><p className="mt-2 text-sm text-[#5e625c]">{note}</p></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><h2 className="text-2xl font-semibold">{title}</h2><div className="mt-4 grid gap-3">{children}</div></section>;
}

function Row({ title, meta, body }: { title: string; meta: string; body: string }) {
  return <article className="rounded border border-[#d7cabc] bg-white p-4"><p className="text-xs font-semibold uppercase text-[#6c5f3d]">{meta}</p><h3 className="mt-1 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#5e625c]">{body}</p></article>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-[#5e625c]">{text}</p>;
}
