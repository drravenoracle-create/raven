# Growth Engine Operations

## Migration

Apply only to the Raven D1 database under the Raven Cloudflare account after confirming Wrangler identity:

```powershell
.\node_modules\.bin\wrangler.cmd whoami --config wrangler.toml
.\node_modules\.bin\wrangler.cmd d1 execute raven-oracle --remote --file drizzle\0004_growth_engine_sb.sql --config wrangler.toml
.\node_modules\.bin\wrangler.cmd d1 execute raven-oracle --remote --file drizzle\0005_growth_engine_v2_v3.sql --config wrangler.toml
```

Expected Raven account:

- email: `dr.ravenoracle@gmail.com`
- account id: `c7ce2613bf30affed8d2caae0068beb5`
- D1: `raven-oracle`

## Provider Status

GA4, Search Console, Cloudflare Analytics, booking, payment, and LINE providers require future server-side adapters and secrets. Do not store provider tokens in code or return them to the frontend.

## Rollback

The migration is additive. A production rollback should disable `growth_engine_settings.enabled` or specific feature flags first. Dropping tables is not part of normal rollback because it would remove collected data.

For v3.0 autonomous actions, enable the tenant kill switch in `growth_kill_switches` before investigating external-action incidents. The kill switch must stop new external actions while allowing analysis when `allow_analysis = 1`.

## External Analytics Connectors

Implemented endpoints:

- `POST /api/growth-engine/external-sync`
- `GET /api/growth-engine/external-sync`
- `/api/analytics/summary` includes `externalMetrics` and `externalConnectors`

The sync endpoint reads provider credentials only from Cloudflare environment variables or Secrets. Do not commit these values.

Required Secrets / variables:

- `GA4_PROPERTY_ID`: GA4 numeric property id, without `properties/`.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Google service account client email.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Google service account private key. Store the full PEM as a secret; escaped `\n` is supported.
- `SEARCH_CONSOLE_SITE_URL`: Search Console property URL. Default fallback is `https://raven.fortunestudios.jp/`.
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Analytics GraphQL read permission for the Raven zone.
- `CLOUDFLARE_ZONE_ID`: Cloudflare zone id for `fortunestudios.jp`.

Required Google-side setup:

- Add the service account email as a viewer to the GA4 property.
- Add the same service account email as a restricted/full user to the Search Console property.

Manual sync:

```powershell
curl.exe -L -X POST https://raven.fortunestudios.jp/api/growth-engine/external-sync -H "Content-Type: application/json" --data-raw "{\"tenantId\":\"raven-oracle\",\"days\":30}"
```

When credentials are missing, connectors stay visible with `not_configured` and no external metric rows are written. When provider calls fail, `sync_status` becomes `error` and `last_error` is saved in `growth_data_connectors`.
