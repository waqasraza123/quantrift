from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import Field

from app.core.schemas import ApiReadSchema, ApiSchema
from app.modules.trade_agent.models import (
    TradeAgentObservationLabel,
    TradeAgentPlanStatus,
    TradeAgentReviewDecision,
)


class TradeAgentPlanCreateRequest(ApiSchema):
    force_recompute: bool = False


class TradeAgentReviewRequest(ApiSchema):
    review_decision: TradeAgentReviewDecision
    user_id: UUID | None = None
    notes: str = Field(default="", max_length=8000)
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class TradeAgentObservationRequest(ApiSchema):
    outcome_id: UUID | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class TradeAgentPlanRead(ApiReadSchema):
    id: UUID
    workspace_id: UUID
    signal_id: UUID
    analysis_run_id: UUID
    symbol_id: UUID
    setup_context_id: UUID | None
    status: TradeAgentPlanStatus
    plan_version: str
    directional_bias: str
    readiness_label: str | None
    readiness_score: Decimal | None
    thesis: str
    summary: str
    supporting_evidence_json: list[dict[str, Any]]
    blocker_json: list[dict[str, Any]]
    warning_json: list[dict[str, Any]]
    risk_notes_json: list[dict[str, Any]]
    observation_zones_json: list[dict[str, Any]]
    invalidation_context_json: list[dict[str, Any]]
    target_context_zones_json: list[dict[str, Any]]
    scenario_context_json: list[dict[str, Any]]
    outcome_context_json: list[dict[str, Any]]
    historical_context_json: list[dict[str, Any]]
    safety_json: dict[str, Any]
    metadata_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class TradeAgentReviewRead(ApiReadSchema):
    id: UUID
    workspace_id: UUID
    plan_id: UUID
    user_id: UUID | None
    journal_entry_id: UUID | None
    review_decision: TradeAgentReviewDecision
    notes: str
    metadata_json: dict[str, Any]
    created_at: datetime


class TradeAgentObservationRead(ApiReadSchema):
    id: UUID
    workspace_id: UUID
    plan_id: UUID
    outcome_id: UUID | None
    observation_label: TradeAgentObservationLabel
    reflection_notes: str
    metadata_json: dict[str, Any]
    created_at: datetime
