# Luna Production Resource Manifest

Status: Phase 6 continuation; account boundary fixed; cutover not executed; R2 pending activation
Date: 2026-08-26

## Identity

- Canonical tenant: `luna-oracle`
- Character: `luna`
- Guild: `raven-guild`
- Legacy alias: `luna-starwind`
- Existing Luna Pages and D1: KEEP LIVE; no legacy data imported
- Cutover: NOT STARTED

## Account boundary

- `LEGACY_LUNA_PRODUCTION`: Cloudflare account `Pkdb2545@gmail.com's Account`; login `pkdb2545@gmail.com`; existing Luna `luna-starwind`; production URL `https://luna.fortunestudios.jp/`; source D1 `luna-starwind-analytics` / `695b8e94-8bfb-416e-8c1b-53ef7f3fc8f2`; legacy Cron `luna-starwind-cron`.
- `STUDIOOS_LUNA_TARGET`: Cloudflare account `Fortune.kanri@gmail.com's Account`; login `fortune.kanri@gmail.com`; account ID `cfda786a82241adf6b21f772dbc87544`; Worker `luna-oracle`; target D1 `luna-oracle` / `721248ee-92a5-4fe8-b5af-08503ece8d40`; tenant `luna-oracle`; character `luna`; guild `raven-guild`.
- Cloudflare operations must name either `LEGACY_LUNA_PRODUCTION` or `STUDIOOS_LUNA_TARGET` before execution. Resource names alone are not evidence of account ownership.
- D1 operations must verify the database ID. Legacy source is only `695b8e94-8bfb-416e-8c1b-53ef7f3fc8f2`; new StudioOS Luna target is only `721248ee-92a5-4fe8-b5af-08503ece8d40`.
- Similar resources in other accounts are not valid substitutes.

## Production parity requirement

- Legacy Production must not show these management-facing lines: `公開記事はD1 Blog Engineから取得`, `下書き・承認・公開ステータス管理`, `SNS派生コンテンツのキュー生成に対応`.
- Legacy Production and StudioOS Luna Preview must show these reader-facing lines: `毎朝の今日の占いをお届け`, `恋愛・相性・復縁を深く読み解く`, `気になる記事から無料鑑定へ進めます`.

## Current legacy source fingerprint

- Source account role: `LEGACY_LUNA_PRODUCTION`
- Source D1: `luna-starwind-analytics`
- Source D1 ID: `695b8e94-8bfb-416e-8c1b-53ef7f3fc8f2`
- Blog articles: 25
- Blog events: 78
- SNS contents: 92
- Fingerprint date: 2026-08-26

## Origin resources

- StudioOS target account role: `STUDIOOS_LUNA_TARGET`
- StudioOS target account: `Fortune.kanri@gmail.com's Account`
- Standard StudioOS origin account: `cfda786a82241adf6b21f772dbc87544`
- New D1: `luna-oracle`
- New D1 ID: `721248ee-92a5-4fe8-b5af-08503ece8d40`
- D1 resource state: PROVISIONED
- D1 target verified distinct from legacy Luna D1 `695b8e94-8bfb-416e-8c1b-53ef7f3fc8f2` and Raven D1 `a8a69ddd-2d8b-4e76-81f1-29abbb619a38`
- Schema profile: Luna-only Clean StudioOS schema, schema version `1`, environment `production-preparation`
- Schema application: SUCCESS; 29 queries, 16 user tables, required indexes present
- Canonical metadata: one row for `luna-oracle`; no Raven tenant/content seed

## Initial data safety

- Legacy Luna import: SELECTIVE NON-MEDIA IMPORT COMPLETE; archive-only and excluded rows not imported
- Latest legacy export: `C:\Users\user\Documents\LunaBackups\luna-starwind-d1-phase4-latest-20260826.sql` (269,173 bytes; SHA-256 `5FDAF82BDD1D85A3EC73B1A8A68E5498571D706B527B2336A574E277E64C7055`)
- Phase 5 latest legacy snapshot: `C:\Users\user\Documents\LunaBackups\luna-starwind-d1-phase5-latest-20260826.sql` (269,173 bytes; SHA-256 `AADB4A99277E1BF07076CD6271DB3135627641F7FD44FDBCD1AB6DB8BB020188`)
- Pre-import backup: `C:\Users\user\Documents\LunaBackups\luna-oracle-d1-pre-import-20260826.sql` (7,040 bytes; SHA-256 `06E7E4650D691D7F26748818A711A664BF99FB4285EAD2453435B73496784132`)
- Selective import: SUCCESS; Analytics 20, reading feedback 1, Blog settings 1, Blog articles 25 (published 24, scheduled 1)
- Import SQL: `C:\Users\user\Documents\LunaBackups\luna-oracle-selective-import-20260826.sql` (SHA-256 `2490DD99B4F833A21880814E3DF7AAD4EF50E889756A24FC084DC8BF6953021B`)
- Dry-run report: `C:\Users\user\Documents\LunaBackups\luna-phase4-dryrun-20260826\luna-phase1-4-dryrun-report.json`
- Archive-only: Blog events 76, Blog social contents 88, plus unrelated legacy operational rows retained outside the new D1
- Imported runtime data: Analytics 20, Blog settings 1, Blog articles 25; SNS/Reel runtime data 0
- Growth proposals/experiments/memory/precision: 0 rows
- Campaign/Trial: runtime OFF; no campaign seed was installed
- Raven contamination: 0 rows / not present in canonical tenant metadata

## Phase 5 delta validation

- Previous snapshot: Phase 4 legacy snapshot above; current snapshot: Phase 5 snapshot above
- Delta report: `C:\Users\user\Documents\LunaBackups\luna-phase5-delta-report-20260826.json` (Git-excluded)
- Delta SQL: `C:\Users\user\Documents\LunaBackups\luna-phase5-delta.sql` (739 bytes; SHA-256 `3D183D8C73007F0A163F4B53C28510E3E293ED2DD2B6CE816B175F6C1C8A0F00`)
- Analytics: 20 unchanged; reading feedback: 1 unchanged; Blog settings: 1 metadata-only `updated_at` change; Blog articles: 25 unchanged
- Archive-only: Blog events 76 unchanged; Blog social contents 88 unchanged; Growth event/guardrail/brief tables remain 0
- New rows: 0; deleted rows: 0; data-bearing updates: 0; settings timestamp-only update requires no overwrite
- Delta policy: `updated_at` watermark when present; otherwise stable source ID plus `created_at`; new rows only by default; update/delete requires human review
- Delta application: executed against new D1 only; 0 rows read/written; idempotency rerun also 0 rows read/written
- Pre-delta backup: `C:\Users\user\Documents\LunaBackups\luna-oracle-d1-pre-phase5-delta-20260826.sql` (107,722 bytes; SHA-256 `5ADE57F696576D22D6E7EBE58EAB6E6F16F8E5660A91ADDD55D6C330413A2B66`)
- Post-delta verification: Analytics 20, feedback 1, Blog settings 1, Blog articles 25; article status published 24 / scheduled 1; import ledger 47; Raven rows 0; Growth rows 0

## Phase 6 final delta

- Confirmed production source of truth: `luna-starwind-analytics` only; the Target-account D1 named `luna-starwind` is not a migration source.
- Latest read-only source export: `C:\Users\user\OneDrive\Documents\AI占い5サイト管理プロジェクト\artifacts\luna-phase6-source-latest-20260826.sql` (281,958 bytes; SHA-256 `DECC5227773D3884715CFB24C4351D5135501950EA9CB6D08FD128EC2F80813A`).
- Final delta dry-run against the Phase 5 snapshot: 19 new, 2 updated, 0 deleted, 209 unchanged.
- Apply policy: 13 new `analytics_events` rows were applied to New Luna D1; Blog settings `updated_at`-only change was not overwritten; one approved Blog article transition was synchronized from `scheduled` to `published`.
- Archive-only rows excluded from runtime import: 2 new Blog events and 4 new SNS contents; all existing archive-only history remains outside runtime tables.
- Tenant remap: `luna-starwind` -> `luna-oracle`; character remap: -> `luna`; no Raven rows or cross-tenant rows detected.
- Delta rerun: 0 new rows and 0 rows written; approved article status sync rerun: 0 rows written. Import ledger and status predicates provide idempotency.
- Post-apply verification: Analytics 33, Blog articles 25 (published 25 / scheduled 0), Growth 0, Raven contamination false.
- Status correction note: the existing ledger target key is a deterministic label, not a numeric article ID; the approved status transition was therefore applied with an explicit target tenant + slug + scheduled-state predicate. Re-running the status SQL is now a no-op.
- Domain cutover was not attempted; Legacy Pages and Legacy Cron remain KEEP LIVE.

## Backup and restore

- Initial schema export: `C:\Users\user\Documents\LunaBackups\luna-oracle-d1-initial-schema-20260826.sql`
- Export size: 7,040 bytes
- SHA-256: `06E7E4650D691D7F26748818A711A664BF99FB4285EAD2453435B73496784132`
- Local restore verification: SUCCESS; 16 tables, Luna metadata only, zero runtime data
- Backup is outside Git and contains no imported legacy user data

## R2 and runtime

- R2 account: `cfda786a82241adf6b21f772dbc87544`
- R2 state: `BLOCKED_PENDING_ACTIVATION` (Cloudflare error 10042)
- R2 bucket creation: NOT ATTEMPTED AGAIN
- Worker: `luna-oracle`
- Worker account: `cfda786a82241adf6b21f772dbc87544`
- Worker environment: `production-preview`
- Worker preview URL: `https://luna-oracle.fortune-kanri.workers.dev`
- Worker version: `75881850-a87e-490d-bf7e-bc7522fa157d`
- D1 binding: `DB` -> `luna-oracle` / `721248ee-92a5-4fe8-b5af-08503ece8d40`
- R2 binding: NOT CONFIGURED; media write remains disabled
- Preview activation: Core, Member boundary, internal Analytics, Blog ON; Blog scheduler, SNS, Reel, Campaign, Trial OFF; Growth READ-ONLY
- Preview read validation: root 200, `/api/preview/status` 200, Analytics 33, Blog 25, Growth 0; article detail read-only previously succeeded
- Import verification: all imported tenant IDs are `luna-oracle`; duplicate ledger keys 47/47 distinct; Raven rows 0; Growth rows 0
- Required secret names only: `ADMIN_SESSION_SECRET`, `GUILD_MEMBER_SERVICE_TOKEN`, `OPENAI_API_KEY`
- Secret classification: `ADMIN_SESSION_SECRET` cutover-required when admin is exposed; `GUILD_MEMBER_SERVICE_TOKEN` feature-required for Member activation; `OPENAI_API_KEY` feature-required for AI reading and optional for Core/Blog-only cutover
- DNS/custom-domain/cutover: NOT PERFORMED

## Safety evidence

- Existing Luna `https://luna.fortunestudios.jp/`: HTTP 200
- Raven `https://raven.fortunestudios.jp/`: HTTP 200
- Existing Luna writes: NONE
- Raven writes: NONE
- DNS changes: NONE
- Legacy data import: NONE
- R2 workaround or alternate-account creation: NONE

## Readiness

- D1 Provisioning: GO
- R2 Provisioning: BLOCKED
- Phase 2 overall: CONDITIONAL GO
- Phase 3: CONDITIONAL GO; safe workers.dev preview is active without R2, while media-enabled preview remains blocked until account activation
- Phase 4: GO for selective non-media import and Preview validation
- Phase 5: GO for final delta validation and cutover planning; no domain cutover performed
- Phase 5 readiness: YES for a separately approved cutover run, conditional on final pre-cutover checks, secret readiness, and human approval
- Legacy Cron: observed ACTIVE on 2026-08-26; `luna-starwind-cron` schedules `0 22 * * *`, `0 4 * * *`, and `0 8 * * *`. Use a cutover-time write freeze; do not run legacy and new schedulers concurrently
- Scheduled article policy: preserve `scheduled` state through final sync unless a human explicitly approves legacy publication before freeze; enable the new scheduler only after acceptance
- Cutover target: existing `luna.fortunestudios.jp` remains on legacy Pages until approved switch; new Worker remains workers.dev-only
- R2: `BLOCKED_PENDING_ACTIVATION`; non-blocking for Core/Blog/non-media cutover while SNS/Reel/media remain OFF
- Existing Luna remains KEEP LIVE
- Next action: execute the separate cutover runbook after final secret/readiness approval; obtain R2 activation before enabling media/SNS/Reel

## Production handoff verification (2026-08-27)

- Production state: LIVE
- Migration: COMPLETE
- Production account role: `STUDIOOS_LUNA_TARGET`
- Production account: `Fortune.kanri@gmail.com's Account` (`fortune.kanri@gmail.com`)
- Production Worker: `luna-oracle`
- Production URL: `https://luna.fortunestudios.jp/`
- Tenant: `luna-oracle`
- Character: `luna`
- Guild: `raven-guild`
- Custom Domain: `luna.fortunestudios.jp`
- `/api/preview/status`: HTTP 200; tenant `luna-oracle`; character `luna`; locale `ja-JP`; Raven contamination `false`
- Root: HTTP 200
- Raven health: HTTP 200
- R2: `BLOCKED / OPTIONAL` (non-media production)
- Legacy Pages/Worker, Legacy D1, and Legacy Cron: KEEP; Cron remains FROZEN
- Rollback target: Legacy Luna
- Actual production Worker version: `NOT_AVAILABLE` from the current readable session; do not infer from prior preview versions
- Cutover timestamp: `NOT_AVAILABLE` from the current readable session
- Domain/DNS changes in this finalization step: NONE

### Feature state at handoff

- Core Site: ON
- Member: ON after isolation validation
- Internal Analytics: ON
- Blog: ON; scheduler OFF
- SNS: OFF
- Reel: OFF
- Growth: READ-ONLY / HUMAN-CONTROLLED
- Opening Campaign: OFF
- Trial: OFF
