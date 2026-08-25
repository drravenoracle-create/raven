# Luna Production Provisioning Phase 1.2 Audit

## Decision

**CONDITIONAL GO for reconciliation and planning only.** Production
provisioning remains blocked. No Worker, D1, R2, DNS, route, Pages setting,
secret, OAuth, repository, or production data was changed.

## Cloudflare access

| Item | Result |
|---|---|
| Configured Luna account candidate | `180ff3a8ba4e7e718e35eedcfa9c1290` |
| Pages API on candidate account | Authentication error 10000 |
| D1 API on candidate account | Resource cannot be found with current access |
| Current authenticated account set | `c7ce2613bf30affed8d2caae0068beb5`, `cfda786a82241adf6b21f772dbc87544` |
| Classification | `ACCOUNT_IDENTIFIED_BUT_NO_ACCESS` |
| Ownership | `OWNERSHIP_UNKNOWN` |

The current Cloudflare identity cannot read the configured Luna account. The
minimum external action is to authenticate to the owner account or grant read
access to account `180ff3a8ba4e7e718e35eedcfa9c1290`. After access is granted,
verify Pages, cron Worker, D1, zone, custom domain, and bindings.

## Existing production asset inventory

The non-Git source at
`C:\dev\Projects\Fm003_luna\luna-starwind` contains:

- Pages-style project name: `luna-starwind`
- Pages output: `./dist`
- Cron Worker: `luna-starwind-cron`
- Cron schedule: `0 22 * * *`, `0 4 * * *`, `0 8 * * *`
- D1 name in config: `luna-starwind-analytics`
- D1 ID in config: `695b8e94-8bfb-416e-8c1b-53ef7f3fc8f2`
- canonical URL: `https://luna.fortunestudios.jp/`

Public DNS currently resolves `luna.fortunestudios.jp` to
`luna-starwind.pages.dev`, and the URL returned HTTP 200 during this audit.
This confirms a live Pages endpoint and project-name relationship, but not
account, zone, repository, or deployment ownership. Certificate state was not
independently readable from the inaccessible account.

| Asset | Status |
|---|---|
| Local source | available, non-Git-managed |
| Pages project | candidate `luna-starwind`, owner unknown |
| Cron Worker | candidate `luna-starwind-cron`, owner unknown |
| D1 | config candidate only; remote access unavailable |
| Domain | live and Pages-directed, zone owner unknown |
| Repository | no repository metadata found |
| Deployment Git SHA | unknown |

Production source confidence is **partial**: local config, DNS, URL, and live
response align, but deployment provenance and ownership are unverified.

## Existing source classification

| Asset | Classification | Notes |
|---|---|---|
| Existing UI/branding/content | KEEP | Do not rewrite in this phase |
| Pages source and `dist` | KEEP / ADAPT | Legacy runtime; not StudioOS-wired |
| Cron Worker | KEEP / MIGRATE later | Preserve schedule and secret boundary |
| Existing D1 | KEEP / ARCHIVE source | Schema and row count unverified |
| Analytics | MAP selectively | Explicit tenant remap required |
| Blog/content | KEEP, then SELECTIVE_IMPORT | Existing schema is richer than clean bundle |
| Reading feedback | MAP_ONLY / IMPORT_OPTIONAL | Requires feedback boundary review |
| Domain | KEEP | Existing Luna remains live during side-by-side work |

Recommended strategy remains `SIDE_BY_SIDE_MIGRATION`.

## Canonical identity

`characterId = luna`, `tenantId = luna-oracle`, `guildId = raven-guild`, and
legacy alias `luna-starwind` are separate concepts. Any import must explicitly
apply `sourceTenant = luna-starwind` to `targetTenant = luna-oracle`. No implicit
aliasing or Raven fallback is allowed.

## Runtime integration audit

The legacy Worker entrypoint is `src/_worker.js`:

- `fetch(request, env)` begins around line 317.
- Host/path parsing occurs before route dispatch.
- Analytics, Blog, and Growth tenant constants are hardcoded as
  `luna-starwind`.
- The cron entrypoint is `src/cron-worker.js`, with both `fetch` and `scheduled`.

Classification: **KEEP as legacy / ADAPT later**. It is not currently a
StudioOS runtime and must not be silently changed.

The future shared StudioOS integration point is the common Worker fetch
boundary in `worker/index.ts` around line 1497, before route dispatch:

`Request -> host/tenant context -> canonical resolver -> TenantConfigResolver ->
Character/Market/Localization -> Engine Slices -> route handler`

Cron must resolve the same canonical tenant at its scheduled boundary and must
not inherit a global Raven default. This connection is not implemented in this
phase. The local adapter validates Raven, Luna, legacy alias, unknown-host
error, all Slice tenant IDs, and Growth safety flags.

## D1 audit and mapping

Remote D1 schema and row counts are **UNKNOWN** because the configured account
is inaccessible. The local source exposes these bundles:

| Existing table/bundle | Classification | Mapping decision |
|---|---|---|
| `analytics_events` | IMPORT_REQUIRED after review | Preserve timestamps; explicit tenant remap |
| `growth_events` | MAP_ONLY | Do not force into Evidence Claims |
| `growth_guardrail_results` | ARCHIVE_ONLY / MAP_ONLY | Preserve safety history separately |
| `growth_executive_briefs` | ARCHIVE_ONLY | Not equivalent to Hypothesis or Proposal |
| `reading_feedback` | IMPORT_OPTIONAL | Requires feedback/member boundary |
| `blog_engine_settings` | IMPORT_REQUIRED with adapter | Clean bundle is intentionally smaller |
| `blog_engine_articles` | IMPORT_REQUIRED, selective | Preserve IDs/slugs/timestamps/status after mapping |
| Blog event/social tables | IMPORT_OPTIONAL | Review contracts; SNS initially disabled |

The local SQL files are `analytics_events.sql`, `growth_engine_v3.sql`, and
`reading_feedback.sql`. Blog tables are also created dynamically by the legacy
Worker. Their exact remote schema, row counts, migration metadata, and
production-only tables remain unverified.

### Import strategy

Use **Hybrid** migration:

1. Preserve legacy source and D1 unchanged.
2. Create a fresh StudioOS D1 from the clean bundle in a later phase.
3. Dry-run selective imports locally/staging only.
4. Remap `luna-starwind` to `luna-oracle` explicitly.
5. Preserve source IDs where safe and record source-to-target IDs otherwise.
6. Compare row counts, timestamps, status totals, and tenant counts.
7. Perform a reviewed final delta sync only immediately before a future cutover.

Required safety: no overwrite, duplicate detection, timestamp preservation,
tenant remap audit, dry-run output, rollback to legacy D1, and no deletion.

## Clean D1 bundle and Member Core

The Phase 1.1 clean bundle remains local-only and intentionally excludes Raven
content and Opening Campaign tables. It is not yet production-compatible with
the inaccessible legacy D1.

The local Raven/Luna fixture verifies tenant-scoped reads. Member Core launch
status is **CONDITIONAL**, not READY, until the owner confirms isolation for
member, reading history, Trial, events, and service-token paths.

## Cron, Blog, Analytics, and activation

- Cron: KEEP until equivalent tenant-aware scheduling is tested; migrate later.
- Blog: selective import with schema adapter; scheduler OFF initially.
- Analytics: preserve internal history; existing external property remains
  separate; Luna-specific external analytics is optional at launch.
- AI: launch-blocking only if AI reading is included; secrets are separate.
- SNS: OFF initially.
- Reel: OFF or render-only after local validation.
- Growth: READ-ONLY / HUMAN-CONTROLLED.
- Opening Campaign and Trial: OFF.

## Side-by-side and rollback

1. Confirm account/resource ownership.
2. Prepare fresh D1/storage and tenant-aware bindings in a later phase.
3. Deploy a StudioOS Luna candidate to a non-domain preview.
4. Dry-run/import selected data and compare results.
5. Run cross-tenant and read-only smoke tests.
6. Freeze legacy writes immediately before a future cutover, then export and
   delta-sync under separate approval.
7. Switch the existing domain only after final human acceptance.

Rollback is restoration of the existing Luna Pages target. Retain the legacy
D1 and do not delete the new D1. Record TTL and proxy state before cutover.
No DNS or route action was performed here.

## Phase 2 GO conditions

- Cloudflare access or verified owner delegation
- Pages, Worker, D1, domain, and deployment provenance confirmed
- Remote D1 schema, migration metadata, and row counts read successfully
- StudioOS runtime integration implemented and locally verified
- Member Core production isolation contract confirmed
- Import mapping and rollback dry-run completed
- Domain cutover and rollback targets documented

Until then, status remains **CONDITIONAL GO** and production provisioning does
not start.
