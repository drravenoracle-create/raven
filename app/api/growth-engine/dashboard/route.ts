import { env } from "cloudflare:workers";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";

export async function GET() {
  const [settings, connectors, metrics, conversions, insights, calendar, segments, experiments, costs, customers, revenue, actions, reports] = await Promise.all([
    env.DB.prepare("SELECT * FROM growth_engine_settings WHERE tenant_id = ? LIMIT 1").bind(GROWTH_ENGINE_TENANT_ID).first(),
    env.DB.prepare("SELECT source, provider, enabled, sync_status, last_success_at, last_error FROM growth_data_connectors WHERE tenant_id = ? ORDER BY source").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT source, entity_type, metric_name, metric_value, data_quality, measured_at FROM growth_metric_points WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT event_name, goal_name, goal_value, attribution_type, occurred_at FROM growth_conversion_events WHERE tenant_id = ? ORDER BY datetime(occurred_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT insight_type, topic, summary, recommended_action, sample_size, confidence, guard_status, status FROM growth_content_insights WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT channel, content_type, topic, scheduled_at, status, guard_status FROM growth_calendar_items WHERE tenant_id = ? ORDER BY datetime(scheduled_at) ASC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT segment_key, label, basis, estimated, sensitive_attribute_used, confidence FROM growth_audience_segments WHERE tenant_id = ? ORDER BY label").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT experiment_id, hypothesis, primary_metric, sample_size, confidence, winner, status FROM growth_experiments WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT provider, action, units, estimated_cost, occurred_at FROM growth_cost_usage WHERE tenant_id = ? ORDER BY datetime(occurred_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT customer_key, journey_stage, consent_status, opt_out, total_orders, total_revenue, lifetime_value, updated_at FROM growth_customer_profiles WHERE tenant_id = ? ORDER BY datetime(updated_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT service_key, revenue, gross_margin, attribution_type, revenue_kind, occurred_at FROM growth_revenue_records WHERE tenant_id = ? ORDER BY datetime(occurred_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT id, action_type, channel, risk_level, requires_approval, guard_result, status, created_at FROM growth_autonomous_actions WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 20").bind(GROWTH_ENGINE_TENANT_ID).all(),
    env.DB.prepare("SELECT period_type, period_start, period_end, summary, status, created_at FROM growth_executive_reports WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 10").bind(GROWTH_ENGINE_TENANT_ID).all(),
  ]);

  return Response.json(
    {
      settings,
      connectors: connectors.results || [],
      metrics: metrics.results || [],
      conversions: conversions.results || [],
      insights: insights.results || [],
      calendar: calendar.results || [],
      segments: segments.results || [],
      experiments: experiments.results || [],
      costs: costs.results || [],
      customers: customers.results || [],
      revenue: revenue.results || [],
      actions: actions.results || [],
      reports: reports.results || [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
