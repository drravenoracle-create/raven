# Luna Production Resource Manifest

Status: Phase 2 D1 provisioned; R2 pending activation
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

- Legacy Luna import: NOT STARTED
- Analytics, Blog, SNS, Reel, and Growth runtime data: 0 rows
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
- Worker: NOT_PROVISIONED
- Worker deploy: NOT PERFORMED
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
- Phase 3 readiness: CONDITIONAL; Core/Blog/Analytics preview can be planned without media, but any Worker configuration requiring the R2 binding remains blocked until account activation
- Existing Luna remains KEEP LIVE
- Next action: obtain R2 activation for the standard origin account, then reassess media-enabled Worker Preview. Do not start Phase 3 automatically.
