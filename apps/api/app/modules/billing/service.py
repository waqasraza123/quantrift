from dataclasses import asdict
from typing import Any, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, secret_is_empty
from app.core.errors import AppError
from app.core.time import utc_now
from app.modules.billing.catalog import CORE_FEATURES, PLANS, PlanKey
from app.modules.billing.gateway import StripeGateway
from app.modules.billing.models import BillingAccount, BillingCheckout, BillingEvent
from app.modules.billing.schemas import BillingRead, CatalogRead, PlanRead
from app.modules.billing.state import billing_account, entitlement, stripe_datetime
from app.modules.billing.usage import usage_counts
from app.modules.job_queue.models import JobQueueJobType
from app.modules.job_queue.schemas import JobQueueJobCreate
from app.modules.job_queue.service import JobQueueService

SUBSCRIPTION_EVENTS = frozenset({
    "checkout.session.completed", "checkout.session.expired",
    "customer.subscription.created", "customer.subscription.updated",
    "customer.subscription.deleted", "customer.subscription.paused",
    "customer.subscription.resumed", "invoice.paid", "invoice.payment_failed",
    "invoice.payment_action_required",
})


class BillingService:
    def __init__(self, session: AsyncSession, settings: Settings,
                 gateway: StripeGateway | None = None) -> None:
        self.session = session
        self.settings = settings
        self.gateway = gateway or StripeGateway(settings)

    async def summary(self, workspace_id: UUID, *, owner: bool) -> BillingRead:
        account = await self.session.get(BillingAccount, workspace_id)
        if account is not None and account.customer_id and account.livemode != self.settings.stripe_live_mode:
            raise AppError(409, "billing_mode_mismatch", "This workspace belongs to a different Stripe environment.")
        access = await entitlement(self.session, workspace_id, self.settings)
        used, reserved = await usage_counts(self.session, workspace_id, access)
        pending = False
        if account is not None and account.customer_id:
            pending = await self.session.scalar(select(BillingEvent.event_id).where(
                BillingEvent.customer_id == account.customer_id,
                BillingEvent.processed_at.is_(None),
            ).limit(1)) is not None
        return BillingRead(
            workspace_id=workspace_id, plan=access.plan.key, status=access.status,
            subscription_status=account.status if account and account.subscription_id else None,
            credits=access.plan.credits, used=used, reserved=reserved,
            remaining=max(0, access.plan.credits - used - reserved),
            members=access.plan.members, period_start=access.period_start,
            period_end=access.period_end, transition_ends_at=access.transition_ends_at,
            cancel_at_period_end=account.cancel_at_period_end if account else False,
            can_manage=owner, checkout_enabled=self.gateway.ready,
            portal_enabled=bool(self.gateway.ready and account and account.customer_id),
            enforcement_enabled=self.settings.billing_enabled, sync_pending=pending,
            ai_configured=(self.settings.trade_suggestions_enabled
                           and not secret_is_empty(self.settings.openai_api_key)),
        )

    async def create_checkout(self, workspace_id: UUID, email: str,
                              plan: PlanKey, request_id: UUID) -> str:
        if plan == "free":
            raise AppError(422, "invalid_checkout_plan", "Choose Pro or Team for checkout.")
        if not self.gateway.ready:
            raise AppError(503, "billing_unavailable", "Subscription checkout is not available yet.")
        account = await billing_account(self.session, workspace_id, lock=True, livemode=self.settings.stripe_live_mode)
        if account.customer_id is None:
            customer = await self.gateway.create_customer(workspace_id, email)
            account.customer_id = str(customer["id"])
            await self.session.commit()
            account = await billing_account(self.session, workspace_id, lock=True, livemode=self.settings.stripe_live_mode)
        await self.reconcile(account)
        if account.subscription_id is not None and account.status not in {
            "canceled", "incomplete_expired", "none",
        }:
            await self.session.commit()
            raise AppError(409, "subscription_exists", "Manage your subscription in the billing portal.")
        existing = await self.session.get(BillingCheckout, request_id)
        if existing is not None and (existing.workspace_id != workspace_id or existing.plan != plan):
            raise AppError(409, "checkout_request_conflict", "Checkout request does not match.")
        attempts = (await self.session.scalars(select(BillingCheckout).where(
            BillingCheckout.workspace_id == workspace_id,
            BillingCheckout.status.in_(("creating", "open")),
        ).order_by(BillingCheckout.created_at.desc()))).all()
        for attempt in attempts:
            if attempt.session_id is not None:
                remote = await self.gateway.retrieve_checkout(attempt.session_id)
                attempt.status = str(remote["status"])
                if attempt.status == "complete":
                    await self.session.commit()
                    raise AppError(409, "checkout_pending", "Your payment is being confirmed. Refresh billing shortly.")
                if attempt.status == "open":
                    if attempt.plan == plan and attempt.url:
                        await self.session.commit()
                        return attempt.url
                    await self.gateway.expire_checkout(attempt.session_id)
                    attempt.status = "expired"
            elif attempt.plan != plan:
                raise AppError(409, "checkout_pending", "Another checkout is being prepared. Try again shortly.")
            elif existing is None:
                existing = attempt
        if existing is not None and existing.status not in {"creating", "open"}:
            raise AppError(409, "checkout_finished", "Start a new checkout from the pricing options.")
        attempt = existing or BillingCheckout(id=request_id, workspace_id=workspace_id, plan=plan)
        if existing is None:
            self.session.add(attempt)
        await self.session.commit()
        account = await billing_account(self.session, workspace_id, lock=True, livemode=self.settings.stripe_live_mode)
        if account.customer_id is None:
            raise AppError(503, "billing_unavailable", "Billing customer is unavailable.")
        result = await self.gateway.checkout(account.customer_id, plan, attempt.id, workspace_id)
        session_id, checkout_url = result.get("id"), result.get("url")
        if not isinstance(session_id, str) or not isinstance(checkout_url, str) or not checkout_url.startswith("https://"):
            raise AppError(502, "stripe_unavailable", "Stripe did not provide a checkout URL.")
        attempt.session_id, attempt.url = session_id, checkout_url
        attempt.expires_at = stripe_datetime(result.get("expires_at"))
        attempt.status = "open"
        await self.session.commit()
        return attempt.url

    async def reconcile(self, account: BillingAccount) -> None:
        if account.customer_id is None:
            return
        if account.livemode != self.settings.stripe_live_mode:
            raise AppError(409, "billing_mode_mismatch", "This workspace belongs to a different Stripe environment.")
        subscriptions = await self.gateway.subscriptions(account.customer_id)
        current = [item for item in subscriptions
                   if item.get("status") not in {"canceled", "incomplete_expired"}]
        if len(current) > 1:
            raise AppError(409, "multiple_subscriptions", "Billing needs support review before changes.")
        selected = current[0] if current else next(
            (item for item in subscriptions if item.get("id") == account.subscription_id), None,
        )
        if selected is not None:
            apply_subscription(account, selected, self.settings)
        elif account.subscription_id is not None:
            account.status = "canceled"
            account.plan = "free"
        account.last_synced_at = utc_now()

    async def receive_event(self, event: dict[str, Any]) -> None:
        event_type = str(event.get("type", ""))
        if event_type not in SUBSCRIPTION_EVENTS:
            return
        data = event.get("data", {}).get("object", {})
        customer_id = data.get("customer")
        if not isinstance(customer_id, str):
            return
        account = await self.session.scalar(select(BillingAccount).where(
            BillingAccount.customer_id == customer_id,
            BillingAccount.livemode == self.settings.stripe_live_mode,
        ))
        if account is None:
            return
        result = await self.session.execute(insert(BillingEvent).values(
            event_id=str(event["id"]), event_type=event_type, customer_id=customer_id,
            object_id=str(data["id"]),
        ).on_conflict_do_nothing(index_elements=["event_id"]).returning(BillingEvent.event_id))
        if result.scalar_one_or_none() is not None:
            await JobQueueService(self.session, self.settings).enqueue_job(JobQueueJobCreate(
                workspace_id=account.workspace_id, job_type=JobQueueJobType.BILLING_RECONCILE,
                idempotency_key=f"stripe:{event['id']}",
                payload_json={"eventId": str(event["id"])}, max_attempts=10,
            ), commit=False)
        await self.session.commit()


def apply_subscription(account: BillingAccount, data: dict[str, Any], settings: Settings) -> None:
    account.subscription_id = str(data["id"])
    account.status = str(data["status"])
    account.cancel_at_period_end = bool(data.get("cancel_at_period_end", False))
    items = data.get("items", {}).get("data", [])
    if len(items) != 1 or items[0].get("quantity", 1) != 1:
        account.plan = "free"
        return
    item = items[0]
    price = item.get("price", {})
    price_id = price.get("id")
    plan = next((key for key, value in {
        "pro": settings.stripe_pro_price_id, "team": settings.stripe_team_price_id,
    }.items() if value is not None and value == price_id), None)
    if plan is None or price.get("currency") != "usd" or (
        price.get("unit_amount") != PLANS[cast(PlanKey, plan)].amount
    ) or price.get("recurring", {}).get("interval") != "month" or (
        price.get("recurring", {}).get("interval_count", 1) != 1
    ):
        account.plan = "free"
        return
    invoice = data.get("latest_invoice")
    if isinstance(invoice, dict) and invoice.get("status") == "paid":
        account.plan = plan
        account.price_id = str(price_id)
        account.period_start = stripe_datetime(item.get("current_period_start", data.get("current_period_start")))
        account.period_end = stripe_datetime(item.get("current_period_end", data.get("current_period_end")))
        account.paid_through = account.period_end


def catalog_response(settings: Settings) -> CatalogRead:
    return CatalogRead(
        plans=[PlanRead(**asdict(plan), features=list(CORE_FEATURES)) for plan in PLANS.values()],
        checkout_enabled=StripeGateway(settings).ready,
    )
