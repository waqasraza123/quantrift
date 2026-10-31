# Authentication And Identity

The API now has a production auth abstraction under `app.modules.auth`. It keeps local developer flows working while adding a clear path for first-party password sessions, JWT providers, persisted API keys, workspace membership checks, and RBAC enforcement.

## Modes

- `AUTH_MODE=dev`: local/test mode. `x-user-id` and `x-workspace-id` may provide context. With `AUTH_ENABLED=false`, protected dependencies remain a local pass-through.
- `AUTH_MODE=session`: protected routes require a `Bearer tai_session_*` token created only after verified email/password login and, when required, authenticator verification.
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
session only for a verified credential that does not require MFA; otherwise it issues a short-lived MFA challenge. `POST /auth/logout` revokes the supplied bearer token.

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

## Authenticator Verification

The login, signup, and authenticator experience is adapted from the local HVACLine repository.
QuantRift keeps its existing workspace registration fields, Argon2id/legacy password compatibility,
and required email verification. `/signup` aliases `/register`. Auth pages retain HVACLine's
two-column layout with QuantRift's shared deep-teal, mint, and cyan palette; responsive layouts,
password visibility, inline errors, delivery recovery, and safe local return paths are included.

`AUTH_MFA_REQUIRED=false` preserves password-only login for accounts without an enrolled factor.
Set it to `true` to require an authenticator after verified email and password. Already-enrolled
accounts continue requiring their authenticator even if this flag is subsequently disabled.
No session is issued until authenticator verification succeeds. Enabling the requirement rejects
older password-only sessions on their next use; users must sign in and enroll.

Owner rollout steps, not executed during implementation:

1. Install API dependencies from `apps/api/pyproject.toml` and run `npm ci` in `apps/web`.
2. From `apps/api`, run `alembic upgrade head` to apply `202610311600_auth_mfa` before deploying
   the new API. The migration is required even if MFA remains disabled. It adds three MFA tables
   and nullable session-verification columns without modifying existing credentials.
3. Generate a Fernet key with `python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'`.
   Store it in the server secret manager as `AUTH_MFA_ENCRYPTION_KEY`; do not commit it. Use the
   same stable key on every API instance and retain it with database backups.
4. Set `AUTH_MFA_REQUIRED=true` on the API when ready. The web app needs no encryption key or
   new public environment variable. Leave existing email-provider/session configuration in place.
5. Restart the API and web deployment using the usual release procedure.

Additional settings:

| Setting | Default | Purpose |
| --- | --- | --- |
| `AUTH_MFA_ISSUER` | `QuantRift` | Account label in authenticator apps |
| `AUTH_MFA_CHALLENGE_SECONDS` | `600` | Password-to-MFA handoff lifetime; at most ten minutes |
| `AUTH_MFA_FAILED_ATTEMPT_LIMIT` | `5` | Persisted per-account attempt budget |
| `AUTH_MFA_LOCKOUT_SECONDS` | `900` | Lockout duration after exhausting that budget |

`POST /auth/login` may now return `{mfaRequired, nextAction, challengeToken, expiresAt}` instead of
session credentials. The Next.js BFF removes `challengeToken`, keeps it in a short-lived HttpOnly,
SameSite=Strict cookie, and routes the browser to `/mfa`. Production uses a Secure `__Host-`
cookie. It never places session or challenge tokens in browser JSON, URLs, or local storage.

MFA endpoints accept that challenge as a bearer credential, not as an authenticated user session:

- `GET /auth/mfa/status`: current verification/enrollment step and expiry.
- `POST /auth/mfa/setup`: enrollment secret and provisioning URI. The browser renders its QR
  locally, without a third-party QR service.
- `POST /auth/mfa/verify` with `{code}`: consume a fresh six-digit TOTP and create a session.
  Enrollment also returns ten recovery codes once, for the user to save privately.
- `POST /auth/mfa/recover` with `{code}`: consume a recovery code, revoke existing sessions,
  and issue a replacement-enrollment challenge. It does not create a session. Completing the
  replacement rotates all recovery codes.
- `POST /auth/mfa/cancel`: consume the pending challenge without issuing a session.

Secrets are encrypted with Fernet and bound to the credential, workspace, and factor version or
challenge. Recovery codes are stored as keyed hashes. Challenges are stored as hashes, expire,
are invalidated by another login/password change, and have a persistent per-account attempt limit.
TOTP counters are locked and advanced transactionally to reject reuse. Session verification is
bound to the current factor version; enrolling or recovering revokes earlier sessions. Authentication
rate limits and same-origin checks also apply. Keep Redis rate limiting configured for deployment.

Do not remove or replace the encryption key while enrolled accounts exist. Key loss requires an
explicit administrative recovery process; no password-only bypass or implicit factor reset is
provided. Changing this key requires a planned re-encryption/recovery-code rotation migration.
A lost authenticator and all lost recovery codes cannot be recovered through this UI.

Manual owner verification remains outstanding: existing login with the feature off; registration
and verification email; first enrollment; QR and manual-key setup; valid/invalid/expired/reused
codes; lockout; recovery-code reuse and replacement; session revocation; refresh/cancel; mobile and
keyboard navigation; local return-path handling; absence of raw tokens in browser responses.
No tests, builds, lint, type checks, migration runs, preview servers, or live auth calls were executed
for this implementation.

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
