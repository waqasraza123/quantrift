from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.schemas import ApiReadSchema, ApiSchema


class AgentOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class SetupProposal(AgentOutput):
    decision: Literal["BUY", "SELL", "WAIT"]
    entry_lower: float | None
    entry_upper: float | None
    stop_loss: float | None
    targets: list[float] = Field(max_length=3)
    rationale: str = Field(min_length=1, max_length=3000)
    evidence_refs: list[str] = Field(min_length=1, max_length=12)
    invalidation: str = Field(min_length=1, max_length=1500)
    risks: list[str] = Field(max_length=8)


class RiskReview(AgentOutput):
    verdict: Literal["approve", "revise", "wait"]
    summary: str = Field(min_length=1, max_length=3000)
    evidence_refs: list[str] = Field(min_length=1, max_length=12)


class SuggestionCreate(ApiSchema):
    request_id: UUID
    regenerate: bool = False


class SuggestionRead(ApiReadSchema):
    id: UUID
    workspace_id: UUID
    signal_id: UUID
    status: Literal["queued", "running", "completed", "blocked", "failed"]
    stage: str
    result_json: SetupProposal | None
    review_json: RiskReview | None
    reward_risk: str | None
    context_json: dict[str, Any]
    model: str
    prompt_version: str
    usage_json: dict[str, Any]
    error_code: str | None
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    expires_at: datetime | None
    is_outdated: bool = False
    actionable: bool = False


class SuggestionAvailability(ApiSchema):
    enabled: bool
    reason: str | None
