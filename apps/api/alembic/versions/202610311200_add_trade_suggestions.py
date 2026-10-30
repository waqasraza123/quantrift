from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "202610311200_trade_suggestions"
down_revision: str | Sequence[str] | None = "202610221000_auth_trade_agent_merge"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PREVIOUS_JOB_TYPES = (
    "'import.csv', 'import.json', 'provider_polling.fetch', 'scan.run', "
    "'daily_workflow.run', 'outcome.evaluate', 'reasoning.generate', "
    "'notification.deliver', 'read_model.rebuild', 'backfill.item', "
    "'data_quality.run', 'retention.apply', 'llm.explain', 'report.build', "
    "'equity_data.operation'"
)


def update_job_constraints(job_types: str) -> None:
    for table in ("job_queue_definitions", "job_queue_items"):
        constraint = f"{table}_job_type_allowed"
        op.drop_constraint(constraint, table, type_="check")
        op.create_check_constraint(constraint, table, f"job_type in ({job_types})")


def upgrade() -> None:
    update_job_constraints(f"{PREVIOUS_JOB_TYPES}, 'trade_agent.suggest'")
    op.create_table(
        "trade_suggestion_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("signal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("stage", sa.String(40), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("prompt_version", sa.String(40), nullable=False),
        sa.Column("context_json", postgresql.JSONB(), nullable=False),
        sa.Column("result_json", postgresql.JSONB(), nullable=True),
        sa.Column("review_json", postgresql.JSONB(), nullable=True),
        sa.Column("usage_json", postgresql.JSONB(), nullable=False),
        sa.Column("reward_risk", sa.String(80), nullable=True),
        sa.Column("error_code", sa.String(80), nullable=True),
        sa.Column("error_message", sa.String(500), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status in ('queued', 'running', 'completed', 'blocked', 'failed')",
            name="trade_suggestion_status_allowed",
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["signal_id"], ["signals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["job_queue_items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "request_id", name="uq_trade_suggestion_request"),
    )
    op.create_index(
        "ix_trade_suggestion_workspace_created", "trade_suggestion_runs", ["workspace_id", "created_at"]
    )
    op.create_index(
        "ix_trade_suggestion_signal_created", "trade_suggestion_runs", ["signal_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_table("trade_suggestion_runs")
    op.execute(sa.text("DELETE FROM job_queue_items WHERE job_type = 'trade_agent.suggest'"))
    op.execute(sa.text("DELETE FROM job_queue_definitions WHERE job_type = 'trade_agent.suggest'"))
    update_job_constraints(PREVIOUS_JOB_TYPES)
