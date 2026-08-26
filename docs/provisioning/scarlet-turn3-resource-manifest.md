# Scarlet StudioOS Turn 3 Resource Manifest

## Boundary

- Legacy production account: `Fs.scarlet.g@gmail.com's Account` / `fs.scarlet.g@gmail.com` / `ac8c2578aeccae5fce1a75e0b4e47ca0`
- Legacy Worker: `scarlet-guardian`
- Legacy D1: `scarlet-guardian` / `088a74ab-5563-45af-8c1b-ae8dbef3b5c9` (retained)
- Target account: `Fortune.kanri@gmail.com's Account` / `fortune.kanri@gmail.com` / `cfda786a82241adf6b21f772dbc87544`
- Production domain: `scarlet.fortunestudios.jp` (unchanged; no cutover)

## Target Preview Resources

- Worker: `scarlet-oracle`
- Worker version: `f7e350dc-8e6d-495e-9999-bf6fe9feab1d`
- Preview URL: `https://scarlet-oracle.fortune-kanri.workers.dev`
- D1: `scarlet-oracle` / `3a003494-29c5-403f-8e36-450891968428`
- D1 binding: `DB`
- Member binding: `MEMBER_CORE` -> `guild-member-core`
- Environment: `production-preview`

## Identity and Activation

- Tenant: `scarlet-donovan`
- Character: `scarlet`
- Guild: `raven-guild`
- Market/locale: `jp` / `ja-JP`
- Core, Blog, internal Analytics: ON
- Member: read-only
- Growth: read-only (`executionAllowed=false`, `requiresStartApproval=true`, `autoStart=false`)
- SNS, Reel, Opening Campaign, Trial: OFF
- R2: optional, not provisioned
- External providers: pending; no credentials added

## Migration

- Strategy: side-by-side, selective import
- Source: Legacy D1 `088a74ab-5563-45af-8c1b-ae8dbef3b5c9`
- Source export: local temporary artifact, Git-excluded; SHA-256 `406602C8E91BB204BC0DCC1C01D4FAB376FD25E3405BFAB53608F3A1BF90242E`
- Target pre-import backup: local temporary artifact, Git-excluded
- Imported: Posts 2, Analytics 2, generated canonical settings 1
- Archive-only: SNS drafts 1
- Target verification: Posts 2, Analytics 2; Raven rows 0; Luna rows 0
- Tenant mapping: `scarlet-donovan` -> `scarlet-donovan` (explicit canonical mapping)
- Character mapping: source has no character column; target metadata is explicitly `scarlet`
- IDs: deterministic mapping / no overwrite; duplicate and collision count 0
- Status and timestamps: preserved where target schema supports them

## Safety and Operations

- Legacy production: KEEP LIVE; no writes
- Legacy Cron: unchanged; schedule/purpose not declared in available metadata
- DNS, custom domain, parent proxy, and production routes: unchanged
- Raven and Luna: unchanged
- Cutover: not attempted
- Rollback target: Legacy `scarlet-guardian` Worker/D1 and existing production routing

## Turn 4 Production Handoff

- Production state: LIVE (via existing `scarlet-parent-proxy`)
- Production URL: `https://scarlet.fortunestudios.jp/`
- Proxy origin before: `https://scarlet-guardian.fs-scarlet-g.workers.dev`
- Proxy origin after: `https://scarlet-oracle.fortune-kanri.workers.dev`
- Proxy deployment version: `7d2a5f2f-8281-4c0e-a000-9dd8b8dde6f3`
- Target Worker version: `f7e350dc-8e6d-495e-9999-bf6fe9feab1d`
- Cutover timestamp: `2026-08-26T18:36:48.8503540Z`
- Production status/root: HTTP 200; tenant `scarlet-donovan`; character `scarlet`; posts 2; analytics 2
- Legacy Worker/D1: KEEP; Legacy Cron: unchanged
- R2/providers: optional/pending; SNS/Reel/Campaign/Trial remain OFF
- Rollback: restore proxy origin to the Legacy Worker URL and verify Legacy HTTP 200
