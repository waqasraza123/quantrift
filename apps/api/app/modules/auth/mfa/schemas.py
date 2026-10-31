from datetime import datetime
from typing import Literal

from pydantic import ConfigDict, Field

from app.core.schemas import ApiSchema
from app.modules.auth.schemas import AuthSessionCreated


class AuthMfaChallengeRead(ApiSchema):
    mfa_required: Literal[True] = True
    next_action: Literal["enroll", "verify"]
    challenge_token: str = Field(repr=False)
    expires_at: datetime


class AuthMfaStatusRead(ApiSchema):
    next_action: Literal["enroll", "verify"]
    expires_at: datetime


class AuthMfaSetupRead(ApiSchema):
    secret: str = Field(repr=False)
    otpauth_uri: str = Field(repr=False)
    issuer: str


class AuthMfaVerifyRequest(ApiSchema):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    code: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$", repr=False)


class AuthMfaRecoveryRequest(ApiSchema):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    code: str = Field(min_length=35, max_length=35, pattern=r"^[A-Fa-f0-9]{8}(-[A-Fa-f0-9]{8}){3}$", repr=False)


class AuthMfaSessionRead(AuthSessionCreated):
    mfa_verified: Literal[True] = True
    recovery_codes: list[str] | None = Field(default=None, repr=False)
