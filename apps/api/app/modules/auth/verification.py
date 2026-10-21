import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.errors import AppError
from app.modules.auth.email import (
    VerificationEmail,
    VerificationEmailDeliveryError,
    VerificationEmailProvider,
)
from app.modules.auth.models import AuthEmailVerificationToken, AuthPasswordCredential
from app.modules.users.models import User

EMAIL_VERIFICATION_TOKEN_PREFIX = "qrv_"


@dataclass(frozen=True)
class IssuedEmailVerification:
    token_id: UUID
    raw_token: str
    email: str
    recipient_name: str
    expires_at: datetime


@dataclass(frozen=True)
class EmailVerificationResult:
    status: str
    email: str


class EmailVerificationService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    async def issue(
        self,
        *,
        credential: AuthPasswordCredential,
        recipient_name: str,
        enforce_cooldown: bool,
        commit: bool,
    ) -> IssuedEmailVerification:
        now = datetime.now(UTC)
        if credential.email_verified_at is not None:
            raise AppError(409, "email_already_verified", "Email address is already verified")
        latest = await self.latest_token(credential.id)
        if enforce_cooldown and latest is not None and latest.sent_at is not None:
            retry_at = latest.sent_at + timedelta(
                seconds=self.settings.auth_email_resend_cooldown_seconds
            )
            if retry_at > now:
                raise AppError(
                    429,
                    "verification_resend_too_soon",
                    "Please wait before requesting another verification email",
                )
        await self.invalidate_active_tokens(credential.id, now)
        raw_token = generate_email_verification_token()
        expires_at = now + timedelta(minutes=self.settings.auth_email_verification_ttl_minutes)
        token = AuthEmailVerificationToken(
            credential_id=credential.id,
            user_id=credential.user_id,
            workspace_id=credential.workspace_id,
            token_hash=hash_email_verification_token(raw_token),
            delivery_status="pending",
            expires_at=expires_at,
        )
        self.session.add(token)
        await self.session.flush()
        if commit:
            await self.session.commit()
        return IssuedEmailVerification(
            token_id=token.id,
            raw_token=raw_token,
            email=credential.email,
            recipient_name=recipient_name,
            expires_at=expires_at,
        )

    async def resend(self, email: str) -> IssuedEmailVerification | None:
        credential = await self.credential_by_email(email)
        if credential is None:
            return None
        if credential.email_verified_at is not None:
            return None
        user = await self.session.get(User, credential.user_id)
        if user is None:
            return None
        return await self.issue(
            credential=credential,
            recipient_name=user.name,
            enforce_cooldown=True,
            commit=True,
        )

    async def verify(self, raw_token: str) -> EmailVerificationResult:
        token_hash = hash_email_verification_token(raw_token)
        result = await self.session.execute(
            select(AuthEmailVerificationToken)
            .where(AuthEmailVerificationToken.token_hash == token_hash)
            .with_for_update()
        )
        token = result.scalar_one_or_none()
        if token is None:
            raise invalid_verification_token_error()
        credential = await self.session.get(AuthPasswordCredential, token.credential_id)
        if credential is None:
            raise invalid_verification_token_error()
        if credential.email_verified_at is not None:
            return EmailVerificationResult(status="already_verified", email=credential.email)
        now = datetime.now(UTC)
        if token.invalidated_at is not None or token.consumed_at is not None:
            raise invalid_verification_token_error()
        if token.expires_at <= now:
            raise AppError(
                410,
                "verification_token_expired",
                "Verification link has expired",
            )
        credential.email_verified_at = now
        token.consumed_at = now
        await self.invalidate_active_tokens(credential.id, now, exclude_token_id=token.id)
        await self.session.commit()
        return EmailVerificationResult(status="verified", email=credential.email)

    async def mark_delivery(self, token_id: UUID, delivered: bool) -> None:
        token = await self.session.get(AuthEmailVerificationToken, token_id)
        if token is None:
            return
        token.delivery_status = "sent" if delivered else "failed"
        token.sent_at = datetime.now(UTC) if delivered else None
        await self.session.commit()

    async def latest_token(self, credential_id: UUID) -> AuthEmailVerificationToken | None:
        result = await self.session.execute(
            select(AuthEmailVerificationToken)
            .where(AuthEmailVerificationToken.credential_id == credential_id)
            .order_by(AuthEmailVerificationToken.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def credential_by_email(self, email: str) -> AuthPasswordCredential | None:
        normalized_email = email.strip().lower()
        result = await self.session.execute(
            select(AuthPasswordCredential).where(AuthPasswordCredential.email == normalized_email)
        )
        return result.scalar_one_or_none()

    async def invalidate_active_tokens(
        self,
        credential_id: UUID,
        now: datetime,
        exclude_token_id: UUID | None = None,
    ) -> None:
        statement = select(AuthEmailVerificationToken).where(
            AuthEmailVerificationToken.credential_id == credential_id,
            AuthEmailVerificationToken.consumed_at.is_(None),
            AuthEmailVerificationToken.invalidated_at.is_(None),
        )
        if exclude_token_id is not None:
            statement = statement.where(AuthEmailVerificationToken.id != exclude_token_id)
        result = await self.session.execute(statement)
        for token in result.scalars().all():
            token.invalidated_at = now


async def deliver_email_verification(
    *,
    issued: IssuedEmailVerification,
    service: EmailVerificationService,
    provider: VerificationEmailProvider,
) -> None:
    verification_url = build_verification_url(service.settings, issued.raw_token)
    try:
        await provider.send_verification_email(
            VerificationEmail(
                recipient_email=issued.email,
                recipient_name=issued.recipient_name,
                verification_url=verification_url,
                expires_at=issued.expires_at,
            )
        )
    except VerificationEmailDeliveryError:
        await service.mark_delivery(issued.token_id, delivered=False)
        raise
    except Exception as error:
        await service.mark_delivery(issued.token_id, delivered=False)
        raise VerificationEmailDeliveryError("Verification email delivery failed") from error
    await service.mark_delivery(issued.token_id, delivered=True)


def generate_email_verification_token() -> str:
    return f"{EMAIL_VERIFICATION_TOKEN_PREFIX}{secrets.token_urlsafe(48)}"


def hash_email_verification_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_verification_url(settings: Settings, token: str) -> str:
    return f"{settings.auth_public_web_base_url}/verify-email?{urlencode({'token': token})}"


def invalid_verification_token_error() -> AppError:
    return AppError(400, "invalid_verification_token", "Verification link is invalid")
