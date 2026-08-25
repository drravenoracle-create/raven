# StudioOS clean tenant schema bundle

This directory contains a derived, local-only provisioning baseline for a new
StudioOS tenant. It is not a replacement for Raven's immutable migrations and
must not be applied to a remote D1 from this repository.

The bundle intentionally contains no Raven content, campaign seed, SNS history,
blog articles, or Growth data. Tenant identity rows are safe metadata fixtures
only. The bundle version is independent from `tenantSchemaVersion = 1`.

Dependency graph:

```text
core metadata
├── member boundary fixture
├── analytics
├── blog
├── sns (optional runtime tables)
│   └── reel (optional runtime tables)
└── growth (read-only / human-controlled tables)
```

`clean-luna.sql` is idempotent and is intended for a fresh local SQLite/D1
validation only. Opening Campaign runtime tables are intentionally excluded;
Luna launches with Campaign and Trial disabled.
