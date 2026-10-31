from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
import stripe
from pydantic import SecretStr

from app.config import Settings
from app.core.errors import AppError
from app.modules.billing.catalog import STRIPE_PRODUCT_ID
from app.modules.billing.gateway import StripeGateway
from app.modules.billing.portal import setup_portal_configurations


def portal_settings() -> Settings:
    return Settings(
        _env_file=None, stripe_pro_price_id="price_pro", stripe_team_price_id="price_team",
        stripe_portal_configuration_id="bpc_management",
        stripe_portal_pro_configuration_id="bpc_pro",
        stripe_portal_team_configuration_id="bpc_team",
    )


@pytest.mark.asyncio
async def test_portal_catalog_has_one_target_price_and_reuses_configurations() -> None:
    client = MagicMock()
    configurations = client.v1.billing_portal.configurations
    stored: list[dict[str, Any]] = []

    async def list_configurations(parameters: dict[str, Any]) -> stripe.ListObject[Any]:
        return stripe.ListObject.construct_from({
            "object": "list", "url": "/v1/billing_portal/configurations",
            "has_more": False, "data": stored,
        }, None)

    async def create_configuration(
        parameters: dict[str, Any], **options: Any,
    ) -> stripe.billing_portal.Configuration:
        configuration = {
            **parameters, "object": "billing_portal.configuration",
            "id": f"bpc_{parameters['metadata']['quantrift_audience']}",
        }
        stored.append(configuration)
        return stripe.billing_portal.Configuration.construct_from(configuration, None)

    async def update_configuration(
        identifier: str, parameters: dict[str, Any],
    ) -> stripe.billing_portal.Configuration:
        return stripe.billing_portal.Configuration.construct_from({
            **parameters, "id": identifier, "object": "billing_portal.configuration",
        }, None)

    configurations.list_async = AsyncMock(side_effect=list_configurations)
    configurations.create_async = AsyncMock(side_effect=create_configuration)
    configurations.update_async = AsyncMock(side_effect=update_configuration)
    settings = portal_settings()
    prices = {"pro": "price_pro", "team": "price_team"}
    identifiers = await setup_portal_configurations(cast(stripe.StripeClient, client), settings, prices)
    assert identifiers == {
        "STRIPE_PORTAL_CONFIGURATION_ID": "bpc_management",
        "STRIPE_PORTAL_PRO_CONFIGURATION_ID": "bpc_pro",
        "STRIPE_PORTAL_TEAM_CONFIGURATION_ID": "bpc_team",
    }
    for configuration in stored:
        audience = configuration["metadata"]["quantrift_audience"]
        features = configuration["features"]
        assert features["subscription_cancel"] == {"enabled": True, "mode": "at_period_end"}
        updates = features["subscription_update"]
        if audience == "management":
            assert updates == {"enabled": False}
        else:
            target = "price_team" if audience == "pro" else "price_pro"
            assert updates["products"] == [{"product": STRIPE_PRODUCT_ID, "prices": [target]}]
            assert updates["proration_behavior"] == "always_invoice"
            assert updates["schedule_at_period_end"] == {
                "conditions": [{"type": "decreasing_item_amount"}],
            }
    assert await setup_portal_configurations(
        cast(stripe.StripeClient, client), settings, prices,
    ) == identifiers
    assert configurations.create_async.await_count == 3
    assert configurations.update_async.await_count == 3


@pytest.mark.asyncio
@pytest.mark.parametrize(("price", "expected"), [
    ("price_pro", "bpc_pro"), ("price_team", "bpc_team"),
    ("price_unknown", "bpc_management"),
])
async def test_portal_selects_configuration_from_current_stripe_price(
    monkeypatch: pytest.MonkeyPatch, price: str, expected: str,
) -> None:
    gateway = StripeGateway(portal_settings())
    subscriptions = AsyncMock(return_value=[{
        "status": "active", "items": {"data": [{"price": {"id": price}, "quantity": 1}]},
    }])
    create_session = AsyncMock(return_value=MagicMock(url="https://billing.stripe.com/test"))
    client = MagicMock()
    client.v1.billing_portal.sessions.create_async = create_session
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=client)
    context.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(gateway, "subscriptions", subscriptions)
    monkeypatch.setattr(gateway, "client", lambda: context)
    assert await gateway.portal("cus_test") == "https://billing.stripe.com/test"
    assert create_session.call_args.args[0]["configuration"] == expected
    subscriptions.assert_awaited_once_with("cus_test")


@pytest.mark.asyncio
@pytest.mark.parametrize("translate_errors", [True, False])
async def test_gateway_preserves_setup_errors_and_closes_transport(
    monkeypatch: pytest.MonkeyPatch, translate_errors: bool,
) -> None:
    settings = portal_settings().model_copy(update={
        "stripe_secret_key": SecretStr("sk_test_placeholder"), "stripe_live_mode": False,
    })
    transport = MagicMock()
    transport.close_async = AsyncMock()
    monkeypatch.setattr(stripe, "HTTPXClient", lambda **options: transport)
    error = stripe.InvalidRequestError("Duplicate billing intervals", param="features")
    with pytest.raises(AppError if translate_errors else stripe.InvalidRequestError) as caught:
        async with StripeGateway(settings).client(translate_errors=translate_errors):
            raise error
    if translate_errors:
        assert caught.value.__cause__ is error
    else:
        assert caught.value is error
    transport.close_async.assert_awaited_once()
