from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.errors import AppError
from app.modules.memberships.models import WorkspaceMembership
from app.modules.memberships.service import MembershipService
from app.modules.billing.catalog import PLANS
from app.modules.memberships.scope import active_workspace
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import UserCreate, UserUpdate
from app.modules.workspaces.repository import WorkspaceRepository


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = UserRepository(session)
        self.workspace_repository = WorkspaceRepository(session)

    async def create_user(self, payload: UserCreate) -> User:
        await self.validate_workspace(payload.workspace_id)
        membership_service = MembershipService(self.session, get_settings())
        await membership_service.lock_workspace(payload.workspace_id)
        owner = await self.session.scalar(select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == payload.workspace_id,
            WorkspaceMembership.role == "owner",
        ))
        if get_settings().billing_enabled and owner is not None:
            await membership_service.require_team(payload.workspace_id)
            if await membership_service.seat_count(payload.workspace_id) >= PLANS["team"].members:
                raise AppError(409, "team_seats_exhausted", "No Team seats are available.")
        user = User(**payload.model_dump(mode="python"))
        try:
            created_user = await self.repository.create(user)
            self.session.add(WorkspaceMembership(workspace_id=payload.workspace_id, user_id=created_user.id,
                                                  role=payload.role.value if owner is not None else "owner"))
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise AppError(409, "user_conflict", "User already exists") from error
        return created_user

    async def list_users(
        self,
        limit: int,
        offset: int,
        workspace_id: UUID | None = None,
    ) -> list[User]:
        return await self.repository.list(limit=limit, offset=offset, workspace_id=workspace_id)

    async def get_user(self, user_id: UUID) -> User:
        user = await self.repository.get_by_id(user_id)
        if user is None:
            raise AppError(404, "user_not_found", "User not found")
        return user

    async def update_user(self, user_id: UUID, payload: UserUpdate) -> User:
        user = await self.get_user(user_id)
        if active_workspace.get() is not None and user.workspace_id != active_workspace.get():
            raise AppError(403, "member_profile_restricted", "Team members manage their own account profile.")
        updates = payload.model_dump(exclude_unset=True, mode="python")
        for field_name, field_value in updates.items():
            setattr(user, field_name, field_value)
        membership = await self.session.get(WorkspaceMembership, (user.workspace_id, user.id))
        if membership is not None and membership.role != "owner" and payload.role is not None:
            membership.role = payload.role.value
        try:
            await self.session.flush()
            await self.session.refresh(user)
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise AppError(409, "user_conflict", "User already exists") from error
        return user

    async def validate_workspace(self, workspace_id: UUID) -> None:
        workspace = await self.workspace_repository.get_by_id(workspace_id)
        if workspace is None:
            raise AppError(404, "workspace_not_found", "Workspace not found")
