from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.columns import created_at_column, updated_at_column, uuid_primary_key


class TradeAgentPlanStatus(StrEnum):
    DRAFT = "draft"
    READY_FOR_REVIEW = "ready_for_review"
    PAPER_FOLLOWED = "paper_followed"
    OBSERVED_ONLY = "observed_only"
    DISMISSED = "dismissed"
    EXPIRED = "expired"
    REVIEWED = "reviewed"


class TradeAgentReviewDecision(StrEnum):
    PAPER_FOLLOW = "paper_follow"
    OBSERVE_ONLY = "observe_only"
    DISMISS = "dismiss"
    NEEDS_MORE_CONTEXT = "needs_more_context"
    NO_ACTION = "no_action"


class TradeAgentObservationLabel(StrEnum):
    ALIGNED = "aligned"
    CONFLICTED = "conflicted"
    INCONCLUSIVE = "inconclusive"
    INSUFFICIENT_OUTCOME_DATA = "insufficient_outcome_data"
    NEEDS_MORE_REVIEW = "needs_more_review"


class TradeAgentPlan(Base):
    __tablename__ = "trade_agent_plans"
    __table_args__ = (
        CheckConstraint(
            "status in ('draft', 'ready_for_review', 'paper_followed', 'observed_only', "
            "'dismissed', 'expired', 'reviewed')",
            name="trade_agent_plans_status_allowed",
        ),
        CheckConstraint(
            "readiness_score is null or (readiness_score >= 0 and readiness_score <= 1)",
            name="trade_agent_plans_readiness_score_range",
        ),
        UniqueConstraint(
            "signal_id",
            "plan_version",
            name="uq_trade_agent_plans_signal_version",
        ),
        Index(
            "ix_trade_agent_plans_workspace_status_created",
            "workspace_id",
            "status",
            "created_at",
        ),
        Index("ix_trade_agent_plans_signal_id", "signal_id"),
        Index("ix_trade_agent_plans_setup_context_id", "setup_context_id"),
    )

    id = uuid_primary_key()
    workspace_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    signal_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("signals.id", ondelete="CASCADE"),
        nullable=False,
    )
    analysis_run_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    symbol_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("symbols.id", ondelete="RESTRICT"),
        nullable=False,
    )
    setup_context_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("setup_contexts.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    plan_version: Mapped[str] = mapped_column(String(40), nullable=False)
    directional_bias: Mapped[str] = mapped_column(String(32), nullable=False)
    readiness_label: Mapped[str | None] = mapped_column(String(32), nullable=True)
    readiness_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    thesis: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    supporting_evidence_json: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    blocker_json: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    warning_json: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    risk_notes_json: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    observation_zones_json: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    invalidation_context_json: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    target_context_zones_json: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    scenario_context_json: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    outcome_context_json: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    historical_context_json: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    safety_json: Mapped[dict[str, object]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    metadata_json: Mapped[dict[str, object]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()


class TradeAgentReview(Base):
    __tablename__ = "trade_agent_reviews"
    __table_args__ = (
        CheckConstraint(
            "review_decision in ('paper_follow', 'observe_only', 'dismiss', "
            "'needs_more_context', 'no_action')",
            name="trade_agent_reviews_decision_allowed",
        ),
        Index("ix_trade_agent_reviews_plan_created", "plan_id", "created_at"),
        Index("ix_trade_agent_reviews_workspace_created", "workspace_id", "created_at"),
    )

    id = uuid_primary_key()
    workspace_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    plan_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("trade_agent_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    journal_entry_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("journal_entries.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_decision: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict[str, object]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = created_at_column()


class TradeAgentObservation(Base):
    __tablename__ = "trade_agent_observations"
    __table_args__ = (
        CheckConstraint(
            "observation_label in ('aligned', 'conflicted', 'inconclusive', "
            "'insufficient_outcome_data', 'needs_more_review')",
            name="trade_agent_observations_label_allowed",
        ),
        Index("ix_trade_agent_observations_plan_created", "plan_id", "created_at"),
        Index("ix_trade_agent_observations_workspace_created", "workspace_id", "created_at"),
    )

    id = uuid_primary_key()
    workspace_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    plan_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("trade_agent_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    outcome_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("signal_outcomes.id", ondelete="SET NULL"),
        nullable=True,
    )
    observation_label: Mapped[str] = mapped_column(String(40), nullable=False)
    reflection_notes: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict[str, object]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = created_at_column()
