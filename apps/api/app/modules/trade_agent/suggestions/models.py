from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.columns import created_at_column, updated_at_column, uuid_primary_key


class TradeSuggestionRun(Base):
    __tablename__ = "trade_suggestion_runs"
    __table_args__ = (
        CheckConstraint(
            "status in ('queued', 'running', 'completed', 'blocked', 'failed')",
            name="trade_suggestion_status_allowed",
        ),
        UniqueConstraint("workspace_id", "request_id", name="uq_trade_suggestion_request"),
        Index("ix_trade_suggestion_workspace_created", "workspace_id", "created_at"),
        Index("ix_trade_suggestion_signal_created", "signal_id", "created_at"),
    )

    id = uuid_primary_key()
    workspace_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE")
    )
    signal_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("signals.id", ondelete="CASCADE")
    )
    request_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True))
    job_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("job_queue_items.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(16))
    stage: Mapped[str] = mapped_column(String(40))
    fingerprint: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(40))
    context_json: Mapped[dict[str, Any]] = mapped_column(JSONB)
    result_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    review_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    usage_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    reward_risk: Mapped[str | None] = mapped_column(String(80))
    error_code: Mapped[str | None] = mapped_column(String(80))
    error_message: Mapped[str | None] = mapped_column(String(500))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at = created_at_column()
    updated_at = updated_at_column()
