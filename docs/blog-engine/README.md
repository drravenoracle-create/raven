# Raven Oracle Blog Engine

Blog Engine v1.0/v2.0 is implemented as a D1-backed extension to the existing Raven blog admin.

It does not replace the current static blog files. It adds:

- AI-style staged draft generation with mock provider fallback
- SEO metadata and internal-link extension points
- quality, brand, and safety scoring
- approval, scheduling, publishing events
- SNS derivative content queue
- article metrics, performance score, recommendations, refresh jobs, experiments, CTA metrics
- Strategy Memory and Optimization Guard
- daily series slot for `占い師がホームページを持つメリット`: draft at 13:00 and publish at 17:00, Asia/Tokyo
- Blog x SNS link v1.0 event processing from `article.published` to many SNS derivative contents
- SNS performance feedback with direct/assisted/unknown attribution and Content Growth Score

Production AI and analytics providers must be connected through server-side secrets. No API keys are stored in code.

## Admin

Use `/admin/blog` and the Blog Engine panel.

The admin panel can generate draft records, approve/schedule/publish records, and create improvement reviews.

## Migrations

- `drizzle/0003_blog_engine.sql`

Apply only to the Raven D1 database `raven-oracle` under the Raven Cloudflare account.

## Events

Blog Engine emits compatible event rows in `blog_engine_events`:

- `article.created`
- `article.approved`
- `article.scheduled`
- `article.published`
- `article.updated`
- `social.performance.updated`

Payloads include `schema_version`, `tenant_id`, `article_id`, SEO fields, key message, target reader, and recommended social angle.

## SNS Link

`blog_engine_social_contents` stores one-article-to-many derivatives for Instagram, X, LINE, and future channels.

SNS-specific publishing remains outside Blog Engine.

`POST /api/blog-engine/events/process` consumes pending Blog Engine events. `article.published` creates queued SNS derivative contents idempotently by `tracking_id`.

`POST /api/blog-engine/social-metrics` accepts SNS performance feedback and stores Content Growth Score snapshots.

## Safety

Optimization Guard is stored in `blog_engine_optimization_guard`.

Brand and safety constraints are hard gates. High-risk changes require human approval.
