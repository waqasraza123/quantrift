from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.trade_agent.suggestions.models import TradeSuggestionRun


class SuggestionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def lock_workspace(self, workspace_id: UUID) -> None:
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:workspace, 0))"),
            {"workspace": f"trade_suggestions:{workspace_id}"},
        )

    async def by_request(self, workspace_id: UUID, request_id: UUID) -> TradeSuggestionRun | None:
        return await self.session.scalar(select(TradeSuggestionRun).where(
            TradeSuggestionRun.workspace_id == workspace_id,
            TradeSuggestionRun.request_id == request_id,
        ))

    async def list_runs(
        self, workspace_id: UUID, signal_id: UUID, limit: int = 20
    ) -> list[TradeSuggestionRun]:
        return list((await self.session.scalars(select(TradeSuggestionRun).where(
            TradeSuggestionRun.workspace_id == workspace_id,
            TradeSuggestionRun.signal_id == signal_id,
        ).order_by(TradeSuggestionRun.created_at.desc()).limit(limit))).all())

    async def hourly_count(self, workspace_id: UUID, since: datetime) -> int:
        return int(await self.session.scalar(select(func.count()).select_from(
            TradeSuggestionRun
        ).where(
            TradeSuggestionRun.workspace_id == workspace_id,
            TradeSuggestionRun.created_at >= since,
        )) or 0)
