from typing import Annotated

from fastapi import Depends

from app.core.errors import AppError
from app.modules.auth.dependencies import get_current_identity
from app.modules.auth.identity import IdentityContext
from app.modules.auth.schemas import IdentitySource


async def billing_identity(
    identity: Annotated[IdentityContext, Depends(get_current_identity)],
) -> IdentityContext:
    if identity.source != IdentitySource.SESSION or identity.user is None or identity.workspace is None:
        raise AppError(401, "session_auth_required", "Sign in with a verified account to continue.")
    return identity
