import { env } from "cloudflare:workers";
import { GROWTH_ENGINE_TENANT_ID, evaluateAutonomousAction } from "@/app/lib/growth-engine";

function clean(value: unknown, maxLength = 240) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });
  const stop = await env.DB.prepare("SELECT enabled FROM growth_kill_switches WHERE tenant_id = ? AND scope_type = 'tenant' AND scope_id = '*' LIMIT 1")
    .bind(tenantId)
    .first<{ enabled: number }>();
  const riskLevel = clean(body.risk_level ?? body.riskLevel, 40).toUpperCase() || "LOW";
  const guard = evaluateAutonomousAction({
    riskLevel,
    costEstimate: Number(body.cost_estimate ?? body.costEstimate ?? 0),
    emergencyStopped: Boolean(stop?.enabled),
    optOut: Boolean(body.opt_out ?? body.optOut),
    externalAction: Boolean(body.external_action ?? body.externalAction),
  });
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO growth_autonomous_actions
      (id, tenant_id, source_agent, action_type, channel, payload_json, reason, expected_impact, risk_level, cost_estimate,
       requires_approval, guard_result, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      tenantId,
      clean(body.source_agent ?? body.sourceAgent, 80) || "growth_planner",
      clean(body.action_type ?? body.actionType, 120),
      clean(body.channel, 80) || null,
      JSON.stringify(body.payload || {}),
      clean(body.reason, 1000),
      clean(body.expected_impact ?? body.expectedImpact, 1000),
      riskLevel,
      Number(body.cost_estimate ?? body.costEstimate ?? 0),
      guard.requiresApproval ? 1 : 0,
      guard.result,
      guard.result === "allow" ? "approved" : guard.result === "deny" ? "blocked" : "queued",
    )
    .run();
  await env.DB.prepare("INSERT INTO growth_guardrail_results (id, tenant_id, subject_type, subject_id, result, reasons_json, policy_snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), tenantId, "autonomous_action", id, guard.result, JSON.stringify([guard.reason]), JSON.stringify({ risk_level: riskLevel }))
    .run();
  return Response.json({ ok: true, id, guard });
}
