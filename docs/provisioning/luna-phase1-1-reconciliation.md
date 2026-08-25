# Luna Production Provisioning Phase 1.1

## Result

Phase 1.1 is **CONDITIONAL GO for local validation**, not a production
provisioning approval. No Worker, D1, R2, DNS, route, secret, OAuth, or
production data was changed.

## Existing Luna reconciliation

The existing source at `C:\dev\Projects\Fm003_luna\luna-starwind` is a
standalone, non-Git-managed Luna site/runtime candidate. Its local configuration
references a Pages-style project named `luna-starwind`, a cron Worker named
`luna-starwind-cron`, and D1 `luna-starwind-analytics`. The source also uses the
legacy tenant identifier `luna-starwind`.

Classification for this phase:

| Asset | Classification | Reason |
|---|---|---|
| Existing Luna UI/branding/content | KEEP | Preserve until provenance and parity are verified |
| Existing Pages/cron source | KEEP + ADAPT candidate | Not yet connected to StudioOS runtime |
| Existing D1/data | KEEP | Account and schema ownership are not yet verified |
| Existing analytics/cron integrations | KEEP | Read-only inventory only |
| Existing domain | KEEP | Do not claim ownership or change routing |
| Replacement runtime | FUTURE | Requires a separate migration plan |

Recommended strategy is `SIDE_BY_SIDE_MIGRATION`: keep the existing site as
the legacy runtime, validate a StudioOS runtime locally, then plan an explicit
data and domain migration only after ownership evidence exists.

## Cloudflare account status

The existing Luna configuration identifies account candidate
`180ff3a8ba4e7e718e35eedcfa9c1290`. The currently authenticated Wrangler
accounts cannot read that account's Pages, Worker, or D1 resources. Status:

- configured account candidate: `ACCOUNT_FOUND`
- current access: `ACCOUNT_NOT_ACCESSIBLE`
- ownership: `OWNERSHIP_UNKNOWN`

No ownership is inferred from the local configuration. The minimum external
follow-up is access to the correct Cloudflare account, or owner confirmation for
the Pages project, cron Worker, D1, zone, and domain.

## Canonical identity

The StudioOS canonical identity is:

```text
characterId: luna
tenantId: luna-oracle
guildId: raven-guild
legacy alias: luna-starwind
```

`luna-starwind` remains a legacy project/D1/runtime identifier. It is not a
Raven fallback and must only resolve through an explicit alias to
`luna-oracle`. URL, branding, Worker name, D1 name, character ID, and tenant ID
remain separate concepts.

## Local runtime adapter

`app/lib/studioos-runtime-adapter.ts` provides a local-only mapping:

```text
raven.fortunestudios.jp -> raven-oracle
luna.fortunestudios.jp  -> luna-oracle
luna-starwind            -> luna-oracle (legacy alias)
unknown                  -> explicit error
```

The adapter resolves the canonical tenant through the Pilot resolver and checks
Character Core, Localization, Entitlement, and Analytics/Blog/SNS/Reel/Growth
slice tenant IDs. It is intentionally not wired into the production worker or
the existing Luna standalone runtime in this phase.

## Clean D1 bundle

`studioos/schema/clean-luna.sql` is an idempotent local-only derived bundle.
It contains clean tenant metadata, member boundary fixture, Analytics, Blog,
SNS/Reel runtime tables, and read-only/human-controlled Growth tables. It has no
Raven content, campaign seed, SNS history, blog articles, or Growth data.

Opening Campaign tables are excluded because Luna launches with Campaign and
Trial disabled. The bundle's schema version is separate from tenant schema
version `1`.

## Member isolation

`app/lib/studioos-member-isolation-fixture.ts` and
`tests/luna-provisioning-phase1-1.test.mjs` validate the Guild Member Core
contract shape with Raven/Luna fixture rows. Queries require the tenant ID and
cannot return a Raven row for Luna or an unknown tenant. The external Guild
Member Core repository itself was not modified.

## Remaining blockers before Phase 2

1. Obtain read access/ownership evidence for Cloudflare account
   `180ff3a8ba4e7e718e35eedcfa9c1290` and the existing Luna resources.
2. Verify the existing Luna D1 schema/data and establish an import/migration
   plan; do not copy its legacy history blindly.
3. Wire and validate the adapter in a dedicated runtime integration phase;
   this phase only validates the local boundary.
4. Confirm the formal Luna domain zone and route owner.

## Safety boundary

Luna Growth remains read-only and human-controlled:

```text
executionAllowed = false
requiresStartApproval = true
autoStart = false
```

Production provisioning remains not started.
