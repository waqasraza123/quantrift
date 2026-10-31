import argparse
import asyncio
import json
from uuid import UUID

import stripe
from sqlalchemy import select, update

from app.config import get_settings
from app.core.time import utc_now
from app.db.session import get_async_session_factory
from app.modules.billing.catalog import PLANS, STRIPE_PRODUCT_ID
from app.modules.billing.gateway import StripeGateway
from app.modules.billing.models import BillingAccount, BillingEvent, BillingUsage
from app.modules.billing.portal import setup_portal_configurations
from app.modules.billing.service import BillingService
from app.modules.billing.state import activate_billing


async def setup_catalog() -> dict[str, str]:
    gateway = StripeGateway(get_settings())
    async with gateway.client(translate_errors=False) as client:
        try:
            product = await client.v1.products.retrieve_async(STRIPE_PRODUCT_ID)
        except stripe.InvalidRequestError as error:
            if error.http_status != 404:
                raise
            product = await client.v1.products.create_async({
                "id": STRIPE_PRODUCT_ID, "name": "QuantRift workspace",
                "description": "Monthly market research and AI agent subscriptions.",
            }, options={"idempotency_key": "quantrift:catalog:product:v1"})
        price_ids: dict[str, str] = {}
        for plan in (PLANS["pro"], PLANS["team"]):
            key = plan.key
            lookup = f"quantrift_{key}_monthly_v1"
            prices = await client.v1.prices.list_async({"lookup_keys": [lookup], "limit": 2})
            if prices.data:
                price = prices.data[0]
                if price.product != product.id or price.unit_amount != plan.amount or (
                    price.currency != "usd" or price.recurring is None
                    or price.recurring.interval != "month" or price.recurring.interval_count != 1
                    or not price.active
                ):
                    raise RuntimeError(f"Existing {key} price does not match the agreed catalog")
            else:
                price = await client.v1.prices.create_async({
                    "product": product.id, "currency": "usd", "unit_amount": plan.amount,
                    "recurring": {"interval": "month"}, "lookup_key": lookup,
                    "nickname": f"QuantRift {plan.name} monthly", "metadata": {"plan": key},
                }, options={"idempotency_key": f"quantrift:catalog:{key}:v1"})
            price_ids[key] = price.id
        portal_ids = await setup_portal_configurations(client, gateway.settings, price_ids)
        return {
            "STRIPE_PRO_PRICE_ID": price_ids["pro"],
            "STRIPE_TEAM_PRICE_ID": price_ids["team"],
            **portal_ids,
        }


async def database_command(command: str, workspace_id: UUID | None) -> None:
    factory = get_async_session_factory()
    if factory is None:
        raise RuntimeError("DATABASE_URL is required")
    settings = get_settings()
    async with factory() as session:
        if command == "activate":
            if not settings.billing_enabled:
                raise RuntimeError("Set BILLING_ENABLED=true before activating billing")
            rollout = await activate_billing(session)
            await session.commit()
            print(json.dumps({"activatedAt": rollout.activated_at.isoformat()}))
            return
        if command == "release-expired":
            result = await session.execute(update(BillingUsage).where(
                BillingUsage.status == "reserved", BillingUsage.reserved_until <= utc_now(),
            ).values(status="released").returning(BillingUsage.operation_id))
            released = len(result.all())
            await session.commit()
            print(json.dumps({"released": released}))
            return
        statement = select(BillingAccount.workspace_id).where(BillingAccount.customer_id.is_not(None))
        if workspace_id is not None:
            statement = statement.where(BillingAccount.workspace_id == workspace_id)
        workspace_ids = list((await session.scalars(statement)).all())
    for selected_id in workspace_ids:
        async with factory() as session:
            account = await session.get(BillingAccount, selected_id, with_for_update=True)
            if account is None:
                continue
            await BillingService(session, settings).reconcile(account)
            await session.execute(update(BillingEvent).where(
                BillingEvent.customer_id == account.customer_id,
                BillingEvent.processed_at.is_(None),
            ).values(processed_at=utc_now()))
            await session.commit()
    print(json.dumps({"reconciled": len(workspace_ids)}))


def main() -> None:
    parser = argparse.ArgumentParser(description="Configure and recover QuantRift billing")
    parser.add_argument("command", choices=["setup", "activate", "reconcile", "release-expired"])
    parser.add_argument("--workspace-id", type=UUID)
    arguments = parser.parse_args()
    if arguments.command == "setup":
        try:
            result = asyncio.run(setup_catalog())
        except stripe.StripeError as error:
            parser.exit(1, f"Stripe catalog setup failed: {error}\n")
        print(json.dumps(result, indent=2))
    else:
        asyncio.run(database_command(arguments.command, arguments.workspace_id))


if __name__ == "__main__":
    main()
