from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.modules.billing.catalog import PLANS, Plan, PlanKey
from app.modules.billing.models import BillingAccount, BillingRollout
from app.modules.workspaces.models import Workspace


@dataclass(frozen=True)
class Entitlement:
    plan: Plan
    status: str
    period_start: datetime | None = None
    period_end: datetime | None = None
    transition_ends_at: datetime | None = None


async def activate_billing(session: AsyncSession) -> BillingRollout:
    await session.execute(insert(BillingRollout).values(
        key="launch", activated_at=utc_now(),
    ).on_conflict_do_nothing(index_elements=["key"]))
    rollout = await session.get(BillingRollout, "launch")
    if rollout is None:
        raise AppError(503, "billing_activation_failed", "Billing is unavailable.")
    return rollout


async def billing_account(
    session: AsyncSession, workspace_id: UUID, *, lock: bool = False,
    livemode: bool | None = None,
) -> BillingAccount:
    account = await session.get(BillingAccount, workspace_id)
    if account is None:
        await session.execute(insert(BillingAccount).values(
            workspace_id=workspace_id, plan="free", status="none", cancel_at_period_end=False,
            livemode=bool(livemode),
        ).on_conflict_do_nothing(index_elements=["workspace_id"]))
    statement = select(BillingAccount).where(BillingAccount.workspace_id == workspace_id)
    if lock:
        statement = statement.with_for_update().execution_options(populate_existing=True)
    account = await session.scalar(statement)
    if account is None:
        raise AppError(404, "billing_account_missing", "Workspace billing was not found.")
    if livemode is not None and account.livemode != livemode:
        if account.customer_id is not None:
            raise AppError(409, "billing_mode_mismatch", "This workspace belongs to a different Stripe environment.")
        account.livemode = livemode
    return account


def project_entitlement(
    account: BillingAccount | None, workspace_created_at: datetime,
    activated_at: datetime | None, now: datetime,
) -> Entitlement:
    if account is not None and account.subscription_id is not None:
        if (
            account.status == "active" and account.plan in {"pro", "team"}
            and account.paid_through is not None and account.paid_through > now
            and account.period_start is not None and account.period_end is not None
            and account.period_start <= now < account.period_end
        ):
            return Entitlement(
                PLANS[cast(PlanKey, account.plan)], account.status,
                account.period_start, account.period_end,
            )
        if account.paid_through is not None:
            return Entitlement(PLANS["free"], account.status)
    if activated_at is not None and workspace_created_at < activated_at:
        end = activated_at + timedelta(days=30)
        if now < end:
            return Entitlement(PLANS["pro"], "transition", activated_at, end, end)
    return Entitlement(PLANS["free"], "free")


async def entitlement(
    session: AsyncSession, workspace_id: UUID, settings: Settings,
) -> Entitlement:
    workspace = await session.get(Workspace, workspace_id)
    if workspace is None:
        raise AppError(404, "workspace_not_found", "Workspace was not found.")
    rollout = await session.get(BillingRollout, "launch")
    account = await session.get(BillingAccount, workspace_id, populate_existing=True)
    if account is not None and account.livemode != settings.stripe_live_mode:
        account = None
    return project_entitlement(
        account, workspace.created_at,
        rollout.activated_at if rollout is not None and settings.billing_enabled else None,
        utc_now(),
    )


def stripe_datetime(value: object) -> datetime | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return datetime.fromtimestamp(value, UTC)
    return None
