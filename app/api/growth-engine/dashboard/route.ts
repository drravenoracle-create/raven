import { env } from "cloudflare:workers";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";
import { experimentSummary } from "@/app/lib/growth-experiment-manager";

async function safeAll<T>(query: Promise<{ results?: T[] }>, fallback: T[] = []) {
  try {
    const result = await query;
    return result.results || fallback;
  } catch {
    return fallback;
  }
}

async function safeFirst<T>(query: Promise<T | null>, fallback: T | null = null) {
  try {
    return await query;
  } catch {
    return fallback;
  }
}

export async function GET() {
  const [settings, connectors, metrics, conversions, insights, calendar, segments, experiments, experimentStats, costs, customers, revenue, actions, reports] = await Promise.all([
    safeFirst(env.DB.prepare("SELECT * FROM growth_engine_settings WHERE tenant_id = ? LIMIT 1").bind(GROWTH_ENGINE_TENANT_ID).first()),
    safeAll(env.DB.prepare("SELECT source, provider, enabled, sync_status, last_success_at, last_error FROM growth_data_connectors WHERE tenant_id = ? ORDER BY source").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeAll(env.DB.prepare("SELECT source, entity_type, metric_name, metric_value, data_quality, measured_at FROM growth_metric_points WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeAll(env.DB.prepare("SELECT event_name, goal_name, goal_value, attribution_type, occurred_at FROM growth_conversion_events WHERE tenant_id = ? ORDER BY datetime(occurred_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeAll(env.DB.prepare("SELECT insight_type, topic, summary, recommended_action, sample_size, confidence, guard_status, status FROM growth_content_insights WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeAll(env.DB.prepare("SELECT channel, content_type, topic, scheduled_at, status, guard_status FROM growth_calendar_items WHERE tenant_id = ? ORDER BY datetime(scheduled_at) ASC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeAll(env.DB.prepare("SELECT segment_key, label, basis, estimated, sensitive_attribute_used, confidence FROM growth_audience_segments WHERE tenant_id = ? ORDER BY label").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeAll(env.DB.prepare("SELECT experiment_id, experiment_code, title, hypothesis, primary_kpi, primary_metric, sample_size, confidence_score, priority_score, winner, status, result_status, estimated_revenue_impact FROM growth_experiments WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeFirst(experimentSummary(env.DB, GROWTH_ENGINE_TENANT_ID), { active: 0, waiting: 0, completed: 0, wins: 0, losses: 0, estimated_revenue_impact: 0, win_rate: 0 }),
    safeAll(env.DB.prepare("SELECT provider, action, units, estimated_cost, occurred_at FROM growth_cost_usage WHERE tenant_id = ? ORDER BY datetime(occurred_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeAll(env.DB.prepare("SELECT customer_key, journey_stage, consent_status, opt_out, total_orders, total_revenue, lifetime_value, updated_at FROM growth_customer_profiles WHERE tenant_id = ? ORDER BY datetime(updated_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeAll(env.DB.prepare("SELECT service_key, revenue, gross_margin, attribution_type, revenue_kind, occurred_at FROM growth_revenue_records WHERE tenant_id = ? ORDER BY datetime(occurred_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeAll(env.DB.prepare("SELECT id, action_type, channel, risk_level, requires_approval, guard_result, status, created_at FROM growth_autonomous_actions WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all()),
    safeAll(env.DB.prepare("SELECT period_type, period_start, period_end, summary, status, created_at FROM growth_executive_reports WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 10").bind(GROWTH_ENGINE_TENANT_ID).all()),
  ]);

  return Response.json(
    {
      settings,
      connectors,
      metrics,
      conversions,
      insights,
      calendar,
      segments,
      experiments,
      experimentSummary: experimentStats,
      costs,
      customers,
      revenue,
      actions,
      reports,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
