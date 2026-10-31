from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.dependencies import database_session
from app.modules.auth.identity import IdentityContext
from app.modules.billing.dependencies import billing_identity
from app.modules.billing.gateway import StripeGateway
from app.modules.billing.schemas import BillingRead, CatalogRead, CheckoutCreate, RedirectRead
from app.modules.billing.service import BillingService, catalog_response
from app.modules.billing.state import billing_account
from app.modules.memberships.service import MembershipService

router = APIRouter(prefix="/billing", tags=["billing"])
Session = Annotated[AsyncSession, Depends(database_session)]
Identity = Annotated[IdentityContext, Depends(billing_identity)]


@router.get("/plans", response_model=CatalogRead)
async def plans(request: Request) -> CatalogRead:
    return catalog_response(request.app.state.settings)


@router.get("/workspace", response_model=BillingRead)
async def workspace_billing(request: Request, session: Session, identity: Identity) -> BillingRead:
    if identity.user is None or identity.workspace is None:
        raise AppError(401, "session_auth_required", "Sign in to view workspace billing.")
    member = await MembershipService(session, request.app.state.settings).require_member(
        identity.user.id, identity.workspace.id,
    )
    return await BillingService(session, request.app.state.settings).summary(
        identity.workspace.id, owner=member.role == "owner",
    )


@router.post("/checkout", response_model=RedirectRead)
async def checkout(payload: CheckoutCreate, request: Request, session: Session,
                   identity: Identity) -> RedirectRead:
    if identity.user is None or identity.workspace is None:
        raise AppError(401, "session_auth_required", "Sign in to subscribe.")
    await MembershipService(session, request.app.state.settings).require_member(
        identity.user.id, identity.workspace.id, owner=True,
    )
    url = await BillingService(session, request.app.state.settings).create_checkout(
        identity.workspace.id, identity.user.email, payload.plan, payload.request_id,
    )
    return RedirectRead(url=url)


@router.post("/portal", response_model=RedirectRead)
async def portal(request: Request, session: Session, identity: Identity) -> RedirectRead:
    if identity.user is None or identity.workspace is None:
        raise AppError(401, "session_auth_required", "Sign in to manage billing.")
    settings = request.app.state.settings
    await MembershipService(session, settings).require_member(
        identity.user.id, identity.workspace.id, owner=True,
    )
    gateway = StripeGateway(settings)
    if not gateway.ready:
        raise AppError(503, "billing_unavailable", "Billing management is not available yet.")
    account = await billing_account(session, identity.workspace.id, livemode=settings.stripe_live_mode)
    if account.customer_id is None:
        raise AppError(409, "billing_customer_missing", "Choose a paid plan first.")
    return RedirectRead(url=await gateway.portal(account.customer_id))


@router.post("/webhook")
async def webhook(request: Request, session: Session) -> dict[str, bool]:
    settings = request.app.state.settings
    if not settings.billing_enabled:
        raise AppError(503, "billing_unavailable", "Billing is not enabled.")
    event = StripeGateway(settings).verify_event(
        await request.body(), request.headers.get("stripe-signature", ""),
    )
    await BillingService(session, settings).receive_event(event)
    return {"received": True}
