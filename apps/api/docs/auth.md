# Authentication And Identity

The API now has a production auth abstraction under `app.modules.auth`. It keeps local developer flows working while adding a clear path for first-party password sessions, JWT providers, persisted API keys, workspace membership checks, and RBAC enforcement.

## Modes

- `AUTH_MODE=dev`: local/test mode. `x-user-id` and `x-workspace-id` may provide context. With `AUTH_ENABLED=false`, protected dependencies remain a local pass-through.
- `AUTH_MODE=session`: protected routes require a `Bearer tai_session_*` token created only after a verified user completes `POST /auth/login`.
- `AUTH_MODE=api_key`: protected routes require an API key. Persisted keys are hashed in `auth_api_keys`; the legacy `ADMIN_API_KEY` remains supported.
- `AUTH_MODE=jwt`: protected routes require `Authorization: Bearer <token>` and `AUTH_JWT_ENABLED=true`.
- `AUTH_MODE=mixed`: password sessions are preferred, JWT is accepted next, and API keys are accepted as fallback.

`AUTH_ENABLED=true` remains a compatibility switch for the legacy admin API-key model. For new production deployments, prefer setting `AUTH_MODE` explicitly.

## Settings

- `AUTH_MODE=dev`
- `AUTH_ENABLED=false`
- `AUTH_JWT_ENABLED=false`
- `AUTH_API_KEYS_ENABLED=true`
- `AUTH_PASSWORD_ENABLED=true`
- `AUTH_PASSWORD_SIGNUP_ENABLED=true`
- `AUTH_SESSION_TTL_MINUTES=1440`
- `AUTH_PASSWORD_FAILED_ATTEMPT_LIMIT=8`
- `AUTH_PASSWORD_LOCKOUT_MINUTES=15`
- `AUTH_EMAIL_VERIFICATION_TTL_MINUTES=60`
- `AUTH_EMAIL_RESEND_COOLDOWN_SECONDS=60`
- `AUTH_EMAIL_PROVIDER=disabled`
- `AUTH_PUBLIC_WEB_BASE_URL=http://localhost:3000`
- `AUTH_EMAIL_FROM_ADDRESS=`
- `AUTH_EMAIL_FROM_NAME=QuantRift`
- `RESEND_API_KEY=`
- `RESEND_TIMEOUT_SECONDS=10`
- `AUTH_DEV_USER_EMAIL=`
- `AUTH_DEV_WORKSPACE_ID=`
- `JWT_ISSUER=`
- `JWT_AUDIENCE=`
- `JWT_PUBLIC_KEY=`
- `JWT_ALGORITHM=RS256`
- `API_KEY_HEADER_NAME=x-api-key`
- `USER_CONTEXT_HEADER_NAME=x-user-id`
- `WORKSPACE_CONTEXT_HEADER_NAME=x-workspace-id`

JWT verification currently supports RS256 with a configured PEM public key. OAuth/session providers such as Auth.js, Clerk, Supabase Auth, or a custom issuer should link their provider subject into `auth_identities`.

## Password Sessions

Password credentials are stored in `auth_password_credentials` with Argon2id hashes and never
return raw passwords. Legacy PBKDF2-SHA256 credentials remain verifiable and are rehashed with
Argon2id after the next successful login. Sessions are stored in `auth_sessions` as SHA-256 token
hashes with expiry and revocation state. `POST /auth/register` creates a workspace, admin user,
password credential, and email-verification token, but no session. `POST /auth/login` creates a new
session only for a verified credential. `POST /auth/logout` revokes the supplied bearer token.

New verification tokens are cryptographically random, expire after
`AUTH_EMAIL_VERIFICATION_TTL_MINUTES`, and are stored only as SHA-256 hashes in
`auth_email_verification_tokens`. `POST /auth/email/verify` consumes a token once;
`POST /auth/email/resend` invalidates prior outstanding tokens before issuing a replacement.
Existing password credentials are marked verified by the migration so deployed users retain
access.

Verification delivery uses the `VerificationEmailProvider` interface. Resend is the recommended
production provider. Configure it with:

- `AUTH_EMAIL_PROVIDER=resend`
- `RESEND_API_KEY=re_...`
- `AUTH_PUBLIC_WEB_BASE_URL=https://your-web-app.example`
- `AUTH_EMAIL_FROM_ADDRESS=security@your-verified-domain.example`
- `AUTH_EMAIL_FROM_NAME=QuantRift`
- Optional: `RESEND_TIMEOUT_SECONDS=10`

The API key stays server-side. Each request to Resend uses a verification-token-specific
idempotency key and is marked sent only after Resend returns a successful response containing a
message id. Verify the sender domain in Resend before using its address in production.

SMTP remains supported for existing deployments:

- `AUTH_EMAIL_PROVIDER=smtp`
- `AUTH_PUBLIC_WEB_BASE_URL=https://your-web-app.example`
- `AUTH_EMAIL_FROM_ADDRESS=security@your-domain.example`
- `AUTH_EMAIL_FROM_NAME=QuantRift`
- `AUTH_SMTP_HOST`, `AUTH_SMTP_PORT`, `AUTH_SMTP_USERNAME`, and `AUTH_SMTP_PASSWORD`
- `AUTH_SMTP_USE_TLS=true` for STARTTLS, or `AUTH_SMTP_USE_SSL=true` for implicit TLS, but not both

When the provider is disabled or delivery fails, the API returns
`verification_delivery_failed`; it never claims a message was sent. Staging and production reject
session-mode password signup unless an email provider is configured. Register, login, verify, and
resend have dedicated per-client/per-identifier limits, and resend has a persisted cooldown.
Configure Redis plus the global rate limiter for consistent multi-instance enforcement.

Session management endpoints are available for first-party password sessions:

- `GET /auth/sessions` lists up to 100 authenticated-user session records by default, with `limit` bounded to 200, without exposing token hashes.
- `GET /auth/activity` lists up to 100 authenticated-user activity events by default, with `limit` bounded to 200, without exposing raw IP addresses, user agents, passwords, tokens, or token hashes.
- `POST /auth/sessions/{session_id}/revoke` revokes one session owned by the authenticated user.
- `POST /auth/sessions/revoke-other` revokes the authenticated user's other active sessions while preserving the current bearer session when it can be resolved.
- `POST /auth/password/change` verifies the current password, stores a new Argon2id hash, clears failed-attempt lock state after a valid current password, and can revoke other active sessions while keeping the current session.

These endpoints require a password-session identity. API keys and legacy admin keys are intentionally not a substitute for user-session and password management.

`PATCH /auth/profile` updates only the authenticated user's display name. It cannot change email,
role, workspace, permissions, credential ownership, or another user's profile.

## Activity Audit

Authentication activity is persisted in `auth_activity_events` for account traceability. The event log records bounded metadata for registration, login, logout, password changes, session revocation, and API-key administration events. It stores request IDs plus SHA-256 hashes of client host and user agent values for correlation without storing raw network identifiers. It never stores passwords, session tokens, API keys, raw token hashes, request bodies, or provider secrets.

Use a pooled Neon Postgres `DATABASE_URL` and run Alembic migrations before enabling
`AUTH_MODE=session` in deployed environments. The Next.js web layer keeps the raw session token in
an HTTP-only cookie, attaches it to server-rendered API reads, and proxies browser requests without
exposing the token to browser JavaScript.

## API Keys

Persisted API keys store only `key_hash` and `key_prefix`. The raw key is returned once from `POST /auth/api-keys`.

API-key statuses are `active`, `disabled`, `revoked`, and `expired`. Keys may be workspace-scoped or global. Scopes can contain permission names such as `scans.write`; `*` grants admin-equivalent access.

## Identity And Workspace Isolation

The current identity resolves to a user, workspace, provider subject, API key, scopes, and permissions. Workspace access is denied when the request workspace does not match the resolved user workspace or workspace-scoped API key.

`GET /auth/me` returns the resolved identity. `GET /auth/context` returns auth mode/settings metadata safe for clients.

## Safety Boundary

This auth layer only protects market-intelligence APIs. It does not add broker execution, copy trading, auto-trading, external signal delivery, or financial-advice behavior.
