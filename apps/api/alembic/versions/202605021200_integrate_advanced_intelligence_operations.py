"""integrate advanced intelligence operations

Revision ID: 202605021240_advanced_intelligence_operations
Revises: 202605021100_decision_readiness_assessments, 202605021110_strategy_profile_simulations
Create Date: 2026-05-02 12:00:00.000000
"""

from collections.abc import Sequence

revision: str = "202605021240_advanced_intelligence_operations"
down_revision: str | Sequence[str] | None = (
    "202605021100_decision_readiness_assessments",
    "202605021110_strategy_profile_simulations",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
