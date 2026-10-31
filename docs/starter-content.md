# Default starter research

New and existing empty research workspaces automatically receive editable starter content on their
first product visit. Existing candle data is detected before preparation; populated workspaces
are left unchanged. This is available to authenticated accounts by default, with workspace-write
permission required to initialize it. Read-only members can use content prepared by their owner.

## Included examples

- BTC/USDT and ETH/USDT synthetic candle history for all seven supported timeframes.
- A watchlist, scan configuration, research preferences, and a recorded deterministic scan.
- Hourly analysis runs, calculated indicators, signals, setup context, outcomes, historical-case
  vectors, and dashboard read models through existing services.
- A journal entry, persisted daily brief, and a private browser research-note example.
- A visible workspace notice and chart/screenshot watermark identifying synthetic sample history.

Signals and outcomes are calculated from sample candles; they are not fabricated live-market
claims. AI generation remains explicit and credit-controlled. No fake AI responses, identity
information, billing records, secrets, credentials, or external notifications are created.

## Lifecycle

`GET /workspaces/{workspace_id}/starter-content` returns status and progress.
`POST` on the same route with `action=prepare` advances one bounded preparation step; `disable`
records an opt-out. The browser initiates preparation, displays progress, and reloads once ready.
Records are workspace-scoped. A durable lease prevents concurrent tabs from preparing the same
step. Failed or interrupted setup resumes; completed or disabled setup never automatically reruns,
including after users edit or remove example records. Declining setup preserves any partial sample
records already prepared; it does not delete data.

Watchlist items, preferences, source configuration, journal entries, and browser notes can be
changed through existing product controls. Historical OHLC records keep the existing immutable
final-candle rules; connect/import another source to replace the chart's example data. The sample
scan pauses after its initial run so onboarding does not start recurring background work.

## Deployment

Run the new Alembic migration before deploying the API:

```sh
cd apps/api
.venv/bin/python -m alembic upgrade head
```

Revision: `202611011600_starter_content`; parent: `202611010900_workspace_billing`.
`STARTER_CONTENT_ENABLED=true` is the default; setting it to `false` disables automatic setup.
The older developer-only `/demo-mode` endpoints retain their existing restrictions and behavior.
No special worker, provider key, or paid AI request is required for starter preparation.

The migration was applied to the configured Neon database on 2026-11-01; Alembic current
confirmed `202611011600_starter_content (head)`. No sample records were generated during publication.
No tests, builds, or browser checks were run, per the user's instruction. Tests were added for
source isolation, synthetic OHLC validity, existing-data preservation, and concurrent-tab leases.
