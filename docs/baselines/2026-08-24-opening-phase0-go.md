# Opening Campaign Phase 0 GO Checkpoint

Checkpoint date: 2026-08-24

## Raven Oracle

- Code baseline: `f74c67780c438e74bb56506b17ef10b3aa0b359d`
- Tag: `raven-integrated-baseline-20260824`
- Remote branch: `integration/raven-stability-20260824`
- Remote branch SHA: `f74c67780c438e74bb56506b17ef10b3aa0b359d`
- Remote tag SHA: `f74c67780c438e74bb56506b17ef10b3aa0b359d`
- Build: SUCCESS
- Tests: 49/51; the two failures are known `rendered-html.test.mjs` environment/fixture failures
- Fresh local D1 migration chain: SUCCESS
- Reel regression: SUCCESS
- SNS config boundary: SUCCESS

## Guild Member Core

- Baseline: `c54e44d3dd5c5377e5ef1800e3a79d92a2f3c1ff`
- Tag: `guild-member-core-baseline-20260824`
- Remote: private `drravenoracle-create/guild-member-core`
- Remote main SHA: `c54e44d3dd5c5377e5ef1800e3a79d92a2f3c1ff`
- Remote tag: pushed and verified
- Build: SUCCESS

## Recovery references

- Raven restore reference: `raven-integrated-baseline-20260824` or the Raven code baseline SHA above.
- Guild Member Core restore reference: `guild-member-core-baseline-20260824` or the baseline SHA above.
- D1 backup: `C:\Users\user\Documents\RavenBackups\raven-d1-pre-opening-phase1-20260824.sql`
- D1 restore has not been executed. Restore must be performed only after explicit approval and a separate production safety review.

## Safety state

- Opening Campaign: NOT STARTED
- Production deployment: UNCHANGED
- Production D1 write/migration: NONE
- Worker/Cron changes: NONE
- SNS/Instagram posting: NONE
- Secrets: not recorded in this manifest
