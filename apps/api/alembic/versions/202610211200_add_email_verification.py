"""add email verification

Revision ID: 202610211200_email_verification
Revises: 202605121000_auth_activity
Create Date: 2026-10-21 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "202610211200_email_verification"
down_revision: str | Sequence[str] | None = "202605121000_auth_activity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamp_column(name: str) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)


def upgrade() -> None:
    op.add_column(
        "auth_password_credentials",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE auth_password_credentials "
        "SET email_verified_at = created_at "
        "WHERE email_verified_at IS NULL"
    )
    op.create_table(
        "auth_email_verification_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("credential_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("delivery_status", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invalidated_at", sa.DateTime(timezone=True), nullable=True),
        timestamp_column("created_at"),
        timestamp_column("updated_at"),
        sa.CheckConstraint(
            "delivery_status in ('pending', 'sent', 'failed')",
            name="auth_email_verification_tokens_delivery_status_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["credential_id"],
            ["auth_password_credentials.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "token_hash",
            name="uq_auth_email_verification_tokens_token_hash",
        ),
    )
    op.create_index(
        "ix_auth_email_verification_tokens_credential_created",
        "auth_email_verification_tokens",
        ["credential_id", "created_at"],
    )
    op.create_index(
        "ix_auth_email_verification_tokens_expires_at",
        "auth_email_verification_tokens",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_auth_email_verification_tokens_expires_at",
        table_name="auth_email_verification_tokens",
    )
    op.drop_index(
        "ix_auth_email_verification_tokens_credential_created",
        table_name="auth_email_verification_tokens",
    )
    op.drop_table("auth_email_verification_tokens")
    op.drop_column("auth_password_credentials", "email_verified_at")
