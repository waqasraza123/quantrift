from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.columns import created_at_column, updated_at_column, uuid_primary_key


class BillingRollout(Base):
    __tablename__ = "billing_rollouts"

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class BillingAccount(Base):
    __tablename__ = "billing_accounts"
    __table_args__ = (
        CheckConstraint("plan in ('free', 'pro', 'team')", name="billing_plan_allowed"),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"),
        primary_key=True,
    )
    customer_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    livemode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    subscription_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    price_id: Mapped[str | None] = mapped_column(String(128))
    plan: Mapped[str] = mapped_column(String(16), nullable=False, default="free")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_through: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at = created_at_column()
    updated_at = updated_at_column()


class BillingCheckout(Base):
    __tablename__ = "billing_checkouts"
    __table_args__ = (
        Index("ix_billing_checkout_workspace_created", "workspace_id", "created_at"),
    )

    id = uuid_primary_key()
    workspace_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    plan: Mapped[str] = mapped_column(String(16), nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    url: Mapped[str | None] = mapped_column(String(2048))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="creating")
    created_at = created_at_column()


class BillingEvent(Base):
    __tablename__ = "billing_events"

    event_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(96), nullable=False)
    customer_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    object_id: Mapped[str] = mapped_column(String(128), nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at = created_at_column()


class BillingUsage(Base):
    __tablename__ = "billing_usage"
    __table_args__ = (
        CheckConstraint("status in ('reserved', 'consumed', 'released')", name="usage_status"),
        Index("ix_billing_usage_workspace_period", "workspace_id", "created_at", "status"),
    )

    operation_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)
    workspace_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    operation_kind: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="reserved")
    reserved_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at = created_at_column()
    updated_at = updated_at_column()
