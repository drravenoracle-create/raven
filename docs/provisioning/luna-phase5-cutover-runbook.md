# Luna Production Provisioning Phase 5 Runbook

Status: planning complete; execution requires separate human approval

## Scope and invariants

- Account boundary is fixed and must not be inferred from resource names:
  - `LEGACY_LUNA_PRODUCTION`: `Pkdb2545@gmail.com's Account`, login `pkdb2545@gmail.com`, existing Luna `luna-starwind`, source D1 `luna-starwind-analytics` / `695b8e94-8bfb-416e-8c1b-53ef7f3fc8f2`, legacy Cron `luna-starwind-cron`.
  - `STUDIOOS_LUNA_TARGET`: `Fortune.kanri@gmail.com's Account`, login `fortune.kanri@gmail.com`, account ID `cfda786a82241adf6b21f772dbc87544`, Worker `luna-oracle`, D1 `luna-oracle` / `721248ee-92a5-4fe8-b5af-08503ece8d40`, tenant `luna-oracle`, character `luna`, guild `raven-guild`.
- Before every Cloudflare operation, state whether the operation targets `LEGACY_LUNA_PRODUCTION` or `STUDIOOS_LUNA_TARGET`, and verify D1 by database ID.
- Canonical tenant: `luna-oracle`; legacy tenant: `luna-starwind`; character: `luna`; guild: `raven-guild`.
- Existing Luna Pages, legacy D1, and legacy Cron remain KEEP LIVE until the approved cutover window.
- Raven is out of scope and must remain unchanged.
- R2 is `BLOCKED_PENDING_ACTIVATION`; SNS, Reel, and media writes remain OFF.
- No automatic experiment, campaign, trial, payment, external send, or Growth execution is allowed.
- Production parity wording: do not show `公開記事はD1 Blog Engineから取得`, `下書き・承認・公開ステータス管理`, or `SNS派生コンテンツのキュー生成に対応` on public Luna pages. Show `毎朝の今日の占いをお届け`, `恋愛・相性・復縁を深く読み解く`, and `気になる記事から無料鑑定へ進めます`.
- Latest approved Legacy source fingerprint for final delta: Blog articles 25, Blog events 78, SNS contents 92 from `luna-starwind-analytics` / `695b8e94-8bfb-416e-8c1b-53ef7f3fc8f2`.
- Phase 6 source verification: read-only export SHA-256 `DECC5227773D3884715CFB24C4351D5135501950EA9CB6D08FD128EC2F80813A`; source snapshot contained Blog articles 25, Blog events 78, SNS contents 92 and Analytics 33.
- Phase 6 final delta policy: apply only new Analytics rows and the explicitly approved article status transition; do not overwrite metadata-only settings changes; keep Blog events and SNS contents archive-only.
- Phase 6 result: 13 Analytics rows applied, one article status synchronized to `published`, 0 deletions, and the rerun produced 0 new rows / 0 writes. Target preview verification remained healthy with Blog 25 (published 25 / scheduled 0), Growth 0, and no Raven contamination.

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
- Current new D1 verification: `/api/preview/status` reports Analytics 33, Blog articles 25, Growth 0; article statuses published 24 / scheduled 1 in the prior D1 verification; Raven contamination 0.
- Current Legacy Cron state: observed ACTIVE on 2026-08-26 with `0 22 * * *`, `0 4 * * *`, and `0 8 * * *`; it was not restarted during this run.
- Delta rerun produced no duplicate/new imports.
