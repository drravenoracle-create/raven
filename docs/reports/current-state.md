# Current State Report

Date: 2026-08-09
Source: local repository, Raven production D1, Cloudflare Worker configuration

## Confirmed Repository

- Local project: `C:\dev\Projects\FM000_Raven-Oracle`
- GitHub repository: `drravenoracle-create/raven`
- Current app shape: Raven Blackwood Next/Vinext site on Cloudflare Workers
- Current production URL: `https://raven.fortunestudios.jp`
- Raven Cloudflare account id: `c7ce2613bf30affed8d2caae0068beb5`
- Official DNS/proxy account id: `cfda786a82241adf6b21f772dbc87544`

## Existing Feature Inventory

| Area | Status | Notes |
| --- | --- | --- |
| Raven public site | Implemented | Public pages include home, blog, blog article pages, and guild page. |
| Public blog | DB-backed | `/blog` and `/blog/[slug]` read `blog_engine_articles` where `status='published'`; static `app/lib/blog.ts` is fallback only. |
| Blog Engine | Implemented, data recovery needed | DB tables, generation API, status API, event processing, dashboard, reviews, metrics, and social derivative records exist. |
| Blog scheduled publishing | Implemented | `scheduled_at <= now` and `status='scheduled'` are processed by `/api/blog-engine/events/process` and Worker cron. |
| Blog production D1 data | Partial | Production D1 currently has 1 confirmed restored published article: `ギルド日記`. Missing historical rows require recovery from backup, Drive, or another source if available. |
| SNS Engine | Implemented, provider incomplete | Post listing/creation, admin UI, publish log path, scheduled cron path, and API-not-configured handling exist. Instagram real publishing still needs valid Meta/Page setup and provider completion. |
| SNS production D1 data | Empty | Production D1 currently has 0 rows in `sns_posts`. |
| Analytics | Implemented from 2026-08-09 onward | `/api/analytics/event` stores events in D1 and `/api/analytics/summary` powers the admin analytics page. Past events before table/API creation are not present in this D1. |
| Growth Engine | Implemented scaffold | DB tables, dashboard API, admin dashboard, metrics/conversion/journey/revenue/action/insight/executive routes exist. Production action data is sparse. |
| Google admin auth | Implemented | Google OAuth protects `/admin`. Callback must use `https://raven.fortunestudios.jp/api/admin/auth/google/callback`. |
| Cloudflare public routing | Implemented through proxy | Official DNS account routes `raven.fortunestudios.jp/*` through a minimal proxy to the Raven Worker. Proxy must preserve method/body and redirect locations. |
| OpenAI API | Prepared as secret | `OPENAI_API_KEY` is expected as a Cloudflare secret and must not be committed. |
| Payments | Not confirmed | STORES/payment integration requires separate verified implementation and approval. |

## Production D1 Snapshot

Checked on 2026-08-09:

- `blog_engine_articles`: 1 row
- `sns_posts`: 0 rows
- `analytics_events`: 2 rows
- `growth_autonomous_actions`: 0 rows

## Known Gaps

- The expected historical blog article set is not present in production D1.
- Several generated files and migrations are untracked in Git. Commit discipline is required before further changes.
- Some older Worker fallback code duplicates SNS/analytics logic. App Router APIs are the primary implementation path; duplicate Worker handlers must not replace existing App Router behavior.
- Blog Engine generation templates require a full encoding/content-quality audit before further automated content generation.
- Instagram real publishing is not confirmed as production-connected. UI and API must clearly distinguish mock/API-not-configured behavior from real publishing.
- Analytics events must not send consultation text, reading text, or personal details.

## Required Rule For Future Work

Before any implementation:

1. Inventory existing code, routes, APIs, DB tables, admin screens, settings, cron jobs, and deployment configs.
2. Treat existing user-facing behavior and DB content as protected.
3. Add new behavior without deleting, replacing, hiding, or disabling existing behavior unless explicitly instructed.
4. Verify previous commits, D1 state, and production routes before claiming a feature does not exist.
5. Run build/tests and verify representative production URLs/APIs after deploy.
