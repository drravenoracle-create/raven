# Atlas + Sol StudioOS TURN 1 Resource Manifest

Date: 2026-08-27
Target account: Fortune.kanri@gmail.com's Account (`cfda786a82241adf6b21f772dbc87544`)

## Identity

| Member | Character ID | Tenant ID | Guild | Market | Locale |
|---|---|---|---|---|---|
| Atlas | `atlas` | `atlas-oracle` | `raven-guild` | `jp` | `ja-JP` |
| Sol | `sol` | `sol-oracle` | `raven-guild` | `jp` | `ja-JP` |

Character values are sourced only from `docs/provisioning/atlas-sol-character-source-manifest.md`. Unresolved source fields remain UNKNOWN.

## Atlas

- D1: `atlas-oracle` / `3c08bd65-cc8d-462c-abe1-c83f67d90f28` (logical role: `STUDIOOS_SHARED_CORE`)
- Schema: Clean StudioOS schema applied; 17 tables verified; Raven/Luna/Sol rows 0
- Worker: `atlas-oracle`
- Preview: `https://atlas-oracle.fortune-kanri.workers.dev`
- Preview version: `cb64005c-e853-4d6d-bdc4-20b1d7325669`
- Status: `PREVIEW_READY`
- Domain: not connected; production DNS unchanged
- R2: not configured
- Analytics DB: `fortune-studio-analytics` / `6d60f0e0-8816-46c8-8e7b-fb05129d335d`

## Sol

- D1: `atlas-oracle` / `3c08bd65-cc8d-462c-abe1-c83f67d90f28` (shared physical Core; no Sol-specific D1)
- Worker: `sol-oracle`
- Preview: `https://sol-oracle.fortune-kanri.workers.dev`
- Preview version: `bc991914-632a-4b45-95e6-9d47dd9c7ae4`
- Character Core, market persona, tenant config, host mapping, entitlements, and Growth safety are implemented locally
- Status: `PREVIEW_READY` after shared-Core preview deployment
- Domain: not connected; production DNS unchanged
- R2: not configured
- Analytics DB: `fortune-studio-analytics` / `6d60f0e0-8816-46c8-8e7b-fb05129d335d`

## Shared Core decision

The physical `atlas-oracle` database is the initial `STUDIOOS_SHARED_CORE`. Atlas and Sol are logical tenants isolated by `tenant_id`; Atlas/Sol do not receive separate Core D1s. Analytics remains in `fortune-studio-analytics`.

Core tenant-scoped tables include `studioos_tenant_metadata`, `studioos_member_context`, `blog_engine_settings`, `blog_engine_articles`, and the Growth/SNS/Reel tables. `_cf_KV` is infrastructure-owned. Existing Atlas rows remain under `atlas-oracle`; Sol initialization adds only its tenant metadata and empty blog settings.

## D1 capacity decision

Inventory count before: 10. Wrangler reported the account maximum for D1 creation; the numeric limit is not exposed by the command.

No database met all deletion criteria (`TEST_DEV_UNUSED`, no binding, no manifest reference, no data/rollback value, and explicit objective evidence). Safe deletion candidates: none. No existing database was deleted.

Classifications:

- `atlas-oracle`: `STUDIOOS_ACTIVE`
- `scarlet-oracle`: `STUDIOOS_ACTIVE`
- `luna-oracle`: `STUDIOOS_ACTIVE`
- `guild-member-core`: `STUDIOOS_ACTIVE`
- `raven-oracle`: `PRODUCTION`
- `ruby-hitomi`: `PRODUCTION`
- `fortune-studio-analytics`: `PRODUCTION`
- `fortune-studio-official-blog`: `PRODUCTION`
- `luna-starwind`: `ROLLBACK_REQUIRED`
- `scarlet-guardian`: `ROLLBACK_REQUIRED`

Capacity increase: not required for Atlas/Sol Shared Core. No plan change or database deletion was performed.

## Shared Analytics additive extension

Backup: `C:\Users\user\Documents\LunaBackups\fortune-studio-analytics-pre-studioos-additive-20260827.sql`

Backup SHA-256: `4B79AAEA7A95DBCBB411A279C0E2D21C2F9AC3A04ACAA1D9D9448E68CF35622B`

The existing `daily_site_analytics`, `analytics_collection_runs`, and `_cf_KV` tables were preserved. StudioOS `analytics_events`, `studioos_analytics_tenants`, and tenant-scope indexes were added additively. No production data rows were written or changed.

Atlas and Sol preview configs use `ANALYTICS_DB` pointing to this existing database. Sol's tenant DB binding remains pending capacity.

## Runtime safety

- Atlas and Sol host mappings are tenant-aware.
- Unknown hosts fail explicitly; no Raven fallback.
- SNS/Reel: OFF.
- Growth: READ-ONLY, `executionAllowed=false`, `requiresStartApproval=true`, `autoStart=false`.
- Opening Campaign/Trial: OFF.
- Existing Raven, Luna, and Scarlet resources: unchanged.
- Production DNS/custom domains: unchanged.

## State

- Atlas: `PREVIEW_READY`
- Sol: `READY_EXCEPT_D1`
- TURN 1 result: `CONDITIONAL GO`
- TURN 2 readiness: `PARTIAL`
- Blocking item: none for Atlas/Sol Core D1 placement
- Required human decision: none for this Shared Core step

Version Center: Atlas preview entry is updated in the provisioning manifest; Sol remains planned until its tenant D1 exists. No production Version Center state was changed.
