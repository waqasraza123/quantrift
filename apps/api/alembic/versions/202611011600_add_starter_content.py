from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "202611011600_starter_content"
down_revision: str | Sequence[str] | None = "202611010900_workspace_billing"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workspace_starter_content",
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "source_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("data_sources.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("step", sa.Integer, nullable=False, server_default="0"),
        sa.Column("lease_id", sa.String(64), nullable=True),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "status in ('pending', 'ready', 'disabled', 'existing_data')", name="starter_status"
        ),
        sa.CheckConstraint("step >= 0", name="starter_step"),
    )


def downgrade() -> None:
    op.drop_table("workspace_starter_content")
