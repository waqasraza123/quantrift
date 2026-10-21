from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import database_session
from app.modules.permissions.dependencies import require_permission
from app.modules.permissions.registry import Permission
from app.modules.trade_agent.schemas import (
    TradeAgentObservationRead,
    TradeAgentObservationRequest,
    TradeAgentPlanCreateRequest,
    TradeAgentPlanRead,
    TradeAgentReviewRead,
    TradeAgentReviewRequest,
)
from app.modules.trade_agent.service import TradeAgentService

router = APIRouter(prefix="/trade-agent", tags=["trade-agent"])


def get_trade_agent_service(
    session: Annotated[AsyncSession, Depends(database_session)],
) -> TradeAgentService:
    return TradeAgentService(session)


@router.post(
    "/plans/from-signal/{signal_id}",
    response_model=TradeAgentPlanRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(Permission.ANALYSIS_WRITE))],
)
async def create_trade_agent_plan_from_signal(
    signal_id: UUID,
    payload: TradeAgentPlanCreateRequest,
    service: Annotated[TradeAgentService, Depends(get_trade_agent_service)],
) -> TradeAgentPlanRead:
    return await service.create_plan_from_signal(
        signal_id=signal_id,
        force_recompute=payload.force_recompute,
    )


@router.get("/plans", response_model=list[TradeAgentPlanRead])
async def list_trade_agent_plans(
    service: Annotated[TradeAgentService, Depends(get_trade_agent_service)],
    workspace_id: Annotated[UUID, Query(alias="workspaceId")],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    signal_id: Annotated[UUID | None, Query(alias="signalId")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[TradeAgentPlanRead]:
    return await service.list_plans(
        workspace_id=workspace_id,
        status=status_filter,
        signal_id=signal_id,
        limit=limit,
        offset=offset,
    )


@router.get("/plans/{plan_id}", response_model=TradeAgentPlanRead)
async def get_trade_agent_plan(
    plan_id: UUID,
    service: Annotated[TradeAgentService, Depends(get_trade_agent_service)],
) -> TradeAgentPlanRead:
    return await service.get_plan(plan_id)


@router.post(
    "/plans/{plan_id}/review",
    response_model=TradeAgentReviewRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(Permission.JOURNAL_WRITE))],
)
async def review_trade_agent_plan(
    plan_id: UUID,
    payload: TradeAgentReviewRequest,
    service: Annotated[TradeAgentService, Depends(get_trade_agent_service)],
) -> TradeAgentReviewRead:
    return await service.review_plan(plan_id, payload)


@router.post(
    "/plans/{plan_id}/observe",
    response_model=TradeAgentObservationRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(Permission.JOURNAL_WRITE))],
)
async def observe_trade_agent_plan(
    plan_id: UUID,
    payload: TradeAgentObservationRequest,
    service: Annotated[TradeAgentService, Depends(get_trade_agent_service)],
) -> TradeAgentObservationRead:
    return await service.observe_plan(plan_id, payload)
