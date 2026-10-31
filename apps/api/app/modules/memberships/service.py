import hashlib
import secrets
from datetime import timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.modules.auth.email import VerificationEmail, VerificationEmailProvider
from app.modules.auth.models import AuthPasswordCredential
from app.modules.billing.models import BillingAccount
from app.modules.billing.catalog import PLANS
from app.modules.billing.state import entitlement
from app.modules.memberships.models import WorkspaceInvitation, WorkspaceMembership
from app.modules.users.models import User
from app.modules.workspaces.models import Workspace


class MembershipService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    async def require_member(self, user_id: UUID, workspace_id: UUID,
                             *, manager: bool = False, owner: bool = False) -> WorkspaceMembership:
        member = await self.session.scalar(select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user_id,
        ).execution_options(populate_existing=True))
        if member is None or member.removed_at is not None:
            raise AppError(403, "workspace_access_denied", "You do not have access to this workspace.")
        if member.role != "owner" and self.settings.billing_enabled:
            access = await entitlement(self.session, workspace_id, self.settings)
            if access.plan.key != "team":
                raise AppError(403, "team_membership_suspended", "This workspace needs an active Team plan.")
            seats = await self.active_seats(workspace_id)
            if user_id not in seats:
                raise AppError(403, "team_membership_suspended", "This workspace has no available Team seat.")
        if owner and member.role != "owner":
            raise AppError(403, "billing_owner_required", "Only the workspace owner can manage billing.")
        if manager and member.role not in {"owner", "admin"}:
            raise AppError(403, "workspace_admin_required", "A workspace administrator is required.")
        return member

    async def active_seats(self, workspace_id: UUID) -> set[UUID]:
        rows = await self.session.scalars(select(WorkspaceMembership.user_id).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.removed_at.is_(None),
        ).order_by(case((WorkspaceMembership.role == "owner", 0), else_=1),
                   WorkspaceMembership.created_at, WorkspaceMembership.user_id
        ).limit(PLANS["team"].members))
        return set(rows.all())

    async def lock_workspace(self, workspace_id: UUID) -> Workspace:
        workspace = await self.session.scalar(select(Workspace).where(
            Workspace.id == workspace_id,
        ).with_for_update())
        if workspace is None:
            raise AppError(404, "workspace_not_found", "Workspace was not found.")
        return workspace

    async def require_team(self, workspace_id: UUID) -> None:
        await self.session.get(BillingAccount, workspace_id, with_for_update=True, populate_existing=True)
        access = await entitlement(self.session, workspace_id, self.settings)
        if not self.settings.billing_enabled or access.plan.key != "team":
            raise AppError(402, "team_plan_required", "Upgrade this workspace to Team to invite members.")

    async def seat_count(self, workspace_id: UUID) -> int:
        members = await self.session.scalar(select(func.count()).select_from(
            WorkspaceMembership,
        ).where(WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.removed_at.is_(None)))
        invitations = await self.session.scalar(select(func.count()).select_from(
            WorkspaceInvitation,
        ).where(WorkspaceInvitation.workspace_id == workspace_id,
                WorkspaceInvitation.accepted_at.is_(None),
                WorkspaceInvitation.revoked_at.is_(None),
                WorkspaceInvitation.expires_at > utc_now()))
        return int(members or 0) + int(invitations or 0)

    async def invite(self, workspace_id: UUID, user_id: UUID, email: str,
                     provider: VerificationEmailProvider) -> WorkspaceInvitation:
        await self.require_member(user_id, workspace_id, manager=True)
        workspace = await self.lock_workspace(workspace_id)
        await self.require_member(user_id, workspace_id, manager=True)
        await self.require_team(workspace_id)
        normalized = email.strip().lower()
        if normalized.count("@") != 1 or any(char.isspace() for char in normalized):
            raise AppError(422, "invalid_email", "Enter a valid email address.")
        existing = await self.session.scalar(select(WorkspaceMembership).join(
            User, WorkspaceMembership.user_id == User.id,
        ).where(WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.removed_at.is_(None), User.email == normalized))
        if existing is not None:
            raise AppError(409, "already_a_member", "This person is already a workspace member.")
        pending = await self.session.scalar(select(WorkspaceInvitation).where(
            WorkspaceInvitation.workspace_id == workspace_id, WorkspaceInvitation.email == normalized,
            WorkspaceInvitation.accepted_at.is_(None), WorkspaceInvitation.revoked_at.is_(None),
            WorkspaceInvitation.expires_at > utc_now(),
        ))
        if pending is not None:
            raise AppError(409, "invitation_exists", "Revoke the pending invitation before sending another.")
        if await self.seat_count(workspace_id) >= PLANS["team"].members:
            raise AppError(409, "team_seats_exhausted", "All five Team seats are occupied or reserved.")
        raw_token = secrets.token_urlsafe(48)
        invitation = WorkspaceInvitation(
            workspace_id=workspace_id, invited_by=user_id, email=normalized,
            token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
            expires_at=utc_now() + timedelta(days=7),
        )
        self.session.add(invitation)
        await self.session.flush()
        await self.session.commit()
        url = f"{self.settings.auth_public_web_base_url.rstrip('/')}/invite#token={raw_token}"
        try:
            await provider.send_verification_email(VerificationEmail(
                delivery_id=str(invitation.id), recipient_email=normalized,
                recipient_name=normalized, verification_url=url, expires_at=invitation.expires_at,
                workspace_name=workspace.name,
            ))
        except Exception as error:
            invitation.revoked_at = utc_now()
            await self.session.commit()
            raise AppError(503, "invitation_delivery_failed", "The invitation could not be delivered. Please retry.") from error
        invitation.delivered_at = utc_now()
        await self.session.commit()
        return invitation

    async def accept(self, raw_token: str, user: User) -> UUID:
        invitation = await self.session.scalar(select(WorkspaceInvitation).where(
            WorkspaceInvitation.token_hash == hashlib.sha256(raw_token.encode()).hexdigest(),
        ))
        if invitation is None or invitation.revoked_at is not None:
            raise AppError(404, "invitation_invalid", "This invitation is invalid or was revoked.")
        await self.lock_workspace(invitation.workspace_id)
        await self.session.refresh(invitation)
        if invitation.revoked_at is not None or invitation.expires_at <= utc_now():
            raise AppError(410, "invitation_expired", "Ask the workspace owner for a new invitation.")
        credential = await self.session.scalar(select(AuthPasswordCredential).where(
            AuthPasswordCredential.user_id == user.id, AuthPasswordCredential.status == "active",
            AuthPasswordCredential.email_verified_at.is_not(None),
        ))
        if credential is None or invitation.email != credential.email.strip().lower():
            raise AppError(403, "invitation_email_mismatch", "Sign in with the email address that received this invitation.")
        await self.require_team(invitation.workspace_id)
        membership = await self.session.get(WorkspaceMembership, (invitation.workspace_id, user.id))
        if invitation.accepted_at is not None:
            if membership is None or membership.removed_at is not None:
                raise AppError(410, "invitation_used", "This invitation has already been used.")
            return invitation.workspace_id
        if await self.seat_count(invitation.workspace_id) > PLANS["team"].members:
            raise AppError(409, "team_seats_exhausted", "No Team seats are available.")
        if membership is None:
            membership = WorkspaceMembership(workspace_id=invitation.workspace_id,
                                             user_id=user.id, role="analyst")
            self.session.add(membership)
        elif membership.removed_at is not None:
            membership.removed_at = None
            membership.role = "analyst"
        invitation.accepted_at = utc_now()
        await self.session.commit()
        return invitation.workspace_id

    async def team(self, workspace_id: UUID, user_id: UUID) -> dict[str, Any]:
        membership = await self.require_member(user_id, workspace_id)
        seats = await self.active_seats(workspace_id)
        rows = (await self.session.execute(select(WorkspaceMembership, User).join(
            User, WorkspaceMembership.user_id == User.id,
        ).where(WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.removed_at.is_(None)).order_by(User.created_at))).all()
        access = await entitlement(self.session, workspace_id, self.settings)
        manager = membership.role in {"owner", "admin"}
        invitations = (await self.session.scalars(select(WorkspaceInvitation).where(
            WorkspaceInvitation.workspace_id == workspace_id,
            WorkspaceInvitation.accepted_at.is_(None), WorkspaceInvitation.revoked_at.is_(None),
            WorkspaceInvitation.expires_at > utc_now(),
        ).order_by(WorkspaceInvitation.created_at.desc()))).all() if manager else []
        return {
            "workspaceId": workspace_id, "canManage": manager,
            "canInvite": manager and access.plan.key == "team" and self.settings.billing_enabled,
            "seatLimit": access.plan.members,
            "members": [{"userId": user.id, "name": user.name, "email": user.email,
                         "role": member.role,
                         "suspended": self.settings.billing_enabled
                         and member.role != "owner" and (access.plan.key != "team" or user.id not in seats)}
                        for member, user in rows],
            "invitations": [{"id": item.id, "email": item.email,
                             "expiresAt": item.expires_at} for item in invitations],
        }

    async def remove(self, workspace_id: UUID, actor_id: UUID, user_id: UUID) -> None:
        await self.require_member(actor_id, workspace_id, manager=True)
        await self.lock_workspace(workspace_id)
        await self.require_member(actor_id, workspace_id, manager=True)
        target = await self.session.get(WorkspaceMembership, (workspace_id, user_id))
        if target is None:
            raise AppError(404, "member_not_found", "Workspace member was not found.")
        if target.role == "owner":
            raise AppError(409, "owner_removal_forbidden", "The workspace owner cannot be removed.")
        target.removed_at = utc_now()
        await self.session.commit()

    async def revoke(self, workspace_id: UUID, actor_id: UUID, invitation_id: UUID) -> None:
        await self.require_member(actor_id, workspace_id, manager=True)
        await self.lock_workspace(workspace_id)
        await self.require_member(actor_id, workspace_id, manager=True)
        invitation = await self.session.get(WorkspaceInvitation, invitation_id)
        if invitation is None or invitation.workspace_id != workspace_id:
            raise AppError(404, "invitation_not_found", "Invitation was not found.")
        if invitation.accepted_at is not None:
            raise AppError(409, "invitation_used", "Remove the member from the member list instead.")
        invitation.revoked_at = utc_now()
        await self.session.commit()
