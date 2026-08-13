# Blog Engine Operations

Do not run Cloudflare mutations unless `wrangler whoami` shows the Raven account:

- email: `dr.ravenoracle@gmail.com`
- account id: `c7ce2613bf30affed8d2caae0068beb5`

The Raven D1 database is:

- name: `raven-oracle`
- id: `b5d2b96a-c574-47fa-b582-1063b05595bd`

## Apply Migration

```powershell
.\node_modules\.bin\wrangler.cmd d1 execute raven-oracle --remote --file drizzle\0003_blog_engine.sql --config wrangler.toml
```

## API

- `GET /api/blog-engine/dashboard`
- `POST /api/blog-engine/generate`
- `POST /api/blog-engine/status`
- `POST /api/blog-engine/metrics`
- `POST /api/blog-engine/review`
- `POST /api/blog-engine/sns-sync`
- `POST /api/blog-engine/events/process`
- `POST /api/blog-engine/social-metrics`

## Blog x SNS Loop

`article.published` is the main trigger. The event processor creates SNS derivative content for Instagram, X, Facebook, and LINE without directly publishing to those platforms.

Each queued SNS content has a deterministic `tracking_id`, so reprocessing the same event does not duplicate queue rows.

SNS metrics can be posted back through `social-metrics`. Unknown attribution must stay `unknown`; the engine must not guess direct attribution.

## Known Constraint

As of this implementation, `raven.fortunestudios.jp` routing must be verified before any production claim. Do not report public availability until the route returns the expected Blog Engine API responses.
