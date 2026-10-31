from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.dependencies import database_session
from app.modules.auth.dependencies import get_current_identity
from app.modules.auth.identity import IdentityContext
from app.modules.permissions.dependencies import require_permission
from app.modules.permissions.registry import Permission
from app.modules.starter_content.builder import TOTAL_STEPS
from app.modules.starter_content.schemas import StarterContentAction, StarterContentRead
from app.modules.starter_content.service import StarterContentService

router = APIRouter(prefix="/workspaces", tags=["starter-content"])


def validate_workspace(identity: IdentityContext, workspace_id: UUID) -> None:
    if not identity.can_access_workspace(workspace_id):
        raise AppError(403, "workspace_access_denied", "Workspace access denied")


@router.get(
    "/{workspace_id}/starter-content",
    response_model=StarterContentRead,
    dependencies=[Depends(require_permission(Permission.WORKSPACE_READ))],
)
async def get_starter_content(
    workspace_id: UUID,
    request: Request,
    session: Annotated[AsyncSession, Depends(database_session)],
    identity: Annotated[IdentityContext, Depends(get_current_identity)],
) -> StarterContentRead:
    validate_workspace(identity, workspace_id)
    if not request.app.state.settings.starter_content_enabled:
        return StarterContentRead(status="disabled", total_steps=TOTAL_STEPS, can_initialize=False)
    return await StarterContentService(session, request.app.state.settings, workspace_id).status(
        identity.has_permission(Permission.WORKSPACE_WRITE, workspace_id),
    )


@router.post(
    "/{workspace_id}/starter-content",
    response_model=StarterContentRead,
    dependencies=[Depends(require_permission(Permission.WORKSPACE_WRITE))],
)
async def prepare_starter_content(
    workspace_id: UUID,
    payload: StarterContentAction,
    request: Request,
    session: Annotated[AsyncSession, Depends(database_session)],
    identity: Annotated[IdentityContext, Depends(get_current_identity)],
) -> StarterContentRead:
    validate_workspace(identity, workspace_id)
    if not request.app.state.settings.starter_content_enabled:
        return StarterContentRead(status="disabled", total_steps=TOTAL_STEPS, can_initialize=False)
    service = StarterContentService(session, request.app.state.settings, workspace_id)
    return await service.disable() if payload.action == "disable" else await service.advance()
