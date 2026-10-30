from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.dependencies import database_session
from app.modules.auth.dependencies import legacy_admin_header_is_valid, optional_identity
from app.modules.auth.settings import auth_is_enforced
from app.modules.permissions.dependencies import require_permission
from app.modules.permissions.registry import Permission
from app.modules.trade_agent.suggestions.schemas import (
    SuggestionAvailability,
    SuggestionCreate,
    SuggestionRead,
)
from app.modules.trade_agent.suggestions.service import SuggestionService

router = APIRouter(prefix="/trade-agent/suggestions", tags=["trade-suggestions"])


def get_suggestion_service(
    request: Request, session: Annotated[AsyncSession, Depends(database_session)]
) -> SuggestionService:
    return SuggestionService(session, request.app.state.settings)


async def authorize_workspace(request: Request, workspace_id: UUID, permission: Permission) -> None:
    if not auth_is_enforced(request.app.state.settings) or legacy_admin_header_is_valid(request):
        return
    identity = await optional_identity(request)
    if identity is None or not identity.has_permission(permission, workspace_id):
        raise AppError(403, "workspace_access_denied", "Workspace access denied.")


@router.get(
    "/availability", response_model=SuggestionAvailability,
    dependencies=[Depends(require_permission(Permission.ANALYSIS_READ))],
)
async def suggestion_availability(
    service: Annotated[SuggestionService, Depends(get_suggestion_service)],
) -> SuggestionAvailability:
    return service.availability()


@router.post(
    "/from-signal/{signal_id}", response_model=SuggestionRead,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_permission(Permission.ANALYSIS_WRITE))],
)
async def create_suggestion(
    signal_id: UUID, payload: SuggestionCreate, request: Request,
    service: Annotated[SuggestionService, Depends(get_suggestion_service)],
) -> SuggestionRead:
    signal = await service.require_signal(signal_id)
    await authorize_workspace(request, signal.workspace_id, Permission.ANALYSIS_WRITE)
    result = await service.create(signal, payload)
    await service.session.commit()
    return result


@router.get(
    "", response_model=list[SuggestionRead],
    dependencies=[Depends(require_permission(Permission.ANALYSIS_READ))],
)
async def list_suggestions(
    request: Request, service: Annotated[SuggestionService, Depends(get_suggestion_service)],
    workspace_id: Annotated[UUID, Query(alias="workspaceId")],
    signal_id: Annotated[UUID, Query(alias="signalId")],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[SuggestionRead]:
    await authorize_workspace(request, workspace_id, Permission.ANALYSIS_READ)
    signal = await service.require_signal(signal_id)
    if signal.workspace_id != workspace_id:
        raise AppError(404, "signal_not_found", "Signal not found in this workspace.")
    runs = await service.repository.list_runs(workspace_id, signal_id, limit)
    results = [await service.read(run) for run in runs]
    await service.session.commit()
    return results


@router.get(
    "/{suggestion_id}", response_model=SuggestionRead,
    dependencies=[Depends(require_permission(Permission.ANALYSIS_READ))],
)
async def get_suggestion(
    suggestion_id: UUID, request: Request,
    service: Annotated[SuggestionService, Depends(get_suggestion_service)],
) -> SuggestionRead:
    run = await service.require_run(suggestion_id)
    await authorize_workspace(request, run.workspace_id, Permission.ANALYSIS_READ)
    result = await service.read(run)
    await service.session.commit()
    return result
