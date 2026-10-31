from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "202611010900_workspace_billing"
down_revision: str | Sequence[str] | None = "202610311600_auth_mfa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PREVIOUS_JOB_TYPES = (
    "'import.csv', 'import.json', 'provider_polling.fetch', 'scan.run', "
    "'daily_workflow.run', 'outcome.evaluate', 'reasoning.generate', "
    "'notification.deliver', 'read_model.rebuild', 'backfill.item', "
    "'data_quality.run', 'retention.apply', 'llm.explain', 'report.build', "
    "'equity_data.operation', 'trade_agent.suggest'"
)


def timestamp(name: str, *, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable,
                     server_default=None if nullable else sa.func.now())


def workspace_column(*, primary_key: bool = False) -> sa.Column:
    return sa.Column("workspace_id", postgresql.UUID(as_uuid=True),
                     sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
                     primary_key=primary_key, nullable=False)


def user_column(name: str = "user_id", *, primary_key: bool = False) -> sa.Column:
    return sa.Column(name, postgresql.UUID(as_uuid=True),
                     sa.ForeignKey("users.id", ondelete="CASCADE"),
                     primary_key=primary_key, nullable=False)


def update_job_constraints(types: str) -> None:
    for table in ("job_queue_definitions", "job_queue_items"):
        name = f"{table}_job_type_allowed"
        op.drop_constraint(name, table, type_="check")
        op.create_check_constraint(name, table, f"job_type in ({types})")


def upgrade() -> None:
    op.create_table(
        "workspace_memberships", workspace_column(primary_key=True),
        user_column(primary_key=True), sa.Column("role", sa.String(16), nullable=False),
        timestamp("removed_at", nullable=True), timestamp("created_at"), timestamp("updated_at"),
        sa.CheckConstraint("role in ('owner', 'admin', 'analyst', 'user')", name="membership_role"),
    )
    op.create_index("uq_workspace_owner", "workspace_memberships", ["workspace_id"],
                    unique=True, postgresql_where=sa.text("role = 'owner'"))
    op.execute(sa.text("""
        INSERT INTO workspace_memberships (workspace_id, user_id, role)
        SELECT workspace_id, id,
               CASE WHEN position = 1 THEN 'owner' ELSE role END
        FROM (
            SELECT id, workspace_id, role,
                   row_number() OVER (
                       PARTITION BY workspace_id
                       ORDER BY (role = 'admin') DESC, created_at, id
                   ) AS position
            FROM users
        ) AS ranked_users
    """))
    op.create_table(
        "workspace_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        workspace_column(), user_column("invited_by"),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        timestamp("expires_at"), timestamp("accepted_at", nullable=True),
        timestamp("revoked_at", nullable=True), timestamp("delivered_at", nullable=True),
        timestamp("created_at"),
    )
    op.create_index("ix_workspace_invitation_pending", "workspace_invitations",
                    ["workspace_id", "expires_at"])
    op.create_table(
        "billing_rollouts", sa.Column("key", sa.String(32), primary_key=True),
        timestamp("activated_at"),
    )
    op.create_table(
        "billing_accounts", workspace_column(primary_key=True),
        sa.Column("livemode", sa.Boolean(), nullable=False),
        sa.Column("customer_id", sa.String(128), unique=True),
        sa.Column("subscription_id", sa.String(128), unique=True),
        sa.Column("price_id", sa.String(128)),
        sa.Column("plan", sa.String(16), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        timestamp("period_start", nullable=True), timestamp("period_end", nullable=True),
        timestamp("paid_through", nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False),
        timestamp("last_synced_at", nullable=True), timestamp("created_at"), timestamp("updated_at"),
        sa.CheckConstraint("plan in ('free', 'pro', 'team')", name="billing_plan_allowed"),
    )
    op.create_table(
        "billing_checkouts", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        workspace_column(), sa.Column("plan", sa.String(16), nullable=False),
        sa.Column("session_id", sa.String(128), unique=True), sa.Column("url", sa.String(2048)),
        timestamp("expires_at", nullable=True), sa.Column("status", sa.String(24), nullable=False),
        timestamp("created_at"),
    )
    op.create_index("ix_billing_checkout_workspace_created", "billing_checkouts",
                    ["workspace_id", "created_at"])
    op.create_table(
        "billing_events", sa.Column("event_id", sa.String(128), primary_key=True),
        sa.Column("event_type", sa.String(96), nullable=False),
        sa.Column("customer_id", sa.String(128), nullable=False),
        sa.Column("object_id", sa.String(128), nullable=False),
        timestamp("processed_at", nullable=True), timestamp("created_at"),
    )
    op.create_index("ix_billing_events_customer_id", "billing_events", ["customer_id"])
    op.create_table(
        "billing_usage", sa.Column("operation_id", postgresql.UUID(as_uuid=True), primary_key=True),
        workspace_column(), sa.Column("operation_kind", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False), timestamp("reserved_until"),
        timestamp("created_at"), timestamp("updated_at"),
        sa.CheckConstraint("status in ('reserved', 'consumed', 'released')", name="usage_status"),
    )
    op.create_index("ix_billing_usage_workspace_period", "billing_usage",
                    ["workspace_id", "created_at", "status"])
    op.add_column("auth_email_verification_tokens", sa.Column("continuation_path", sa.String(2048)))
    update_job_constraints(f"{PREVIOUS_JOB_TYPES}, 'billing.reconcile'")


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM job_queue_items WHERE job_type = 'billing.reconcile'"))
    op.execute(sa.text("DELETE FROM job_queue_definitions WHERE job_type = 'billing.reconcile'"))
    update_job_constraints(PREVIOUS_JOB_TYPES)
    op.drop_column("auth_email_verification_tokens", "continuation_path")
    for table in ("billing_usage", "billing_events", "billing_checkouts", "billing_accounts",
                  "billing_rollouts", "workspace_invitations", "workspace_memberships"):
        op.drop_table(table)
