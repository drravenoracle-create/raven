# Production D1 Controlled Migration Ledger

## Production database

- Database: `raven-oracle`
- Database ID: `b5d2b96a-c574-47fa-b582-1063b05595bd`
- Verified Worker: `4e02e899-7ee7-4f9a-8340-cfb8ef1b94e4`
- Applied: 2026-08-25
- Mode: `INSTALLED / READ-ONLY / HUMAN-CONTROLLED`

## Controlled Growth Intelligence migrations

| Migration | Status | Reapply |
| --- | --- | --- |
| `0028_growth_evidence_registry.sql` | APPLIED | FORBIDDEN |
| `0029_growth_hypotheses.sql` | APPLIED | FORBIDDEN |
| `0030_growth_proposals.sql` | APPLIED | FORBIDDEN |
| `0031_growth_proposal_experiment_link.sql` | APPLIED | FORBIDDEN |
| `0032_growth_memory_precision.sql` | APPLIED | FORBIDDEN |

IMPORTANT: Production D1 uses a legacy migration history different from the
repository migration chain. Do not run repository migrations `0001-0032`
against Production with `wrangler d1 migrations apply`. Migrations `0028-0032`
were applied as controlled schema changes and must not be applied again.

## Pre-Growth backup

- File: `C:\Users\user\Documents\RavenBackups\raven-d1-pre-growth-intelligence-20250825.sql`
- Size: 6,152,705 bytes
- SHA256: `F35E46F747AD545708F61EC61290EB21C58B5E24D3867EAAEA05D083BCC31B6B`
- Local restore verification: SUCCESS
- Backup contains no separately recorded personal data; do not commit or overwrite it.

## Verification

Production schema was verified after the controlled migration. The following
tables and required columns are present:

- Evidence: `growth_evidence_sources`, `growth_evidence_claims`
- Hypothesis: `growth_hypotheses`
- Proposal: `growth_proposals`
- Experiment links: `growth_experiments.proposal_id`, `hypothesis_id`,
  `risk_class`, `market`, `country`, `locale`, `requires_start_approval`
- Memory: Phase 6 columns on `growth_knowledge_items`,
  `growth_memory_relations`
- Precision: `growth_precision_snapshots`

Existing Opening Campaign, Blog, SNS, Analytics, and Growth data remained
unchanged. No Growth Intelligence rows were created during acceptance.

## Future migration procedure

For every future Growth migration, use the actual schema and this ledger as
the source of truth:

1. Read this ledger.
2. Inspect the actual Production schema.
3. Export D1 and verify the checksum.
4. Compare the required schema with the actual schema.
5. Apply only missing controlled changes after separate approval.
6. Verify data counts and existing feature tables.
7. Deploy the matching code after a clean preflight.
8. Run read-only smoke tests.

Migration numbers alone do not establish Production state. Even migrations
`0033+` must be compared against the actual schema and ledger before any
operation.

