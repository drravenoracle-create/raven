# Luna Production Provisioning Phase 5 Runbook

Status: planning complete; execution requires separate human approval

## Scope and invariants

- Canonical tenant: `luna-oracle`; legacy tenant: `luna-starwind`; character: `luna`; guild: `raven-guild`.
- Existing Luna Pages, legacy D1, and legacy Cron remain KEEP LIVE until the approved cutover window.
- Raven is out of scope and must remain unchanged.
- R2 is `BLOCKED_PENDING_ACTIVATION`; SNS, Reel, and media writes remain OFF.
- No automatic experiment, campaign, trial, payment, external send, or Growth execution is allowed.

## Final sync and freeze

1. Record the last approved legacy D1 export and checksum. Take a pre-cutover backup of the new D1.
2. Confirm the legacy-to-canonical remap explicitly: `luna-starwind` -> `luna-oracle`, character -> `luna`.
3. Freeze `luna-starwind-cron` at the cutover boundary. The current schedules are `0 22 * * *`, `0 4 * * *`, and `0 8 * * *`; the source runtime shows today-fortune, draft-generation, and auto-publish writes.
4. Keep the legacy Pages site serving reads during the freeze. Do not run the legacy and new schedulers concurrently.
5. Export the final legacy snapshot, compare it to the previous watermark, and apply only new rows to the new D1. No-overwrite is the default; updates or deletes require explicit human review.
6. Preserve IDs where safe, use deterministic mappings on collision, preserve timestamps and supported statuses, and record every imported source key in `studioos_import_ledger`.
7. Keep archive-only Blog events/social history outside the new runtime tables unless a separately approved archive import is defined.

### Scheduled article rule

The existing legacy scheduler must either publish a scheduled article before the freeze under explicit approval, or the scheduled state must be carried forward unchanged. The new scheduler stays OFF until post-cutover acceptance. This prevents double publication.

## Cutover

1. Complete Preview acceptance at `https://luna-oracle.fortune-kanri.workers.dev`.
2. Confirm new Worker `luna-oracle` uses only the new D1 binding and has no legacy or Raven write path.
3. Under human approval, move `luna.fortunestudios.jp` from the existing Pages custom-domain path to the approved new Worker custom-domain/path in the same zone owner account. Do not guess the exact dashboard/API operation at execution time; verify the current ownership and route state immediately before the change.
4. Run the public smoke checklist below. Keep the old Pages, old D1, and old Cron intact.
5. Enable no SNS/Reel/R2 functionality as part of this cutover.

## Acceptance checklist

- Public root, Japanese locale, mobile response, and crawler response are healthy.
- Luna identity, URL, CTA, hashtags, storage namespace, and provider references show no Raven leakage.
- Blog read works; articles, status, and timestamps match the approved final snapshot; scheduler remains OFF until approved.
- Member requests carry `x-tenant-id=luna-oracle`, `x-guild-id=raven-guild`, and `x-character-id=luna`; cross-tenant reads are rejected.
- Internal Analytics is available or gracefully unavailable; no Raven Analytics ID is inherited.
- SNS and Reel are OFF; no external publishing occurs.
- Growth is READ-ONLY / HUMAN-CONTROLLED with `executionAllowed=false`, `requiresStartApproval=true`, and `autoStart=false`.
- Opening Campaign and Trial are OFF.
- Version Center shows the actual deployed build commit, schema version, migration state, and production environment.
- Legacy Luna and Raven health checks remain successful.

## Rollback

- Before successful acceptance, restore the previous Pages custom-domain/path and resume the legacy Cron only after confirming the new scheduler remains OFF.
- Keep the new D1, new Worker version, legacy D1, legacy Pages, and export artifacts; do not delete them during rollback.
- Prefer code/route rollback over destructive schema rollback. Additive schema remains in place.
- If data divergence exists, stop writes on the new path, retain both snapshots, and perform a reviewed reconciliation before retrying.

## Required approvals and secrets

- Human approval is required for freeze, final sync, domain switch, scheduler policy, and rollback decisions.
- Secret names only: `ADMIN_SESSION_SECRET` for exposed admin operations, `GUILD_MEMBER_SERVICE_TOKEN` for Member activation, and `OPENAI_API_KEY` for AI reading. Values must be configured out-of-band and never appear in Git, manifests, or logs.
- R2 activation is required before media/SNS/Reel activation, but not for the current non-media cutover plan.

## Current evidence

- Latest legacy snapshot: `C:\Users\user\Documents\LunaBackups\luna-starwind-d1-phase5-latest-20260826.sql` (Git-excluded).
- Delta report: `C:\Users\user\Documents\LunaBackups\luna-phase5-delta-report-20260826.json` (Git-excluded).
- New D1 pre-delta backup: `C:\Users\user\Documents\LunaBackups\luna-oracle-d1-pre-phase5-delta-20260826.sql` (Git-excluded).
- Current new D1 verification: Analytics 20, feedback 1, Blog settings 1, Blog articles 25; article statuses published 24 / scheduled 1; Growth 0; Raven contamination 0.
- Delta rerun produced no duplicate/new imports.
