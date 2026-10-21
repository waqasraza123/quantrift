from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import AppEnvironment, Settings
from app.core.errors import AppError
from app.modules.auth.email import (
    DisabledVerificationEmailProvider,
    VerificationEmail,
    VerificationEmailDeliveryError,
    VerificationEmailProvider,
)
from app.modules.auth.models import AuthEmailVerificationToken, AuthSession
from app.modules.auth.passwords import PasswordAuthService
from app.modules.auth.verification import (
    EmailVerificationService,
    IssuedEmailVerification,
    deliver_email_verification,
)

pytestmark = pytest.mark.integration


class CapturingEmailProvider(VerificationEmailProvider):
    def __init__(self) -> None:
        self.messages: list[VerificationEmail] = []

    async def send_verification_email(self, email: VerificationEmail) -> None:
        self.messages.append(email)


def auth_settings() -> Settings:
    return Settings(
        _env_file=None,
        app_env=AppEnvironment.TEST,
        auth_mode="session",
        auth_email_resend_cooldown_seconds=0,
        auth_public_web_base_url="https://app.example.test",
    )


@pytest.mark.asyncio
async def test_signup_verification_login_reuse_session_and_logout(
    db_session: AsyncSession,
) -> None:
    settings = auth_settings()
    email = f"verified-{uuid4()}@example.test"
    password = "correct horse battery staple"
    auth_service = PasswordAuthService(db_session, settings)

    registered = await auth_service.register(
        workspace_name="Verification Workspace",
        name="Verification Analyst",
        email=email,
        password=password,
    )

    session_count = await db_session.scalar(select(func.count()).select_from(AuthSession))
    assert session_count == 0
    token_row = await db_session.scalar(
        select(AuthEmailVerificationToken).where(
            AuthEmailVerificationToken.id == registered.verification.token_id
        )
    )
    assert token_row is not None
    assert token_row.token_hash != registered.verification.raw_token

    with pytest.raises(AppError, match="Verify your email") as unverified_error:
        await auth_service.login(email=email, password=password)
    assert unverified_error.value.code == "email_unverified"

    verification_service = EmailVerificationService(db_session, settings)
    verified = await verification_service.verify(registered.verification.raw_token)
    reused = await verification_service.verify(registered.verification.raw_token)
    assert verified.status == "verified"
    assert reused.status == "already_verified"

    created_session = await auth_service.login(email=email, password=password)
    assert created_session.token.startswith("tai_session_")
    assert await auth_service.resolve_session(created_session.token) is not None

    await auth_service.revoke_session(created_session.token)
    assert await auth_service.resolve_session(created_session.token) is None


@pytest.mark.asyncio
async def test_expired_and_replaced_verification_tokens_are_rejected(
    db_session: AsyncSession,
) -> None:
    settings = auth_settings()
    auth_service = PasswordAuthService(db_session, settings)
    registered = await auth_service.register(
        workspace_name="Expired Token Workspace",
        name="Expiry Analyst",
        email=f"expired-{uuid4()}@example.test",
        password="correct horse battery staple",
    )
    token_row = await db_session.get(
        AuthEmailVerificationToken,
        registered.verification.token_id,
    )
    assert token_row is not None
    token_row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.commit()

    service = EmailVerificationService(db_session, settings)
    with pytest.raises(AppError) as expired_error:
        await service.verify(registered.verification.raw_token)
    assert expired_error.value.code == "verification_token_expired"

    second = await auth_service.register(
        workspace_name="Resend Workspace",
        name="Resend Analyst",
        email=f"resend-{uuid4()}@example.test",
        password="correct horse battery staple",
    )
    await service.mark_delivery(second.verification.token_id, delivered=True)
    replacement = await service.resend(second.verification.email)
    assert isinstance(replacement, IssuedEmailVerification)
    with pytest.raises(AppError) as invalidated_error:
        await service.verify(second.verification.raw_token)
    assert invalidated_error.value.code == "invalid_verification_token"


@pytest.mark.asyncio
async def test_email_delivery_failure_keeps_account_unverified_and_sessionless(
    db_session: AsyncSession,
) -> None:
    settings = auth_settings()
    email = f"delivery-failure-{uuid4()}@example.test"
    password = "correct horse battery staple"
    auth_service = PasswordAuthService(db_session, settings)
    registered = await auth_service.register(
        workspace_name="Delivery Failure Workspace",
        name="Delivery Failure Analyst",
        email=email,
        password=password,
    )
    verification_service = EmailVerificationService(db_session, settings)

    with pytest.raises(VerificationEmailDeliveryError):
        await deliver_email_verification(
            issued=registered.verification,
            service=verification_service,
            provider=DisabledVerificationEmailProvider(),
        )

    token_row = await db_session.get(
        AuthEmailVerificationToken,
        registered.verification.token_id,
    )
    assert token_row is not None
    assert token_row.delivery_status == "failed"
    with pytest.raises(AppError) as login_error:
        await auth_service.login(email=email, password=password)
    assert login_error.value.code == "email_unverified"
    session_count = await db_session.scalar(
        select(func.count())
        .select_from(AuthSession)
        .where(AuthSession.user_id == token_row.user_id)
    )
    assert session_count == 0


@pytest.mark.asyncio
async def test_resend_delivers_a_new_link_without_exposing_stored_token(
    db_session: AsyncSession,
) -> None:
    settings = auth_settings()
    registered = await PasswordAuthService(db_session, settings).register(
        workspace_name="Resend Delivery Workspace",
        name="Resend Delivery Analyst",
        email=f"resend-delivery-{uuid4()}@example.test",
        password="correct horse battery staple",
    )
    service = EmailVerificationService(db_session, settings)
    await service.mark_delivery(registered.verification.token_id, delivered=True)
    issued = await service.resend(registered.verification.email)
    assert isinstance(issued, IssuedEmailVerification)
    provider = CapturingEmailProvider()
    await deliver_email_verification(issued=issued, service=service, provider=provider)

    assert len(provider.messages) == 1
    delivered_token = parse_qs(urlsplit(provider.messages[0].verification_url).query)["token"][0]
    stored = await db_session.get(AuthEmailVerificationToken, issued.token_id)
    assert stored is not None
    assert stored.delivery_status == "sent"
    assert stored.token_hash != delivered_token
    result = await service.verify(delivered_token)
    assert result.status == "verified"
