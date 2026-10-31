from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.dependencies import database_session
from app.modules.auth.email import VerificationEmailProvider
from app.modules.auth.identity import IdentityContext, build_user_identity, identity_to_read
from app.modules.auth.models import AuthSession
from app.modules.auth.passwords import hash_session_token
from app.modules.auth.schemas import CurrentIdentityRead, IdentitySource
from app.modules.billing.dependencies import billing_identity
from app.modules.billing.schemas import InvitationAccept, InvitationCreate, WorkspaceSwitch
from app.modules.memberships.service import MembershipService

router = APIRouter(tags=["workspace-memberships"])
Session = Annotated[AsyncSession, Depends(database_session)]
Identity = Annotated[IdentityContext, Depends(billing_identity)]


@router.post("/auth/workspace", response_model=CurrentIdentityRead)
async def switch_workspace(payload: WorkspaceSwitch, request: Request,
                           session: Session, identity: Identity) -> CurrentIdentityRead:
    if identity.user is None:
        raise AppError(401, "session_auth_required", "Sign in to choose a workspace.")
    service = MembershipService(session, request.app.state.settings)
    await service.require_member(identity.user.id, payload.workspace_id)
    authorization = request.headers.get("authorization", "")
    token = authorization.split(" ", 1)[1].strip() if authorization.lower().startswith("bearer ") else ""
    auth_session = await session.scalar(select(AuthSession).where(
        AuthSession.token_hash == hash_session_token(token),
        AuthSession.user_id == identity.user.id, AuthSession.status == "active",
    ).with_for_update())
    if auth_session is None:
        raise AppError(401, "session_auth_required", "Sign in again to choose a workspace.")
    workspace = await service.lock_workspace(payload.workspace_id)
    auth_session.workspace_id = workspace.id
    updated = await build_user_identity(
        session, request.app.state.settings, identity.user, workspace, IdentitySource.SESSION,
    )
    await session.commit()
    return identity_to_read(updated)


@router.get("/workspaces/{workspace_id}/members")
async def members(workspace_id: UUID, request: Request, session: Session,
                  identity: Identity) -> dict[str, Any]:
    if identity.user is None:
        raise AppError(401, "session_auth_required", "Sign in to view your team.")
    return await MembershipService(session, request.app.state.settings).team(
        workspace_id, identity.user.id,
    )


@router.post("/workspaces/{workspace_id}/invitations")
async def invite(workspace_id: UUID, payload: InvitationCreate, request: Request,
                 session: Session, identity: Identity) -> dict[str, object]:
    if identity.user is None:
        raise AppError(401, "session_auth_required", "Sign in to invite a teammate.")
    invitation = await MembershipService(session, request.app.state.settings).invite(
        workspace_id, identity.user.id, payload.email,
        cast(VerificationEmailProvider, request.app.state.verification_email_provider),
    )
    return {"id": invitation.id, "email": invitation.email, "expiresAt": invitation.expires_at}


@router.post("/workspace-invitations/accept")
async def accept(payload: InvitationAccept, request: Request, session: Session,
                 identity: Identity) -> dict[str, UUID]:
    if identity.user is None:
        raise AppError(401, "session_auth_required", "Sign in to accept this invitation.")
    workspace_id = await MembershipService(session, request.app.state.settings).accept(
        payload.token, identity.user,
    )
    return {"workspaceId": workspace_id}


@router.delete("/workspaces/{workspace_id}/invitations/{invitation_id}", status_code=204)
async def revoke(workspace_id: UUID, invitation_id: UUID, request: Request,
                 session: Session, identity: Identity) -> None:
    if identity.user is None:
        raise AppError(401, "session_auth_required", "Sign in to manage invitations.")
    await MembershipService(session, request.app.state.settings).revoke(
        workspace_id, identity.user.id, invitation_id,
    )


@router.delete("/workspaces/{workspace_id}/members/{user_id}", status_code=204)
async def remove(workspace_id: UUID, user_id: UUID, request: Request,
                 session: Session, identity: Identity) -> None:
    if identity.user is None:
        raise AppError(401, "session_auth_required", "Sign in to manage members.")
    await MembershipService(session, request.app.state.settings).remove(
        workspace_id, identity.user.id, user_id,
    )
