from collections.abc import AsyncIterator
from contextvars import ContextVar
from uuid import UUID

from fastapi import Request
from sqlalchemy import event, or_, select
from sqlalchemy.orm import ORMExecuteState, Session, with_loader_criteria

from app.core.errors import AppError
from app.db.base import Base
from app.modules.auth.dependencies import get_current_identity
from app.modules.auth.settings import auth_is_enforced
from app.modules.auth.workspace_context import resolve_request_workspace_id
from app.modules.memberships.models import WorkspaceMembership
from app.modules.users.models import User
from app.modules.workspaces.models import Workspace

active_workspace: ContextVar[UUID | None] = ContextVar("active_workspace", default=None)
PUBLIC_PATHS = frozenset({
    "/auth/register", "/auth/login", "/auth/email/verify", "/auth/email/resend",
    "/billing/plans", "/billing/webhook", "/openapi.json", "/docs", "/redoc",
})


async def workspace_scope(request: Request) -> AsyncIterator[None]:
    settings = request.app.state.settings
    path = request.url.path.removeprefix(settings.api_prefix) if settings.api_prefix else request.url.path
    if not auth_is_enforced(settings) or path in PUBLIC_PATHS or path.startswith(("/health", "/auth/mfa")):
        yield
        return
    identity = await get_current_identity(request)
    workspace_id = identity.workspace_id
    supplied_workspace = await resolve_request_workspace_id(request)
    if path != "/auth/workspace" and not identity.can_access_workspace(supplied_workspace):
        raise AppError(403, "workspace_access_denied", "Choose this workspace before accessing its data.")
    token = active_workspace.set(workspace_id)
    try:
        yield
    finally:
        active_workspace.reset(token)


@event.listens_for(Session, "do_orm_execute")
def scope_workspace_records(state: ORMExecuteState) -> None:
    workspace_id = active_workspace.get()
    if workspace_id is None or not (state.is_select or state.is_update or state.is_delete):
        return
    criteria = []
    for mapper in tuple(Base.registry.mappers):
        model = mapper.class_
        if model in {Workspace, User} or model.__module__.startswith((
            "app.modules.auth.", "app.modules.billing.", "app.modules.memberships.",
        )):
            continue
        column = getattr(model, "workspace_id", None)
        if column is not None:
            criteria.append(with_loader_criteria(model, column == workspace_id, include_aliases=True))
    criteria.append(with_loader_criteria(User, or_(User.workspace_id == workspace_id, User.id.in_(
        select(WorkspaceMembership.user_id).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.removed_at.is_(None),
        )
    )), include_aliases=True))
    state.statement = state.statement.options(*criteria)
