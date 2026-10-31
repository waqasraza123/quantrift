from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "202610311600_auth_mfa"
down_revision: str | Sequence[str] | None = "202610311200_trade_suggestions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamp(name: str) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


def credential_column() -> sa.Column:
    return sa.Column(
        "credential_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("auth_password_credentials.id", ondelete="CASCADE"), nullable=False,
    )


def workspace_column() -> sa.Column:
    return sa.Column(
        "workspace_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False,
    )


def upgrade() -> None:
    op.add_column("auth_sessions", sa.Column("mfa_verified_at", sa.DateTime(timezone=True)))
    op.add_column("auth_sessions", sa.Column("mfa_version", sa.Integer()))
    op.create_table(
        "auth_mfa_factors",
        credential_column(), workspace_column(),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("secret_ciphertext", sa.Text()),
        sa.Column("enabled_at", sa.DateTime(timezone=True)),
        sa.Column("last_counter", sa.BigInteger()),
        sa.Column("failed_attempts", sa.Integer(), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        timestamp("created_at"), timestamp("updated_at"),
        sa.PrimaryKeyConstraint("credential_id"),
        sa.CheckConstraint("version >= 1", name="auth_mfa_factor_version_positive"),
        sa.CheckConstraint("failed_attempts >= 0", name="auth_mfa_factor_attempts_nonnegative"),
    )
    op.create_index("ix_auth_mfa_factor_workspace_user", "auth_mfa_factors", ["workspace_id", "user_id"])
    op.create_table(
        "auth_mfa_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        credential_column(), workspace_column(),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("password_fingerprint", sa.String(64), nullable=False),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("factor_version", sa.Integer(), nullable=False),
        sa.Column("secret_ciphertext", sa.Text()),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)), timestamp("created_at"),
        sa.CheckConstraint("purpose in ('enroll', 'verify', 'replace')", name="auth_mfa_challenge_purpose"),
        sa.CheckConstraint("attempts >= 0", name="auth_mfa_challenge_attempts"),
    )
    op.create_index("ix_auth_mfa_challenge_credential", "auth_mfa_challenges", ["credential_id", "created_at"])
    op.create_index("ix_auth_mfa_challenge_expires", "auth_mfa_challenges", ["expires_at"])
    op.create_table(
        "auth_mfa_recovery_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        credential_column(), workspace_column(),
        sa.Column("code_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("used_at", sa.DateTime(timezone=True)), timestamp("created_at"),
    )
    op.create_index("ix_auth_mfa_recovery_credential", "auth_mfa_recovery_codes", ["credential_id"])


def downgrade() -> None:
    op.drop_table("auth_mfa_recovery_codes")
    op.drop_table("auth_mfa_challenges")
    op.drop_table("auth_mfa_factors")
    op.drop_column("auth_sessions", "mfa_version")
    op.drop_column("auth_sessions", "mfa_verified_at")
