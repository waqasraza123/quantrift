from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.dependencies import database_session
from app.modules.auth.activity import (
    AuthActivityDraft, AuthActivityEventType, AuthActivityService, AuthActivityStatus,
    activity_context_from_request,
)
from app.modules.auth.mfa.crypto import token_hash
from app.modules.auth.mfa.schemas import (
    AuthMfaChallengeRead, AuthMfaRecoveryRequest, AuthMfaSessionRead, AuthMfaSetupRead,
    AuthMfaStatusRead, AuthMfaVerifyRequest,
)
from app.modules.auth.mfa.service import MfaService

bearer = HTTPBearer(auto_error=False)
router = APIRouter(prefix="/mfa", tags=["auth"])


async def challenge_token(
    request: Request,
    response: Response,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> str:
    from app.modules.auth.routes import enforce_auth_rate_limit

    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise MfaService.expired()
    await enforce_auth_rate_limit(
        request, scope="mfa", identifier=token_hash(credentials.credentials),
        requests_per_minute=request.app.state.settings.auth_login_rate_limit_per_minute,
    )
    return credentials.credentials


@router.get("/status", response_model=AuthMfaStatusRead)
async def status(
    request: Request,
    token: Annotated[str, Depends(challenge_token)],
    session: Annotated[AsyncSession, Depends(database_session)],
) -> AuthMfaStatusRead:
    return await MfaService(session, request.app.state.settings).status(token)


@router.post("/setup", response_model=AuthMfaSetupRead)
async def setup(
    request: Request,
    token: Annotated[str, Depends(challenge_token)],
    session: Annotated[AsyncSession, Depends(database_session)],
) -> AuthMfaSetupRead:
    return await MfaService(session, request.app.state.settings).setup(token)


@router.post("/verify", response_model=AuthMfaSessionRead)
async def verify(
    payload: AuthMfaVerifyRequest,
    request: Request,
    token: Annotated[str, Depends(challenge_token)],
    session: Annotated[AsyncSession, Depends(database_session)],
) -> AuthMfaSessionRead:
    try:
        result = await MfaService(session, request.app.state.settings).verify(token, payload.code)
    except AppError as error:
        await AuthActivityService(session).record(
            AuthActivityDraft(
                event_type=AuthActivityEventType.LOGIN, status=AuthActivityStatus.FAILURE,
                error_code=error.code, metadata={"stage": "authenticator"},
            ), activity_context_from_request(request),
        )
        raise
    await AuthActivityService(session).record(
        AuthActivityDraft(
            event_type=AuthActivityEventType.LOGIN, status=AuthActivityStatus.SUCCESS,
            user_id=result.identity.user.id if result.identity.user else None,
            workspace_id=result.identity.workspace.id if result.identity.workspace else None,
            metadata={"stage": "authenticator"},
        ), activity_context_from_request(request),
    )
    return result


@router.post("/recover", response_model=AuthMfaChallengeRead)
async def recover(
    payload: AuthMfaRecoveryRequest,
    request: Request,
    token: Annotated[str, Depends(challenge_token)],
    session: Annotated[AsyncSession, Depends(database_session)],
) -> AuthMfaChallengeRead:
    return await MfaService(session, request.app.state.settings).recover(token, payload.code)


@router.post("/cancel", status_code=204, response_model=None, response_class=Response)
async def cancel(
    request: Request,
    token: Annotated[str, Depends(challenge_token)],
    session: Annotated[AsyncSession, Depends(database_session)],
) -> Response:
    await MfaService(session, request.app.state.settings).cancel(token)
    return Response(status_code=204, headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})
