from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.base import Base
from app.dependencies import database_session
from app.modules.ai_intelligence.models import AiIntelligenceRun
from app.modules.analysis.models import AnalysisRun
from app.modules.auth.dependencies import optional_identity
from app.modules.auth.identity import IdentityContext
from app.modules.auth.settings import auth_is_enforced
from app.modules.permissions.registry import Permission
from app.modules.reasoning.models import LlmReasoningRun
from app.modules.scenario_ensembles.models import ScenarioEnsembleRun
from app.modules.signals.models import Signal


async def authorize_ai_artifact(
    request: Request,
    session: Annotated[AsyncSession, Depends(database_session)],
    identity: Annotated[IdentityContext | None, Depends(optional_identity)],
) -> None:
    if not auth_is_enforced(request.app.state.settings):
        return
    if identity is None:
        raise AppError(401, "authentication_required", "Sign in to access AI research.")
    models: dict[str, type[Base]] = {
        "signal_id": Signal, "analysis_run_id": AnalysisRun,
        "reasoning_run_id": LlmReasoningRun, "ensemble_run_id": ScenarioEnsembleRun,
    }
    if "/ai-intelligence/" in request.url.path:
        models["run_id"] = AiIntelligenceRun
    for parameter, model in models.items():
        raw = request.path_params.get(parameter)
        if raw is None:
            continue
        try:
            resource_id = UUID(str(raw))
        except ValueError as error:
            raise AppError(422, "invalid_resource_id", "Resource identifier is invalid.") from error
        resource = await session.get(model, resource_id)
        workspace_id = getattr(resource, "workspace_id", None)
        permission = Permission.ANALYSIS_READ if request.method == "GET" else Permission.ANALYSIS_WRITE
        if resource is None or not identity.has_permission(permission, workspace_id):
            raise AppError(404, "research_not_found", "Research was not found in this workspace.")
