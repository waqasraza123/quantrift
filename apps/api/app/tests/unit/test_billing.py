import hashlib
import hmac
import json
import time
from datetime import UTC, datetime, timedelta
from uuid import uuid4
from typing import Any

import pytest
from pydantic import SecretStr

from app.config import AppEnvironment, Settings
from app.core.errors import AppError
from app.modules.auth.continuation import safe_continuation
from app.modules.auth.identity import IdentityContext
from app.modules.auth.schemas import IdentitySource
from app.modules.billing.gateway import StripeGateway
from app.modules.billing.models import BillingAccount
from app.modules.billing.service import apply_subscription, catalog_response
from app.modules.billing.state import project_entitlement
from app.modules.permissions.registry import Permission
from app.modules.users.models import User
from app.modules.workspaces.models import Workspace


def billing_settings() -> Settings:
    return Settings(_env_file=None, app_env=AppEnvironment.TEST, auth_mode="session",
                    billing_enabled=True, stripe_secret_key=SecretStr("sk_test_placeholder"),
                    stripe_webhook_secret=SecretStr("whsec_placeholder"),
                    stripe_pro_price_id="price_pro", stripe_team_price_id="price_team",
                    stripe_portal_configuration_id="bpc_placeholder",
                    stripe_portal_pro_configuration_id="bpc_pro",
                    stripe_portal_team_configuration_id="bpc_team")


def test_catalog_prices_and_allowances_are_consistent() -> None:
    plans = catalog_response(billing_settings()).plans
    assert [(plan.key, plan.amount, plan.credits, plan.members) for plan in plans] == [
        ("free", 0, 0, 1), ("pro", 2900, 100, 1), ("team", 7900, 500, 5),
    ]


def test_transition_is_only_for_existing_workspaces_and_expires() -> None:
    launch = datetime(2026, 11, 1, tzinfo=UTC)
    old_workspace = launch - timedelta(days=1)
    during = project_entitlement(None, old_workspace, launch, launch + timedelta(days=29))
    assert during.plan.key == "pro" and during.status == "transition"
    assert during.transition_ends_at == launch + timedelta(days=30)
    assert project_entitlement(None, old_workspace, launch, launch + timedelta(days=30)).plan.key == "free"
    assert project_entitlement(None, launch + timedelta(seconds=1), launch, launch).plan.key == "free"


@pytest.mark.parametrize("status", ["past_due", "unpaid", "paused", "canceled", "incomplete"])
def test_unpaid_status_cannot_grant_paid_access(status: str) -> None:
    now = datetime.now(UTC)
    account = BillingAccount(workspace_id=uuid4(), subscription_id="sub_test", status=status,
                             plan="team", period_start=now - timedelta(days=1),
                             period_end=now + timedelta(days=29), paid_through=now + timedelta(days=29))
    assert project_entitlement(account, now - timedelta(days=60), now, now).plan.key == "free"


def test_cancellation_keeps_paid_access_until_the_period_ends() -> None:
    now = datetime.now(UTC)
    account = BillingAccount(workspace_id=uuid4(), subscription_id="sub_test", status="active",
                             plan="team", period_start=now - timedelta(days=1),
                             period_end=now + timedelta(days=29), paid_through=now + timedelta(days=29),
                             cancel_at_period_end=True)
    assert project_entitlement(account, now, None, now).plan.key == "team"
    assert project_entitlement(account, now, None, now + timedelta(days=30)).plan.key == "free"


def test_unpaid_upgrade_does_not_grant_team_allowance() -> None:
    now = datetime.now(UTC)
    account = BillingAccount(workspace_id=uuid4(), subscription_id="sub_test", status="active",
                             plan="pro", period_start=now - timedelta(days=1),
                             period_end=now + timedelta(days=29), paid_through=now + timedelta(days=29))
    data: dict[str, Any] = {
        "id": "sub_test", "status": "active", "latest_invoice": {"status": "open"},
        "items": {"data": [{"quantity": 1, "price": {
            "id": "price_team", "currency": "usd", "unit_amount": 7900,
            "recurring": {"interval": "month", "interval_count": 1},
        }}]},
    }
    apply_subscription(account, data, billing_settings())
    assert account.plan == "pro"
    data["latest_invoice"] = {"status": "paid"}
    data["items"]["data"][0]["current_period_start"] = int((now - timedelta(days=1)).timestamp())
    data["items"]["data"][0]["current_period_end"] = int((now + timedelta(days=29)).timestamp())
    apply_subscription(account, data, billing_settings())
    assert account.plan == "team"


def test_webhook_signature_and_mode_are_required() -> None:
    gateway = StripeGateway(billing_settings())
    payload = json.dumps({"id": "evt_test", "object": "event", "type": "invoice.paid",
                          "livemode": False, "data": {"object": {"id": "in_test"}}}).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(b"whsec_placeholder", timestamp.encode() + b"." + payload, hashlib.sha256).hexdigest()
    assert gateway.verify_event(payload, f"t={timestamp},v1={signature}")["id"] == "evt_test"
    with pytest.raises(AppError) as invalid:
        gateway.verify_event(payload + b" ", f"t={timestamp},v1={signature}")
    assert invalid.value.code == "invalid_stripe_signature"


def test_workspace_admin_is_scoped_and_membership_role_wins() -> None:
    home, shared = uuid4(), uuid4()
    user = User(id=uuid4(), workspace_id=home, email="owner@example.test", name="Owner", role="admin")
    identity = IdentityContext(source=IdentitySource.SESSION, user=user,
                               workspace=Workspace(id=shared, name="Shared"), membership_role="analyst")
    assert identity.has_permission(Permission.ANALYSIS_WRITE, shared)
    assert not identity.has_permission(Permission.USERS_ADMIN, shared)
    assert not identity.has_permission(Permission.ANALYSIS_READ, home)
    owner = IdentityContext(source=IdentitySource.SESSION, user=user,
                            workspace=Workspace(id=home, name="Home"), admin=True,
                            membership_role="owner")
    assert not owner.can_access_workspace(shared)


@pytest.mark.parametrize("path", ["https://evil.test", "//evil.test", "/api/secrets", "/%2f/evil.test", "/login"])
def test_continuation_rejects_external_and_internal_api_targets(path: str) -> None:
    assert safe_continuation(path) == "/command-center"


def test_billing_continuation_preserves_the_selected_plan() -> None:
    assert safe_continuation("/billing?plan=team") == "/billing?plan=team"
    assert safe_continuation("/invite#token=private") == "/invite"
