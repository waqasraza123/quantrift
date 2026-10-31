import asyncio
from datetime import timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.config import AppEnvironment, Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.modules.auth.email import VerificationEmail, VerificationEmailProvider
from app.modules.auth.models import AuthPasswordCredential
from app.modules.auth.passwords import hash_password
from app.modules.billing.gateway import StripeGateway
from app.modules.billing.models import BillingAccount, BillingCheckout, BillingEvent, BillingUsage
from app.modules.billing.service import BillingService
from app.modules.billing.usage import finish_credit, reserve_credit
from app.modules.memberships.models import WorkspaceMembership
from app.modules.memberships.service import MembershipService
from app.modules.users.models import User
from app.modules.workspaces.models import Workspace

pytestmark = pytest.mark.integration


def settings() -> Settings:
    return Settings(_env_file=None, app_env=AppEnvironment.TEST, auth_mode="session",
                    billing_enabled=True, stripe_pro_price_id="price_pro", stripe_team_price_id="price_team")


async def seed_workspace(session: AsyncSession, plan: str = "team") -> tuple[UUID, UUID]:
    workspace = Workspace(id=uuid4(), name="Billing integration workspace")
    session.add(workspace)
    await session.flush()
    user = User(id=uuid4(), workspace_id=workspace.id, email=f"{uuid4()}@example.test",
                name="Owner", role="admin")
    session.add(user)
    await session.flush()
    session.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="owner"))
    session.add(AuthPasswordCredential(
        user_id=user.id, workspace_id=workspace.id, email=user.email,
        password_hash=hash_password("test-only-billing-password"), status="active",
        failed_attempts=0, email_verified_at=utc_now(),
    ))
    now = utc_now()
    session.add(BillingAccount(workspace_id=workspace.id, customer_id=f"cus_{uuid4().hex}",
                               subscription_id=f"sub_{uuid4().hex}", plan=plan, status="active",
                               period_start=now - timedelta(days=1), period_end=now + timedelta(days=29),
                               paid_through=now + timedelta(days=29)))
    await session.commit()
    return workspace.id, user.id


class CapturingEmail(VerificationEmailProvider):
    def __init__(self) -> None:
        self.messages: list[VerificationEmail] = []

    async def send_verification_email(self, email: VerificationEmail) -> None:
        self.messages.append(email)


class FakeStripe(StripeGateway):
    def __init__(self) -> None:
        super().__init__(settings())
        self.sessions: dict[str, dict[str, Any]] = {}

    @property
    def ready(self) -> bool:
        return True

    async def subscriptions(self, customer_id: str) -> list[dict[str, Any]]:
        return []

    async def create_customer(self, workspace_id: UUID, email: str) -> dict[str, Any]:
        return {"id": f"cus_{workspace_id.hex}"}

    async def checkout(self, customer_id: str, plan: str, request_id: UUID,
                       workspace_id: UUID) -> dict[str, Any]:
        key = str(request_id)
        if key not in self.sessions:
            self.sessions[key] = {"id": f"cs_{request_id.hex}", "status": "open",
                                  "url": f"https://checkout.stripe.com/{request_id}",
                                  "expires_at": int((utc_now() + timedelta(hours=1)).timestamp())}
        return self.sessions[key]

    async def retrieve_checkout(self, session_id: str) -> dict[str, Any]:
        return next(value for value in self.sessions.values() if value["id"] == session_id)


@pytest.mark.asyncio
async def test_concurrent_credit_reservations_cannot_exceed_allowance(integration_engine: AsyncEngine) -> None:
    async with AsyncSession(integration_engine, expire_on_commit=False) as session:
        workspace_id, _ = await seed_workspace(session, "pro")
        for _ in range(99):
            session.add(BillingUsage(operation_id=uuid4(), workspace_id=workspace_id,
                                     operation_kind="reasoning", status="consumed",
                                     reserved_until=utc_now() + timedelta(minutes=30)))
        await session.commit()

    async def reserve() -> object:
        async with AsyncSession(integration_engine, expire_on_commit=False) as session:
            await reserve_credit(session, settings(), workspace_id, uuid4(), "reasoning")
        return True

    results = await asyncio.gather(*(reserve() for _ in range(8)), return_exceptions=True)
    assert sum(result is True for result in results) == 1
    assert sum(isinstance(result, AppError) and result.code == "ai_credits_exhausted" for result in results) == 7


@pytest.mark.asyncio
async def test_finished_and_failed_operations_are_idempotent(integration_engine: AsyncEngine) -> None:
    async with AsyncSession(integration_engine, expire_on_commit=False) as session:
        workspace_id, _ = await seed_workspace(session)
        operation_id = uuid4()
        await reserve_credit(session, settings(), workspace_id, operation_id, "setup_review")
        await reserve_credit(session, settings(), workspace_id, operation_id, "setup_review")
        await finish_credit(session, settings(), operation_id, success=True)
        await finish_credit(session, settings(), operation_id, success=False)
        reservation = await session.get(BillingUsage, operation_id)
        assert reservation is not None and reservation.status == "consumed"
        failed_id = uuid4()
        await reserve_credit(session, settings(), workspace_id, failed_id, "reasoning")
        await finish_credit(session, settings(), failed_id, success=False)
        failed = await session.get(BillingUsage, failed_id)
        assert failed is not None and failed.status == "released"


@pytest.mark.asyncio
async def test_existing_user_joins_without_moving_home_workspace(integration_engine: AsyncEngine) -> None:
    async with AsyncSession(integration_engine, expire_on_commit=False) as session:
        workspace_id, owner_id = await seed_workspace(session)
        home_id, invited_id = await seed_workspace(session, "pro")
        invited_user = await session.get(User, invited_id)
        assert invited_user is not None
        provider = CapturingEmail()
        service = MembershipService(session, settings())
        await service.invite(workspace_id, owner_id, invited_user.email, provider)
        token = provider.messages[0].verification_url.split("#token=", 1)[1]
        assert await service.accept(token, invited_user) == workspace_id
        assert await service.accept(token, invited_user) == workspace_id
        assert invited_user.workspace_id == home_id
        membership = await service.require_member(invited_id, workspace_id)
        assert membership.role == "analyst"
        account = await session.get(BillingAccount, workspace_id)
        assert account is not None
        account.status = "canceled"
        await session.commit()
        with pytest.raises(AppError) as suspended:
            await service.require_member(invited_id, workspace_id)
        assert suspended.value.code == "team_membership_suspended"
        assert (await service.require_member(owner_id, workspace_id)).role == "owner"
        account.status = "active"
        await session.commit()
        assert (await service.require_member(invited_id, workspace_id)).role == "analyst"


@pytest.mark.asyncio
async def test_pending_invitations_reserve_seats(integration_engine: AsyncEngine) -> None:
    async with AsyncSession(integration_engine, expire_on_commit=False) as session:
        workspace_id, owner_id = await seed_workspace(session)
        service = MembershipService(session, settings())
        provider = CapturingEmail()
        for _ in range(4):
            await service.invite(workspace_id, owner_id, f"{uuid4()}@example.test", provider)
        with pytest.raises(AppError) as exhausted:
            await service.invite(workspace_id, owner_id, f"{uuid4()}@example.test", provider)
        assert exhausted.value.code == "team_seats_exhausted"


@pytest.mark.asyncio
async def test_checkout_retries_reuse_the_existing_session(integration_engine: AsyncEngine) -> None:
    async with AsyncSession(integration_engine, expire_on_commit=False) as session:
        workspace_id, _ = await seed_workspace(session)
        account = await session.get(BillingAccount, workspace_id)
        assert account is not None
        account.subscription_id = None
        account.status = "none"
        await session.commit()
        gateway = FakeStripe()
        service = BillingService(session, settings(), gateway)
        first = await service.create_checkout(workspace_id, "owner@example.test", "pro", uuid4())
        second = await service.create_checkout(workspace_id, "owner@example.test", "pro", uuid4())
        assert first == second and len(gateway.sessions) == 1
        count = await session.scalar(select(func.count()).select_from(BillingCheckout).where(
            BillingCheckout.workspace_id == workspace_id,
        ))
        assert count == 1


@pytest.mark.asyncio
async def test_duplicate_webhook_is_recorded_once(integration_engine: AsyncEngine) -> None:
    async with AsyncSession(integration_engine, expire_on_commit=False) as session:
        workspace_id, _ = await seed_workspace(session)
        account = await session.get(BillingAccount, workspace_id)
        assert account is not None
        event_id = f"evt_{uuid4().hex}"
        event = {"id": event_id, "type": "invoice.paid", "data": {"object": {
            "id": "in_test", "customer": account.customer_id,
        }}}
        service = BillingService(session, settings(), FakeStripe())
        await service.receive_event(event)
        await service.receive_event(event)
        count = await session.scalar(select(func.count()).select_from(BillingEvent).where(
            BillingEvent.event_id == event_id,
        ))
        assert count == 1
