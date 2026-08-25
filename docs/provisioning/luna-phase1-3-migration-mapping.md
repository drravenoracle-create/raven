# Luna Production Provisioning Phase 1.3 Migration Mapping

This document is a local planning artifact only. It does not export, import,
write, migrate, or alter any production resource.

## Identity rule

- source tenant: `luna-starwind`
- target tenant: `luna-oracle`
- source character: legacy Luna identity
- target character: `luna`
- no implicit Raven fallback
- every transform must record the source tenant and source primary key

## Existing source inventory

The currently readable Luna D1 contains 13 tables. The migration plan is based
on the actual schema and row counts observed read-only:

| Source table | Rows | Classification | Target / disposition |
|---|---:|---|---|
| `analytics_events` | 20 | SHOULD_MIGRATE | `analytics_events` |
| `reading_feedback` | 1 | IMPORT_OPTIONAL | feedback boundary; no direct clean-table equivalent |
| `blog_engine_settings` | 1 | MUST_MIGRATE | `blog_engine_settings` via adapter |
| `blog_engine_articles` | 23 | SHOULD_MIGRATE | `blog_engine_articles`, selective |
| `blog_engine_events` | 72 | IMPORT_OPTIONAL | event adapter or archive |
| `blog_engine_social_contents` | 84 | OPTIONAL | `sns_posts` only after SNS approval; otherwise archive |
| `blog_engine_social_metrics` | 0 | ARCHIVE_ONLY | future SNS metrics/evidence adapter |
| `growth_events` | 0 | MAP_ONLY | preserve lineage; do not convert to Evidence Claims |
| `growth_guardrail_results` | 0 | ARCHIVE_ONLY | preserve safety history separately |
| `growth_executive_briefs` | 0 | ARCHIVE_ONLY | not Hypothesis or Proposal data |
| `blog_engine_article_metrics` | 0 | OPTIONAL | future Blog metrics adapter |
| `blog_engine_improvement_recommendations` | 0 | ARCHIVE_ONLY | no automatic Growth import |
| `blog_engine_optimization_guard` | 0 | OPTIONAL | preserve only if Blog guardrail contract is approved |

`_cf_KV` is Cloudflare internal metadata and is not an application import
source.

## Column and transformation rules

| Source | Target mapping | Required transformation | Unsupported / nullable handling | Verification |
|---|---|---|---|---|
| `analytics_events` | same target table | map tenant; normalize event path/name; retain source id in import map | legacy referrer, campaign, UA and visitor fields go to reviewed metadata or archive; never invent member id | row count, tenant count, min/max timestamp, event/status totals |
| `reading_feedback` | feedback boundary (target table/adapter required) | map tenant and character; preserve rating/comment timestamps | no member id in source; nullable member relation; do not attach to another tenant | count, rating totals, tenant and character checks |
| `blog_engine_settings` | `blog_engine_settings` | map enabled/default author/locale/public URL | scheduler and automation fields require explicit adapter; scheduler remains OFF | one-row tenant uniqueness and setting parity |
| `blog_engine_articles` | `blog_engine_articles` | map slug/title/body/locale/status/published timestamp | SEO, quality scores, JSON metadata and legacy author fields require metadata/archive; unknown status quarantined | count, slug uniqueness, status totals, timestamps |
| `blog_engine_events` | event adapter or archive | map tenant, event type/status, article/source id, timestamps | no forced mapping into Analytics or Growth; preserve unknown fields in archive | count, status totals, article references |
| `blog_engine_social_contents` | `sns_posts` only after approval | map provider/status/locale and source relation | SNS is initially OFF; content/media/schedule fields remain archive-only until SNS schema approval | count, provider/status totals, tenant isolation |
| `blog_engine_social_metrics` | future SNS metrics adapter | preserve metric name/value/time and source relation | no direct clean-table equivalent; no fabricated Evidence | count, metric totals, timestamp range |
| `growth_events` | Growth metric adapter or archive | preserve source lineage, tenant, event type, time | do not convert to Evidence Claim, Hypothesis, Proposal, or Memory automatically | count, tenant, source lineage |
| `growth_guardrail_results` | safety-history archive | preserve guardrail decision and timestamp | no change to current safety rules; no automatic rejection or execution | count, decision totals, tenant isolation |
| `growth_executive_briefs` | archive | preserve brief identity and time | not equivalent to Hypothesis/Proposal; no business action import | count and timestamp range |

## Shared transform rules

1. Remap `luna-starwind` to `luna-oracle` explicitly in every row-bearing
   source. A missing or unknown tenant is quarantined, never defaulted to
   Raven.
2. Remap the character to `luna` only when the source is explicitly identified
   as Luna. Ambiguous rows are quarantined for review.
3. Preserve source timestamps and source IDs. Normalize format only in the
   transformed copy and retain the original value in the import ledger.
4. Use no-overwrite inserts. The uniqueness key is source table + source ID +
   source tenant; duplicates are reported rather than replaced.
5. Unknown statuses are quarantined. Approved status maps are versioned in the
   dry-run output before any future import.
6. Nullable legacy fields remain nullable. Required target fields must be
   filled only from an explicit safe default or the row is rejected.
7. Every dry-run emits counts, rejected-row reasons, timestamp ranges, tenant
   counts, status totals, and referential-integrity results. No production
   export is part of Phase 1.3.

## Dry-run sequence

```text
Legacy D1 remains unchanged
  -> local clean StudioOS D1
  -> transformed copy using explicit identity remap
  -> no-overwrite insert into a disposable local database
  -> count/timestamp/status/integrity comparison
  -> human review
```

No delta sync, cutover, production export, or remote write is authorized by
this document.

## Unresolved differences

- `reading_feedback` has no direct table in the current clean bundle.
- Legacy Blog settings/articles contain richer fields than the clean baseline.
- Blog event/social/growth history has no one-to-one clean target for several
  tables.
- The Member Core production wiring is not proven by the standalone Luna
  runtime; local isolation is passing, but production contract evidence is
  still required.
- Pages deployment metadata has no source commit SHA because Git provider is
  `No`; local source relation is therefore `PROBABLE_MATCH`, not confirmed.
