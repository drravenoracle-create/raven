# Raven Oracle Growth Engine

Current implementation version: `growth-engine-v3.0`.

Growth Engine is the Raven Oracle upper orchestration layer for analytics, conversions, content intelligence, customer journey, retention, revenue/LTV, executive reports, autonomous actions, internal links, refresh, CTA, trend, calendar, audience, experiments, cost, and Optimization Guard.

It does not replace Blog Engine or SNS Engine. It coordinates them through shared metrics, events, and tenant-scoped records.

## Implemented S-B Scope

- Analytics/Data Connector schema and manual metric ingestion
- Conversion Engine event ingestion with direct/assisted/unknown attribution
- Content Intelligence proposal API with sample size and confidence guard
- Internal Link 2.0 recommendation schema
- Refresh/CTA/Trend/Calendar/Audience/Experiment schemas
- Growth Engine dashboard at `/admin/growth`
- Feature flags in `growth_engine_settings`
- cost usage table and provider status table
- v2.0 Customer Journey / CRM records
- v2.0 Retention, Revenue Intelligence, Next Best Action, Executive Brief records
- v3.0 Business Goals, Strategy, Autonomous Actions, Guardrail Results, Emergency Stop, Knowledge, Agent Tasks, Audit Log

External providers such as GA4, Search Console, Cloudflare Analytics, LINE, booking, and payment APIs are not connected in code. They are represented as connectors with `not_configured` or `available` status until server-side credentials and provider adapters are added.

## APIs

- `GET /api/growth-engine/dashboard`
- `POST /api/growth-engine/metrics`
- `POST /api/growth-engine/conversion`
- `POST /api/growth-engine/insights`
- `POST /api/growth-engine/journey`
- `POST /api/growth-engine/revenue`
- `POST /api/growth-engine/actions`
- `POST /api/growth-engine/executive`

## Safety

Growth Engine must not infer unavailable data as measured data. `unknown` attribution stays unknown.

Automatic improvements must pass Optimization Guard. Brand and safety constraints are hard gates, not ordinary KPI weights.
