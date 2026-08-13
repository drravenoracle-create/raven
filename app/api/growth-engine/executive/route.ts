import { env } from "cloudflare:workers";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const now = new Date();
  const periodType = String(body?.period_type ?? body?.periodType ?? "weekly");
  const periodEnd = String(body?.period_end ?? now.toISOString().slice(0, 10));
  const periodStart = String(body?.period_start ?? new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10));
  const [conversions, revenue, actions] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM growth_conversion_events WHERE tenant_id = ?").bind(GROWTH_ENGINE_TENANT_ID).first<{ count: number }>(),
    env.DB.prepare("SELECT SUM(revenue) AS total FROM growth_revenue_records WHERE tenant_id = ? AND revenue_kind = 'measured'").bind(GROWTH_ENGINE_TENANT_ID).first<{ total: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM growth_autonomous_actions WHERE tenant_id = ? AND requires_approval = 1 AND status = 'queued'").bind(GROWTH_ENGINE_TENANT_ID).first<{ count: number }>(),
  ]);
  const id = crypto.randomUUID();
  const facts = { conversions: conversions?.count || 0, measured_revenue: revenue?.total || 0, pending_approvals: actions?.count || 0 };
  const hypotheses = { note: "Data is limited until external CRM, booking, payment, LINE, and analytics providers are connected." };
  await env.DB.prepare(
    "INSERT INTO growth_executive_reports (id, tenant_id, period_type, period_start, period_end, facts_json, estimates_json, hypotheses_json, summary, key_decisions_json, pending_approvals_json, risk_alerts_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      GROWTH_ENGINE_TENANT_ID,
      periodType,
      periodStart,
      periodEnd,
      JSON.stringify(facts),
      JSON.stringify({}),
      JSON.stringify(hypotheses),
      `実測conversion ${facts.conversions}件、実測売上 ${facts.measured_revenue}、承認待ち ${facts.pending_approvals}件です。外部Provider未接続の数値は仮説として扱います。`,
      JSON.stringify(["high-risk actionは承認センターで確認"]),
      JSON.stringify([]),
      JSON.stringify([]),
    )
    .run();
  return Response.json({ ok: true, id, facts, hypotheses });
}
