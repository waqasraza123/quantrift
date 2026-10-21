"""add trade agent paper plans

Revision ID: 202605151000_trade_agent
Revises: 202605121000_auth_activity
Create Date: 2026-05-15 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "202605151000_trade_agent"
down_revision: str | Sequence[str] | None = "202605121000_auth_activity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamp_column(name: str) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)


def json_object_column(name: str) -> sa.Column:
    return sa.Column(
        name,
        postgresql.JSONB(astext_type=sa.Text()),
        server_default=sa.text("'{}'::jsonb"),
        nullable=False,
    )


def json_array_column(name: str) -> sa.Column:
    return sa.Column(
        name,
        postgresql.JSONB(astext_type=sa.Text()),
        server_default=sa.text("'[]'::jsonb"),
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "trade_agent_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("signal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("analysis_run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("symbol_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("setup_context_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("plan_version", sa.String(length=40), nullable=False),
        sa.Column("directional_bias", sa.String(length=32), nullable=False),
        sa.Column("readiness_label", sa.String(length=32), nullable=True),
        sa.Column("readiness_score", sa.Numeric(5, 4), nullable=True),
        sa.Column("thesis", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        json_array_column("supporting_evidence_json"),
        json_array_column("blocker_json"),
        json_array_column("warning_json"),
        json_array_column("risk_notes_json"),
        json_array_column("observation_zones_json"),
        json_array_column("invalidation_context_json"),
        json_array_column("target_context_zones_json"),
        json_array_column("scenario_context_json"),
        json_array_column("outcome_context_json"),
        json_array_column("historical_context_json"),
        json_object_column("safety_json"),
        json_object_column("metadata_json"),
        timestamp_column("created_at"),
        timestamp_column("updated_at"),
        sa.CheckConstraint(
            "status in ('draft', 'ready_for_review', 'paper_followed', 'observed_only', "
            "'dismissed', 'expired', 'reviewed')",
            name="trade_agent_plans_status_allowed",
        ),
        sa.CheckConstraint(
            "readiness_score is null or (readiness_score >= 0 and readiness_score <= 1)",
            name="trade_agent_plans_readiness_score_range",
        ),
        sa.ForeignKeyConstraint(["analysis_run_id"], ["analysis_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["setup_context_id"], ["setup_contexts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["signal_id"], ["signals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["symbol_id"], ["symbols.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "signal_id",
            "plan_version",
            name="uq_trade_agent_plans_signal_version",
        ),
    )
    op.create_index(
        "ix_trade_agent_plans_workspace_status_created",
        "trade_agent_plans",
        ["workspace_id", "status", "created_at"],
    )
    op.create_index("ix_trade_agent_plans_signal_id", "trade_agent_plans", ["signal_id"])
    op.create_index(
        "ix_trade_agent_plans_setup_context_id",
        "trade_agent_plans",
        ["setup_context_id"],
    )
    op.create_table(
        "trade_agent_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("journal_entry_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("review_decision", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        json_object_column("metadata_json"),
        timestamp_column("created_at"),
        sa.CheckConstraint(
            "review_decision in ('paper_follow', 'observe_only', 'dismiss', "
            "'needs_more_context', 'no_action')",
            name="trade_agent_reviews_decision_allowed",
        ),
        sa.ForeignKeyConstraint(["journal_entry_id"], ["journal_entries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["plan_id"], ["trade_agent_plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_trade_agent_reviews_plan_created",
        "trade_agent_reviews",
        ["plan_id", "created_at"],
    )
    op.create_index(
        "ix_trade_agent_reviews_workspace_created",
        "trade_agent_reviews",
        ["workspace_id", "created_at"],
    )
    op.create_table(
        "trade_agent_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("outcome_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("observation_label", sa.String(length=40), nullable=False),
        sa.Column("reflection_notes", sa.Text(), nullable=False),
        json_object_column("metadata_json"),
        timestamp_column("created_at"),
        sa.CheckConstraint(
            "observation_label in ('aligned', 'conflicted', 'inconclusive', "
            "'insufficient_outcome_data', 'needs_more_review')",
            name="trade_agent_observations_label_allowed",
        ),
        sa.ForeignKeyConstraint(["outcome_id"], ["signal_outcomes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["plan_id"], ["trade_agent_plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_trade_agent_observations_plan_created",
        "trade_agent_observations",
        ["plan_id", "created_at"],
    )
    op.create_index(
        "ix_trade_agent_observations_workspace_created",
        "trade_agent_observations",
        ["workspace_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_trade_agent_observations_workspace_created",
        table_name="trade_agent_observations",
    )
    op.drop_index(
        "ix_trade_agent_observations_plan_created",
        table_name="trade_agent_observations",
    )
    op.drop_table("trade_agent_observations")
    op.drop_index("ix_trade_agent_reviews_workspace_created", table_name="trade_agent_reviews")
    op.drop_index("ix_trade_agent_reviews_plan_created", table_name="trade_agent_reviews")
    op.drop_table("trade_agent_reviews")
    op.drop_index("ix_trade_agent_plans_setup_context_id", table_name="trade_agent_plans")
    op.drop_index("ix_trade_agent_plans_signal_id", table_name="trade_agent_plans")
    op.drop_index(
        "ix_trade_agent_plans_workspace_status_created",
        table_name="trade_agent_plans",
    )
    op.drop_table("trade_agent_plans")
