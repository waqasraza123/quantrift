# Pricing, subscriptions, and Team workspaces

Billing is opt-in. `BILLING_ENABLED=false` preserves existing research access. The public homepage
and `/pricing` read the same plan catalog from `GET /billing/plans`; no Stripe credentials are
exposed to the browser. `/billing` manages the active workspace's plan and shared AI allowance.
`/team` manages invitations and members. `/invite` accepts an emailed invitation.

| Plan | USD per month | AI credits per billing period | Seats |
| --- | ---: | ---: | ---: |
| Free | 0 | 0 | 1 |
| Pro | 29 | 100 | 1 |
| Team | 79 | 500, shared | 5, including the owner |

Charts, watchlists, scanning, journal entries, and saved research remain core features. AI service
availability is separate from subscription access; purchasing a plan does not configure a provider
or start its worker. Monthly USD subscriptions are the only paid intervals. There are no automatic
overage charges, rollover credits, coupons, or new-customer trials.

## Configure Stripe

The integration uses Stripe Python `16.1.0`, hosted Checkout, and the customer portal. Start in a
Stripe sandbox with a separate development/test database. Keep all configuration below on the API server and billing worker:

```dotenv
AUTH_MODE=session
BILLING_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_TEAM_PRICE_ID=
STRIPE_PORTAL_CONFIGURATION_ID=
STRIPE_PORTAL_PRO_CONFIGURATION_ID=
STRIPE_PORTAL_TEAM_CONFIGURATION_ID=
STRIPE_LIVE_MODE=false
```

Set `AUTH_PUBLIC_WEB_BASE_URL` to the web origin and retain the existing session, database,
verified-email, and optional MFA configuration. Production billing requires HTTPS return URLs.
The Next.js browser proxy forwards the signed-in user's session; it does not add a privileged
admin key to session requests. Billing changes require a verified first-party session and the
workspace owner. An API key cannot purchase or manage a subscription.

From `apps/api`, after installing its dependencies, configure the sandbox secret key and run:

```sh
.venv/bin/python -m app.modules.billing.cli setup
```

This idempotent command creates the `quantrift_workspace_v1` product, the Pro/Team monthly prices
with stable lookup keys, and three portal configurations. It prints price/configuration IDs, never the
secret key. Put those IDs into the corresponding server settings. Reusing an incompatible existing
price fails rather than silently changing the agreed amounts. A retry after a failed portal setup
reuses the product and prices already created. Stripe request errors are reported directly by the
setup command; API responses retain their generic provider error.

The portal supports payment details and invoices, immediate prorated upgrades, period-end
downgrades, and period-end cancellation. Both prices share one product so Stripe can schedule
downgrades. Stripe permits only one monthly price per product in each portal configuration, so
the Pro subscriber configuration offers only the Team price and the Team subscriber configuration
offers only the Pro price. The gateway selects a configuration using the current subscription
price retrieved from Stripe. `STRIPE_PORTAL_CONFIGURATION_ID` provides payment, invoice, and
cancellation management without plan switching for customers without one recognized subscription.
`STRIPE_PORTAL_PRO_CONFIGURATION_ID` is for current Pro subscribers;
`STRIPE_PORTAL_TEAM_CONFIGURATION_ID` is for current Team subscribers. All three are required
before checkout is enabled. Existing subscribers use the portal rather than a second Checkout
subscription.

If setup previously failed with duplicate billing intervals, rerun the command and save all five
returned IDs in the API and billing-worker environment, then restart those processes. Existing
product and price IDs are retained. The new configurations use catalog metadata `v2`; existing
configurations are preserved. Rerunning setup refreshes managed `v2` configurations. Validate both
directions in a Stripe sandbox, including a Pro subscription whose current price is absent from
its portal's target catalog, immediate upgrade payment, and a scheduled Team-to-Pro downgrade.

Register a snapshot webhook endpoint at either:

- The web origin's `/api/stripe/webhook`, which forwards the original bytes and signature.
- The API origin's `/billing/webhook`, including `API_PREFIX` if configured.

Use snapshot API version `2026-10-28.endive`, supported by the pinned Stripe SDK, for the destination. Subscribe to:

```text
checkout.session.completed
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
invoice.paid
invoice.payment_failed
invoice.payment_action_required
```

Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`. The endpoint rejects invalid
signatures and mismatched sandbox/live events. It stores event IDs and bounded object references,
then queues reconciliation. Card details and raw event payloads are not persisted. Reconciliation
retrieves current Stripe subscriptions, so duplicate or reordered deliveries cannot restore an
older plan. Unknown prices or multiple concurrent subscriptions do not grant extra access.

## Migration and activation

Apply revision `202611010900_workspace_billing`, following the existing MFA migration, before
deploying this code. It adds memberships, invitations, billing records, usage reservations, the
verification continuation field, and the billing queue type. It backfills each existing user's
home workspace membership; the earliest administrator becomes owner, with the earliest user as
fallback. Other roles are retained. Existing passwords, MFA secrets, and research stay in place.

```sh
cd apps/api
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/alembic upgrade head
```

Enable `BILLING_ENABLED=true` only when the catalog, webhook, origins, database, and worker are
configured. API startup records the launch cutoff once; registration also ensures it exists
before creating a new workspace. The optional activation command uses the same persisted cutoff:

```sh
.venv/bin/python -m app.modules.billing.cli activate
.venv/bin/python -m app.workers.job_queue_worker --queue billing --concurrency 2
```

Docker deployments can use `docker compose --profile workers up -d billing-worker`.

Workspaces created before the cutoff receive 100 credits over a 30-day Pro transition without a
payment method. New workspaces start on Free. The transition is not restarted by a redeployment.
It does not charge the owner automatically or include Team seats. Paid subscriptions supersede
the grant. Expired grants return to Free while preserving saved research.

After owner-operated sandbox validation, create the catalog in the live account, replace the
server key, price IDs, portal ID, and signing secret, and set `STRIPE_LIVE_MODE=true` together.
Sandbox and live IDs are separate. Workspace billing records are mode-bound; do not reuse a sandbox billing database as the live billing database. No live products, prices, webhooks, subscriptions, or charges
were created during implementation.

## Access, membership, and AI credits

An account retains its original home workspace and credentials. Memberships add access to other
workspaces. Switching validates membership and changes the current session's active workspace;
roles apply within that workspace. Account-wide password changes, session revocation, and MFA
recovery cover sessions in every workspace. Stored research queries are scoped to the authenticated
active workspace. Local development with authentication disabled retains its prior behavior.

Owners and workspace administrators can invite analysts. Invitations reserve seats for seven
days, require the verified recipient's email, and persist only a token hash. Emailed token links
use URL fragments; the browser retains a pending token in session storage while signing in.
If verification opens another browser or tab, reopen the original invitation after signing in.
Expired/revoked invitations cannot be accepted; acceptance is idempotent for an existing member.
Failed delivery revokes the pending invitation to release its seat.

Members and pending invitations cannot exceed the five-seat Team allowance. A legacy workspace
with more members retains its records; only the owner and earliest four memberships can be
active on Team until the owner removes extras. Free/Pro suspend non-owner access without deleting
memberships or data. An active Team subscription restores eligible memberships. Owners cannot
remove themselves; ownership transfer is not part of this release.

One new explanation, reasoning analysis, or intelligence analysis reserves one credit. A paired
analyst/risk review reserves one credit for the entire graph, including its permitted revision.
Ensembles reserve credits per newly generated constituent analysis. Successful results, including
WAIT, consume credits. Failures, cancellation, and blocked output release reservations. Cached
results, duplicate requests, and saved-result reads consume no additional credits.

Reservation records are durable and counted under a workspace billing lock before provider work
starts. Queued setup reviews require their original reservation when the worker begins. Periods
come from Stripe subscription items; an upgrade changes the allowance without resetting usage.
Provider flags, model configuration, existing hourly limits, and grounded-output safeguards still
apply. Past-due, unpaid, paused, or ended subscriptions cannot start paid generation. A failed
initial payment does not erase a still-valid legacy transition.

## Recovery and monitoring

```sh
cd apps/api
.venv/bin/python -m app.modules.billing.cli reconcile
.venv/bin/python -m app.modules.billing.cli reconcile --workspace-id WORKSPACE_UUID
.venv/bin/python -m app.modules.billing.cli release-expired
```

Reconciliation updates subscription state and marks the customer's pending receipts processed.
The expired-reservation command releases abandoned reservations older than their 30-minute lease;
new generation requests also release expired reservations for their workspace. Existing successful
consumption cannot be undone by repeating a failure callback.

Monitor the existing worker heartbeat, failed/dead-letter jobs on the `billing` queue, unprocessed
`billing_events`, stale `last_synced_at`, and HTTP `ai_credits_exhausted`/`subscription_required`
responses. The billing page reports queued Stripe synchronization and lets the owner refresh.
Use the portal to recover a payment method; a Checkout success URL alone never grants access.

## Validation handoff

The user requested implementation without running tests, builds, lint, type checks, migrations,
preview servers, or browser checks. None were run. The Stripe SDK was installed locally. An
isolated temporary PostgreSQL cluster was initialized while preparing the earlier approved test
workflow, but no PostgreSQL server, migrations, or tests were started.

Prepared coverage is in `test_billing.py`, `test_billing_portal.py`,
`test_billing_memberships_integration.py`, and the
pricing browser spec. The integration tests require an explicitly configured disposable
`TEST_DATABASE_URL` and migrate that database through the existing fixture. Never point it at
production. Owner-run commands:

```sh
cd apps/api
.venv/bin/pytest app/tests/unit/test_billing.py app/tests/unit/test_billing_portal.py app/tests/unit/test_auth.py
.venv/bin/pytest -m integration app/tests/test_billing_memberships_integration.py
.venv/bin/pytest -m integration app/tests/test_auth_email_verification_integration.py
.venv/bin/ruff check app/modules/billing app/modules/memberships
.venv/bin/mypy app
cd ../web
npm run typecheck
npm run test:e2e -- tests/e2e/pricing.spec.ts tests/e2e/landing.spec.ts
```

Additionally validate sandbox checkout/3DS, failed payment and recovery, duplicate/reordered
webhooks, upgrade payment before Team access, period-end downgrade/cancellation, concurrent quota
and seat reservations, existing-account invitations, cross-workspace reads/writes and API keys,
session switching/MFA recovery, the 30-day cutoff, and desktop/mobile/keyboard presentation.

Reference: [Stripe subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions),
[portal configuration](https://docs.stripe.com/customer-management/configure-portal), and
[signed webhooks](https://docs.stripe.com/webhooks).
