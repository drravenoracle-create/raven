# Luna Production Resource Manifest

Status: Phase 4 selective import complete; R2 pending activation
Date: 2026-08-26

## Identity

- Canonical tenant: `luna-oracle`
- Character: `luna`
- Guild: `raven-guild`
- Legacy alias: `luna-starwind`
- Existing Luna Pages and D1: KEEP LIVE; no legacy data imported
- Cutover: NOT STARTED

## Origin resources

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
- Pre-import backup: `C:\Users\user\Documents\LunaBackups\luna-oracle-d1-pre-import-20260826.sql` (7,040 bytes; SHA-256 `06E7E4650D691D7F26748818A711A664BF99FB4285EAD2453435B73496784132`)
- Selective import: SUCCESS; Analytics 20, reading feedback 1, Blog settings 1, Blog articles 25 (published 24, scheduled 1)
- Import SQL: `C:\Users\user\Documents\LunaBackups\luna-oracle-selective-import-20260826.sql` (SHA-256 `2490DD99B4F833A21880814E3DF7AAD4EF50E889756A24FC084DC8BF6953021B`)
- Dry-run report: `C:\Users\user\Documents\LunaBackups\luna-phase4-dryrun-20260826\luna-phase1-4-dryrun-report.json`
- Archive-only: Blog events 76, Blog social contents 88, plus unrelated legacy operational rows retained outside the new D1
- Imported runtime data: Analytics 20, Blog settings 1, Blog articles 25; SNS/Reel runtime data 0
- Growth proposals/experiments/memory/precision: 0 rows
- Campaign/Trial: runtime OFF; no campaign seed was installed
- Raven contamination: 0 rows / not present in canonical tenant metadata

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
- Worker version: `4b089e07-812d-448b-90c9-be8822868e63`
- D1 binding: `DB` -> `luna-oracle` / `721248ee-92a5-4fe8-b5af-08503ece8d40`
- R2 binding: NOT CONFIGURED; media write remains disabled
- Preview activation: Core, Member boundary, internal Analytics, Blog ON; Blog scheduler, SNS, Reel, Campaign, Trial OFF; Growth READ-ONLY
- Preview read validation: root 200, Analytics 20, Blog 25, feedback 1; article detail read-only succeeded
- Import verification: all imported tenant IDs are `luna-oracle`; duplicate ledger keys 47/47 distinct; Raven rows 0; Growth rows 0
- Required secret names only: `ADMIN_SESSION_SECRET`, `GUILD_MEMBER_SERVICE_TOKEN`, `OPENAI_API_KEY`
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
- Phase 5 readiness: NO; final delta sync, legacy freeze decision, and human-approved domain cutover remain outstanding
- Existing Luna remains KEEP LIVE
- Next action: obtain R2 activation before enabling media/R2 binding. Domain cutover and further legacy delta sync remain separate, human-approved phases.
