"""merge auth and trade agent heads

Revision ID: 202610221000_auth_trade_agent_merge
Revises: 202605151000_trade_agent, 202610211200_email_verification
Create Date: 2026-10-22 10:00:00.000000
"""

from collections.abc import Sequence

revision: str = "202610221000_auth_trade_agent_merge"
down_revision: str | Sequence[str] | None = (
    "202605151000_trade_agent",
    "202610211200_email_verification",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
