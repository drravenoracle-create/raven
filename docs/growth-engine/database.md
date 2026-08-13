# Growth Engine Database

Migration: `drizzle/0004_growth_engine_sb.sql`

v2/v3 migration: `drizzle/0005_growth_engine_v2_v3.sql`

Tables:

- `growth_engine_settings`
- `growth_data_connectors`
- `growth_metric_points`
- `growth_events`
- `growth_conversion_events`
- `growth_content_insights`
- `growth_internal_link_recommendations`
- `growth_cta_definitions`
- `growth_trends`
- `growth_calendar_items`
- `growth_audience_segments`
- `growth_experiments`
- `growth_cost_usage`
- `growth_customer_profiles`
- `growth_retention_recommendations`
- `growth_revenue_records`
- `growth_next_best_actions`
- `growth_executive_reports`
- `growth_business_goals`
- `growth_strategies`
- `growth_autonomous_actions`
- `growth_guardrail_results`
- `growth_kill_switches`
- `growth_knowledge_items`
- `growth_agent_tasks`
- `growth_audit_log`

All tables include `tenant_id` except single-id definitions where the tenant is stored on the row. Raven seed data uses `raven-oracle`.
