from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.modules.billing.models import BillingUsage
from app.modules.billing.state import Entitlement, billing_account, entitlement


async def usage_counts(
    session: AsyncSession, workspace_id: UUID, access: Entitlement,
) -> tuple[int, int]:
    if access.period_start is None or access.period_end is None:
        return 0, 0
    rows = (await session.execute(select(BillingUsage.status, func.count()).where(
        BillingUsage.workspace_id == workspace_id,
        BillingUsage.created_at >= access.period_start,
        BillingUsage.created_at < access.period_end,
        BillingUsage.status.in_(("reserved", "consumed")),
    ).group_by(BillingUsage.status))).all()
    counts = {str(status): int(count) for status, count in rows}
    return counts.get("consumed", 0), counts.get("reserved", 0)


async def reserve_credit(
    session: AsyncSession, settings: Settings, workspace_id: UUID,
    operation_id: UUID, kind: str,
) -> None:
    if not settings.billing_enabled:
        return
    async with AsyncSession(bind=session.bind, expire_on_commit=False) as ledger:
        await billing_account(ledger, workspace_id, lock=True, livemode=settings.stripe_live_mode)
        await ledger.execute(update(BillingUsage).where(
            BillingUsage.workspace_id == workspace_id, BillingUsage.status == "reserved",
            BillingUsage.reserved_until <= utc_now(),
        ).values(status="released"))
        existing = await ledger.get(BillingUsage, operation_id)
        if existing is not None:
            if existing.workspace_id != workspace_id or existing.operation_kind != kind:
                raise AppError(409, "usage_operation_conflict", "AI operation does not match.")
            if existing.status == "released":
                raise AppError(409, "usage_operation_finished", "Request a new AI analysis.")
            return
        access = await entitlement(ledger, workspace_id, settings)
        used, reserved = await usage_counts(ledger, workspace_id, access)
        if access.plan.credits == 0:
            raise AppError(402, "subscription_required", "Upgrade to Pro or Team to generate AI analysis.")
        if used + reserved >= access.plan.credits:
            raise AppError(429, "ai_credits_exhausted", "Your workspace has used its AI allowance.")
        ledger.add(BillingUsage(
            operation_id=operation_id, workspace_id=workspace_id, operation_kind=kind,
            status="reserved", reserved_until=utc_now() + timedelta(minutes=30),
        ))
        await ledger.commit()


async def finish_credit(
    session: AsyncSession, settings: Settings, operation_id: UUID, *, success: bool,
) -> None:
    if not settings.billing_enabled:
        return
    async with AsyncSession(bind=session.bind, expire_on_commit=False) as ledger:
        await ledger.execute(update(BillingUsage).where(
            BillingUsage.operation_id == operation_id, BillingUsage.status == "reserved",
        ).values(status="consumed" if success else "released"))
        await ledger.commit()


async def require_reservation(
    session: AsyncSession, settings: Settings, workspace_id: UUID, operation_id: UUID,
) -> None:
    if not settings.billing_enabled:
        return
    async with AsyncSession(bind=session.bind, expire_on_commit=False) as ledger:
        reservation = await ledger.get(BillingUsage, operation_id)
        if reservation is None or reservation.workspace_id != workspace_id or (
            reservation.status != "reserved" or reservation.reserved_until <= utc_now()
        ):
            raise AppError(402, "ai_reservation_required", "A valid AI credit reservation is required.")
        access = await entitlement(ledger, workspace_id, settings)
        if access.plan.credits == 0:
            raise AppError(402, "subscription_required", "An active subscription is required.")


@asynccontextmanager
async def generation_credit(
    session: AsyncSession, settings: Settings, workspace_id: UUID,
    operation_id: UUID, kind: str,
) -> AsyncIterator[CreditOutcome]:
    await reserve_credit(session, settings, workspace_id, operation_id, kind)
    outcome = CreditOutcome()
    try:
        yield outcome
    except BaseException:
        await finish_credit(session, settings, operation_id, success=False)
        raise
    else:
        if settings.billing_enabled and outcome.success and outcome.defer_until_commit:
            await session.execute(update(BillingUsage).where(
                BillingUsage.operation_id == operation_id, BillingUsage.status == "reserved",
            ).values(status="consumed"))
            pending: set[UUID] = session.info.setdefault("billing_deferred_credit_ids", set())
            pending.add(operation_id)
        else:
            await finish_credit(session, settings, operation_id, success=outcome.success)


@dataclass
class CreditOutcome:
    success: bool = False
    defer_until_commit: bool = False


async def release_uncommitted_credits(session: AsyncSession) -> None:
    operation_ids: set[UUID] = session.info.pop("billing_deferred_credit_ids", set())
    if not operation_ids:
        return
    async with AsyncSession(bind=session.bind, expire_on_commit=False) as ledger:
        reserved = list((await ledger.scalars(select(BillingUsage.operation_id).where(
            BillingUsage.operation_id.in_(operation_ids), BillingUsage.status == "reserved",
        ))).all())
    if not reserved:
        return
    await session.rollback()
    async with AsyncSession(bind=session.bind, expire_on_commit=False) as ledger:
        await ledger.execute(update(BillingUsage).where(
            BillingUsage.operation_id.in_(reserved), BillingUsage.status == "reserved",
        ).values(status="released"))
        await ledger.commit()
