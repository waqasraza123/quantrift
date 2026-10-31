from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.core.schemas import ApiSchema
from app.modules.billing.catalog import PlanKey


class PlanRead(ApiSchema):
    key: PlanKey
    name: str
    amount: int
    currency: str = "usd"
    interval: str = "month"
    credits: int
    members: int
    description: str
    features: list[str]


class CatalogRead(ApiSchema):
    plans: list[PlanRead]
    checkout_enabled: bool


class BillingRead(ApiSchema):
    workspace_id: UUID
    plan: PlanKey
    status: str
    subscription_status: str | None
    credits: int
    used: int
    reserved: int
    remaining: int
    members: int
    period_start: datetime | None
    period_end: datetime | None
    transition_ends_at: datetime | None
    cancel_at_period_end: bool
    can_manage: bool
    checkout_enabled: bool
    portal_enabled: bool
    ai_configured: bool
    enforcement_enabled: bool
    sync_pending: bool


class CheckoutCreate(ApiSchema):
    plan: PlanKey
    request_id: UUID


class RedirectRead(ApiSchema):
    url: str


class InvitationCreate(ApiSchema):
    email: str = Field(min_length=3, max_length=320)


class InvitationAccept(ApiSchema):
    token: str = Field(min_length=32, max_length=256)


class WorkspaceSwitch(ApiSchema):
    workspace_id: UUID
