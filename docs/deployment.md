# Deployment

This project now has production-oriented Docker images for the FastAPI API and Next.js web app.
Production secrets must be injected by the deployment platform, never baked into images.

## Production domain

The canonical web origin is `https://www.quantrift.live`. The apex domain
`https://quantrift.live` redirects to it. Set these Production variables in the corresponding
Vercel projects and use the same API settings for the billing worker:

| Project | Variable | Value |
| --- | --- | --- |
| Web | `NEXT_PUBLIC_SITE_URL` | `https://www.quantrift.live` |
| Web | `NEXT_PUBLIC_AUTH_MODE` | `session` |
| Web | `NEXT_PUBLIC_API_BASE_URL` | `https://ai-trading-agent-api.vercel.app` |
| Web | `WEB_API_PROXY_BASE_URL` | `https://ai-trading-agent-api.vercel.app` |
| API and billing worker | `AUTH_PUBLIC_WEB_BASE_URL` | `https://www.quantrift.live` |
| API | `CORS_ALLOWED_ORIGINS` | `https://www.quantrift.live,https://quantrift.live` |

Redeploy the web and API projects after saving environment changes, and restart the billing
worker. `NEXT_PUBLIC_SITE_URL` is used for canonical metadata, social previews, robots, and
sitemap URLs. `AUTH_PUBLIC_WEB_BASE_URL` controls verification/invitation links and Stripe
checkout/portal return URLs. Keep `NEXT_PUBLIC_API_BASE_URL` and `WEB_API_PROXY_BASE_URL` pointed
at the deployed API origin. Local environment examples retain localhost URLs.

Set `NEXT_PUBLIC_AUTH_MODE=session` before building the web deployment. If it is absent at
build time, browser code falls back to dev mode and sends GET requests directly to the API
without the first-party session. Changing runtime settings alone does not update that bundle.
In session mode, browser requests use `/api/backend/...` on the web origin, where the server
forwards the HttpOnly cookie as a bearer token to the API. Sign in again on the canonical
`www` hostname after changing domains; session cookies are scoped to the hostname that set them.

For sandbox billing on the production domain, keep `STRIPE_LIVE_MODE=false` and use sandbox
keys, prices, and portal configurations. Register the snapshot webhook destination directly at
`https://www.quantrift.live/api/stripe/webhook` and store that destination's signing secret in
`STRIPE_WEBHOOK_SECRET`. See [the billing runbook](billing.md) for events and worker setup.

## API Image

Build from the repository root:

```sh
docker build -f apps/api/Dockerfile -t quantrift-api:latest .
```

The API image:

- Uses a multi-stage Python 3.12 build.
- Installs only runtime dependencies from `apps/api/pyproject.toml`.
- Runs as a non-root user.
- Copies only the API package, Alembic migrations, and Alembic config into the final image.
- Exposes port `8000`.
- Uses `/health/live` for a liveness healthcheck.

Required production environment:

```txt
APP_ENV=production
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
CORS_ALLOWED_ORIGINS=https://www.quantrift.live,https://quantrift.live
AUTH_PUBLIC_WEB_BASE_URL=https://www.quantrift.live
AUTH_ENABLED=true
AUTH_MODE=session
AUTH_PASSWORD_ENABLED=true
AUTH_PASSWORD_SIGNUP_ENABLED=true
```

Optional production environment:

```txt
REDIS_URL=redis://...
RATE_LIMIT_ENABLED=true
WORKER_SUPERVISOR_COMPONENTS=reasoning_actions,notifications,market_scans
```

Run migrations before serving traffic:

```sh
docker run --rm --env-file apps/api/.env quantrift-api:latest alembic upgrade head
```

## Web Image

Build from the repository root:

```sh
docker build \
  -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-api-origin.example \
  --build-arg NEXT_PUBLIC_APP_NAME="QuantRift" \
  --build-arg NEXT_PUBLIC_SITE_URL=https://www.quantrift.live \
  --build-arg NEXT_PUBLIC_REPOSITORY_URL=https://github.com/waqasraza123/quantrift \
  -t quantrift-web:latest .
```

The web image:

- Uses `npm ci` with the committed lockfile.
- Builds Next.js standalone output.
- Runs as the non-root `node` user.
- Exposes port `3000`.

`NEXT_PUBLIC_API_BASE_URL` is public frontend configuration. Do not put secrets in
`NEXT_PUBLIC_*` variables.

Set `NEXT_PUBLIC_AUTH_MODE=session`, `WEB_API_PROXY_BASE_URL` to the API origin, and
`WEB_AUTH_SESSION_COOKIE` to the chosen HTTP-only cookie name at runtime. Leave
`WEB_API_PROXY_ADMIN_API_KEY` unset for production user sessions. The API must receive a pooled
Neon `DATABASE_URL` for runtime traffic. Set `DIRECT_URL` to the direct connection string for the
same Neon branch and database in the migration environment. Alembic prefers `DIRECT_URL`, falling
back to `DATABASE_URL` if it is unset or blank. Migrations must finish before either application
receives traffic.

## Local Production-Like Stack

```sh
make docker-up
```

This starts PostgreSQL, Redis, API, and web with local development-safe credentials. It is not a
production secrets model.

## CI

`.github/workflows/ci.yml` has three jobs:

- `backend`: installs API dev dependencies, runs Ruff, mypy, pytest, and Alembic heads/history.
- `frontend`: installs with `npm ci`, then runs lint, typecheck, and build with mocked public env.
- `docker`: builds API and web production images.

Integration tests are intentionally excluded from default CI. Run them only when
`TEST_DATABASE_URL` points at a disposable database.

## Worker Deployment

The API image can run worker entrypoints by changing the command:

```sh
python -m app.workers.live_feed_worker
python -m app.workers.market_scan_worker
python -m app.workers.supervisor
```

Use separate processes or services for API and workers. Keep worker environment separate from web
public environment. Do not enable provider polling, notification delivery, or LLM providers without
explicit production secrets and operational review.
