import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4
from typing import NoReturn

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.errors import AppError
from app.modules.auth.mfa.crypto import (
    MfaVault, new_recovery_codes, new_totp_secret, provisioning_uri, token_hash,
    valid_totp_counter,
)
from app.modules.auth.mfa.models import AuthMfaChallenge, AuthMfaFactor, AuthMfaRecoveryCode
from app.modules.auth.mfa.schemas import (
    AuthMfaChallengeRead, AuthMfaSessionRead, AuthMfaSetupRead, AuthMfaStatusRead,
)
from app.modules.auth.identity import identity_to_read
from app.modules.auth.models import AuthIdentityStatus, AuthPasswordCredential, AuthSession, AuthSessionStatus
from app.modules.users.models import User
from app.modules.workspaces.models import Workspace


@dataclass(frozen=True)
class ChallengeContext:
    credential: AuthPasswordCredential
    factor: AuthMfaFactor
    challenge: AuthMfaChallenge


class MfaService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    def vault(self) -> MfaVault:
        key = self.settings.auth_mfa_encryption_key
        if key is None or not key.get_secret_value():
            raise AppError(503, "mfa_unavailable", "Authenticator verification is unavailable")
        return MfaVault(key.get_secret_value())

    async def begin(self, credential: AuthPasswordCredential) -> AuthMfaChallengeRead | None:
        factor = await self.session.get(AuthMfaFactor, credential.id)
        if not self.settings.auth_mfa_required and (factor is None or factor.enabled_at is None):
            return None
        self.vault()
        await self.session.execute(
            insert(AuthMfaFactor).values(
                credential_id=credential.id, user_id=credential.user_id,
                workspace_id=credential.workspace_id, version=1, failed_attempts=0,
            ).on_conflict_do_nothing(index_elements=["credential_id"])
        )
        factor = (await self.session.execute(
            select(AuthMfaFactor).where(AuthMfaFactor.credential_id == credential.id)
            .with_for_update().execution_options(populate_existing=True)
        )).scalar_one()
        self.check_lock(factor)
        result = await self.issue(credential, factor, "verify" if factor.enabled_at else "enroll")
        await self.session.commit()
        return result

    def check_lock(self, factor: AuthMfaFactor) -> None:
        if factor.locked_until and factor.locked_until > datetime.now(UTC):
            raise AppError(423, "mfa_locked", "Too many attempts. Try signing in again later.")
        if factor.locked_until:
            factor.failed_attempts = 0
            factor.locked_until = None

    async def issue(
        self, credential: AuthPasswordCredential, factor: AuthMfaFactor, purpose: str,
    ) -> AuthMfaChallengeRead:
        now = datetime.now(UTC)
        await self.session.execute(
            update(AuthMfaChallenge).where(
                AuthMfaChallenge.credential_id == credential.id,
                AuthMfaChallenge.consumed_at.is_(None),
            ).values(consumed_at=now, secret_ciphertext=None)
        )
        await self.session.execute(delete(AuthMfaChallenge).where(
            AuthMfaChallenge.credential_id == credential.id,
            AuthMfaChallenge.expires_at < now - timedelta(days=7),
        ))
        token = secrets.token_urlsafe(32)
        challenge = AuthMfaChallenge(
            id=uuid4(), credential_id=credential.id, workspace_id=credential.workspace_id,
            token_hash=token_hash(token), password_fingerprint=token_hash(credential.password_hash),
            purpose=purpose, factor_version=factor.version, attempts=0,
            expires_at=now + timedelta(seconds=self.settings.auth_mfa_challenge_seconds),
        )
        if purpose != "verify":
            challenge.secret_ciphertext = self.vault().encrypt(
                new_totp_secret(), self.challenge_context(challenge),
            )
        self.session.add(challenge)
        await self.session.flush()
        return AuthMfaChallengeRead(
            next_action="verify" if purpose == "verify" else "enroll",
            challenge_token=token, expires_at=challenge.expires_at,
        )

    async def context(self, token: str) -> ChallengeContext:
        if not self.settings.auth_password_enabled:
            raise AppError(404, "password_auth_disabled", "Password authentication is disabled")
        if len(token) != 43 or not all(char.isascii() and (char.isalnum() or char in "-_") for char in token):
            raise self.expired()
        challenge_id = (await self.session.execute(select(
            AuthMfaChallenge.id, AuthMfaChallenge.credential_id,
        ).where(AuthMfaChallenge.token_hash == token_hash(token)))).one_or_none()
        if challenge_id is None:
            raise self.expired()
        credential = (await self.session.execute(select(AuthPasswordCredential).where(
            AuthPasswordCredential.id == challenge_id.credential_id,
        ).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
        factor = (await self.session.execute(select(AuthMfaFactor).where(
            AuthMfaFactor.credential_id == challenge_id.credential_id,
        ).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
        challenge = (await self.session.execute(select(AuthMfaChallenge).where(
            AuthMfaChallenge.id == challenge_id.id,
        ).with_for_update().execution_options(populate_existing=True))).scalar_one()
        now = datetime.now(UTC)
        if (
            credential is None or factor is None or challenge.consumed_at is not None
            or challenge.expires_at <= now or challenge.factor_version != factor.version
            or credential.workspace_id != challenge.workspace_id
            or factor.workspace_id != credential.workspace_id or factor.user_id != credential.user_id
            or credential.status != AuthIdentityStatus.ACTIVE.value
            or credential.email_verified_at is None
            or not hmac.compare_digest(challenge.password_fingerprint, token_hash(credential.password_hash))
            or (credential.locked_until is not None and credential.locked_until > now)
        ):
            challenge.consumed_at = now
            challenge.secret_ciphertext = None
            await self.session.commit()
            raise self.expired()
        self.check_lock(factor)
        self.vault()
        return ChallengeContext(credential, factor, challenge)

    async def status(self, token: str) -> AuthMfaStatusRead:
        context = await self.context(token)
        return AuthMfaStatusRead(
            next_action="verify" if context.challenge.purpose == "verify" else "enroll",
            expires_at=context.challenge.expires_at,
        )

    async def setup(self, token: str) -> AuthMfaSetupRead:
        context = await self.context(token)
        if context.challenge.purpose == "verify" or not context.challenge.secret_ciphertext:
            raise AppError(409, "mfa_setup_unavailable", "This account already has an authenticator")
        secret = self.decrypt(context.challenge.secret_ciphertext, self.challenge_context(context.challenge))
        return AuthMfaSetupRead(
            secret=secret, issuer=self.settings.auth_mfa_issuer,
            otpauth_uri=provisioning_uri(context.credential.email, secret, self.settings.auth_mfa_issuer),
        )

    async def verify(self, token: str, code: str) -> AuthMfaSessionRead:
        from app.modules.auth.passwords import PasswordAuthService

        context = await self.context(token)
        credential, factor, challenge = context.credential, context.factor, context.challenge
        enrolling = challenge.purpose != "verify"
        ciphertext = challenge.secret_ciphertext if enrolling else factor.secret_ciphertext
        if not ciphertext:
            raise self.expired()
        secret = self.decrypt(
            ciphertext, self.challenge_context(challenge) if enrolling else self.factor_context(factor),
        )
        counter = valid_totp_counter(
            secret, code, datetime.now(UTC).timestamp(), None if enrolling else factor.last_counter,
        )
        if counter is None:
            await self.failed(context)
        user = await self.session.get(User, credential.user_id)
        workspace = await self.session.get(Workspace, credential.workspace_id)
        if user is None or workspace is None or user.workspace_id != workspace.id:
            raise self.expired()
        now = datetime.now(UTC)
        recovery_codes: list[str] | None = None
        if enrolling:
            factor.version += 1
            factor.secret_ciphertext = self.vault().encrypt(secret, self.factor_context(factor))
            factor.enabled_at = now
            await self.revoke_sessions(credential)
            await self.session.execute(delete(AuthMfaRecoveryCode).where(
                AuthMfaRecoveryCode.credential_id == credential.id,
            ))
            recovery_codes = new_recovery_codes()
            self.session.add_all([
                AuthMfaRecoveryCode(
                    credential_id=credential.id, workspace_id=credential.workspace_id,
                    code_hash=self.vault().recovery_hash(credential.id, recovery_code),
                ) for recovery_code in recovery_codes
            ])
        factor.last_counter = counter
        factor.failed_attempts = 0
        factor.locked_until = None
        credential.last_login_at = now
        challenge.consumed_at = now
        challenge.secret_ciphertext = None
        created = await PasswordAuthService(self.session, self.settings).create_session(
            user=user, workspace=workspace, mfa_version=factor.version,
        )
        await self.session.commit()
        return AuthMfaSessionRead(
            access_token=created.token, expires_at=created.expires_at,
            identity=identity_to_read(created.identity), recovery_codes=recovery_codes,
        )

    async def recover(self, token: str, code: str) -> AuthMfaChallengeRead:
        context = await self.context(token)
        credential, factor, challenge = context.credential, context.factor, context.challenge
        if challenge.purpose != "verify" or factor.enabled_at is None or not factor.secret_ciphertext:
            raise AppError(409, "mfa_recovery_unavailable", "Recovery is unavailable for this sign-in")
        recovery = (await self.session.execute(select(AuthMfaRecoveryCode).where(
            AuthMfaRecoveryCode.credential_id == credential.id,
            AuthMfaRecoveryCode.workspace_id == credential.workspace_id,
            AuthMfaRecoveryCode.code_hash == self.vault().recovery_hash(credential.id, code),
            AuthMfaRecoveryCode.used_at.is_(None),
        ).with_for_update())).scalar_one_or_none()
        if recovery is None:
            await self.failed(context)
        secret = self.decrypt(factor.secret_ciphertext, self.factor_context(factor))
        recovery.used_at = datetime.now(UTC)
        factor.version += 1
        factor.secret_ciphertext = self.vault().encrypt(secret, self.factor_context(factor))
        factor.failed_attempts = 0
        factor.locked_until = None
        await self.revoke_sessions(credential)
        result = await self.issue(credential, factor, "replace")
        await self.session.commit()
        return result

    async def cancel(self, token: str) -> None:
        try:
            context = await self.context(token)
        except AppError as error:
            if error.status_code in (401, 423):
                return
            raise
        context.challenge.consumed_at = datetime.now(UTC)
        context.challenge.secret_ciphertext = None
        await self.session.commit()

    async def failed(self, context: ChallengeContext) -> NoReturn:
        context.challenge.attempts += 1
        context.factor.failed_attempts += 1
        if context.factor.failed_attempts >= self.settings.auth_mfa_failed_attempt_limit:
            context.factor.locked_until = datetime.now(UTC) + timedelta(
                seconds=self.settings.auth_mfa_lockout_seconds,
            )
            context.challenge.consumed_at = datetime.now(UTC)
            context.challenge.secret_ciphertext = None
        locked = context.factor.locked_until is not None
        await self.session.commit()
        if locked:
            raise AppError(423, "mfa_locked", "Too many attempts. Try signing in again later.")
        raise AppError(401, "mfa_code_invalid", "That code is invalid or already used. Try a fresh code.")

    async def revoke_sessions(self, credential: AuthPasswordCredential) -> None:
        await self.session.execute(update(AuthSession).where(
            AuthSession.user_id == credential.user_id,
            AuthSession.status == AuthSessionStatus.ACTIVE.value,
        ).values(status=AuthSessionStatus.REVOKED.value))

    def decrypt(self, ciphertext: str, context: str) -> str:
        try:
            return self.vault().decrypt(ciphertext, context)
        except ValueError:
            raise AppError(503, "mfa_unavailable", "Authenticator verification is unavailable") from None

    @staticmethod
    def challenge_context(challenge: AuthMfaChallenge) -> str:
        return f"challenge:{challenge.workspace_id}:{challenge.credential_id}:{challenge.id}"

    @staticmethod
    def factor_context(factor: AuthMfaFactor) -> str:
        return f"factor:{factor.workspace_id}:{factor.credential_id}:{factor.version}"

    @staticmethod
    def expired() -> AppError:
        return AppError(401, "mfa_challenge_expired", "This sign-in has expired. Sign in again to continue.")
