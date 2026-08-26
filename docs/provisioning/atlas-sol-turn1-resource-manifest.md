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

- D1: `atlas-oracle` / `3c08bd65-cc8d-462c-abe1-c83f67d90f28`
- Schema: Clean StudioOS schema applied; 17 tables verified; Raven/Luna/Sol rows 0
- Worker: `atlas-oracle`
- Preview: `https://atlas-oracle.fortune-kanri.workers.dev`
- Preview version: `b54143d4-5047-4036-9b01-f70848dfac31`
- Status: `PREVIEW_READY`
- Domain: not connected; production DNS unchanged
- R2: not configured

## Sol

- D1: blocked by account database capacity; no D1 was created
- Worker: not deployed because the preview worker requires a real D1 binding and no fake/borrowed binding is permitted
- Character Core, market persona, tenant config, host mapping, entitlements, and Growth safety are implemented locally
- Status: `READY_EXCEPT_D1`
- Domain: not connected; production DNS unchanged
- R2: not configured

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

Capacity increase: not available through the current authenticated operation; plan/account administrator action may be required. No upgrade or billing action was performed.

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
- Blocking item: target account D1 capacity for `sol-oracle`
- Required human decision: increase the target account's D1 capacity, or explicitly authorize a demonstrably unused TEST/DEV database for deletion after independent review.
