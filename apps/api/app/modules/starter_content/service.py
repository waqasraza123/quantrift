from datetime import timedelta
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.time import utc_now
from app.modules.candles.models import Candle
from app.modules.data_sources.models import DataSource
from app.modules.starter_content.builder import (
    SYMBOLS,
    TOTAL_STEPS,
    StarterContentBuilder,
    sample_source_id,
)
from app.modules.starter_content.models import WorkspaceStarterContent
from app.modules.starter_content.schemas import StarterContentRead
from app.modules.symbols.models import Symbol


class StarterContentService:
    def __init__(self, session: AsyncSession, settings: Settings, workspace_id: UUID) -> None:
        self.session = session
        self.settings = settings
        self.workspace_id = workspace_id

    async def status(self, can_initialize: bool) -> StarterContentRead:
        state = await self.session.get(
            WorkspaceStarterContent, self.workspace_id, populate_existing=True
        )
        source = await self.session.get(DataSource, sample_source_id(self.workspace_id))
        symbol_id = await self.session.scalar(select(Symbol.id).where(Symbol.symbol == SYMBOLS[0]))
        return StarterContentRead(
            status=state.status if state else "pending",
            step=state.step if state else 0,
            total_steps=TOTAL_STEPS,
            can_initialize=can_initialize,
            source_id=source.id if source else None,
            symbol_id=symbol_id,
            sample_data=source is not None,
            busy=bool(state and state.lease_until and state.lease_until > utc_now()),
        )

    async def advance(self) -> StarterContentRead:
        await self.session.execute(
            insert(WorkspaceStarterContent)
            .values(
                workspace_id=self.workspace_id,
                status="pending",
                step=0,
            )
            .on_conflict_do_nothing(index_elements=[WorkspaceStarterContent.workspace_id])
        )
        state = await self.session.scalar(
            select(WorkspaceStarterContent)
            .where(
                WorkspaceStarterContent.workspace_id == self.workspace_id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if state is None:
            raise RuntimeError("Starter state was not created")
        if state.status != "pending" or (state.lease_until and state.lease_until > utc_now()):
            await self.session.commit()
            return await self.status(True)
        if state.step == 0:
            existing = await self.session.scalar(
                select(Candle.id)
                .where(
                    Candle.workspace_id == self.workspace_id,
                    Candle.source_id != sample_source_id(self.workspace_id),
                )
                .limit(1)
            )
            if existing is not None:
                state.status = "existing_data"
                await self.session.commit()
                return await self.status(True)
        step = state.step
        lease_id = uuid4().hex
        state.lease_id = lease_id
        state.lease_until = utc_now() + timedelta(minutes=2)
        await self.session.commit()
        try:
            await StarterContentBuilder(
                self.session, self.settings, self.workspace_id
            ).prepare_step(step)
            await self.session.execute(
                update(WorkspaceStarterContent)
                .where(
                    WorkspaceStarterContent.workspace_id == self.workspace_id,
                    WorkspaceStarterContent.lease_id == lease_id,
                    WorkspaceStarterContent.status == "pending",
                )
                .values(
                    step=step + 1,
                    source_id=sample_source_id(self.workspace_id),
                    status="ready" if step + 1 >= TOTAL_STEPS else "pending",
                    lease_id=None,
                    lease_until=None,
                )
            )
            await self.session.commit()
        except BaseException:
            await self.session.rollback()
            await self.session.execute(
                update(WorkspaceStarterContent)
                .where(
                    WorkspaceStarterContent.workspace_id == self.workspace_id,
                    WorkspaceStarterContent.lease_id == lease_id,
                )
                .values(lease_id=None, lease_until=None)
            )
            await self.session.commit()
            raise
        return await self.status(True)

    async def disable(self) -> StarterContentRead:
        await self.session.execute(
            insert(WorkspaceStarterContent)
            .values(
                workspace_id=self.workspace_id,
                status="disabled",
                step=0,
            )
            .on_conflict_do_update(
                index_elements=[WorkspaceStarterContent.workspace_id],
                set_={"status": "disabled", "lease_id": None, "lease_until": None},
            )
        )
        await self.session.commit()
        return await self.status(True)
