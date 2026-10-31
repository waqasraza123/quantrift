from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.columns import created_at_column, updated_at_column


class WorkspaceStarterContent(Base):
    __tablename__ = "workspace_starter_content"
    __table_args__ = (
        CheckConstraint(
            "status in ('pending', 'ready', 'disabled', 'existing_data')", name="starter_status"
        ),
        CheckConstraint("step >= 0", name="starter_step"),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        primary_key=True,
    )
    source_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("data_sources.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(24), default="pending")
    step: Mapped[int] = mapped_column(Integer, default=0)
    lease_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()
