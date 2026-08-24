# Opening Campaign Phase 1 local D1 fixture

This fixture is local-only. It never uses `--remote` and never copies production data.

```powershell
npm.cmd run fixture:opening-campaign
npm.cmd run test:opening-campaign:fixture
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
.\node_modules\.bin\vinext.cmd build
git diff --check
```

`fixture:opening-campaign` deletes and recreates only `.wrangler/opening-campaign-phase1`, applies every numbered SQL file in `drizzle/` from `0001` through `0027`, and loads `tests/fixtures/opening-campaign-phase1.sql`.

The fixture contains dummy campaign, trial, analytics, and SNS compatibility rows. It contains no production data or secrets.
