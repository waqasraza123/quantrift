from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid5

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.modules.analysis.models import AnalysisRun
from app.modules.analysis.schemas import AnalysisRunCreate
from app.modules.analysis.service import AnalysisService
from app.modules.candles.timeframes import Timeframe
from app.modules.daily_briefs.models import DailyBriefRun, DailyBriefType
from app.modules.daily_briefs.schemas import DailyBriefCreate, DailyBriefFilters
from app.modules.daily_briefs.service import DailyBriefService
from app.modules.data_sources.models import DataSource
from app.modules.demo_mode.service import fixture_request, raw_candle
from app.modules.historical_cases.service import HistoricalCaseService
from app.modules.imports.schemas import JsonCandleImportRequest
from app.modules.imports.service import ImportService
from app.modules.market_scans.models import (
    MarketWatchlist,
    ScheduledScanConfig,
    ScheduledScanMode,
    ScheduledScanRun,
)
from app.modules.market_scans.scanner import MarketScanExecutor
from app.modules.market_scans.schemas import (
    ScheduledScanConfigCreate,
    WatchlistCreate,
    WatchlistItemCreate,
)
from app.modules.market_scans.service import MarketScanService
from app.modules.outcomes.service import OutcomeEvaluationService
from app.modules.preference_profiles.models import PersonalStrategyPreferenceProfile
from app.modules.preference_profiles.schemas import PreferenceProfileCreate
from app.modules.preference_profiles.service import PreferenceProfileService
from app.modules.read_models.service import ReadModelService
from app.modules.setup_context.service import SetupContextService
from app.modules.signal_priority.service import SignalPriorityService
from app.modules.signals.models import Signal
from app.modules.strategy_profiles.service import StrategyProfileService
from app.modules.symbols.models import MarketType, Symbol
from app.modules.synthetic_fixtures.generator import SyntheticFixtureGenerator
from app.modules.trading_journal.models import JournalDecisionType, JournalEntry
from app.modules.trading_journal.schemas import JournalEntryCreateRequest
from app.modules.trading_journal.service import TradingJournalService

TEMPLATE_NAMESPACE = UUID("7b8a4383-06a1-4a92-992f-d632f70d1ac5")
SYMBOLS = ("BTCUSDT", "ETHUSDT")
TIMEFRAMES = tuple(Timeframe)
SERIES = tuple((code, timeframe) for code in SYMBOLS for timeframe in TIMEFRAMES)
STEPS = (
    "definitions",
    *(f"candles:{code}:{timeframe.value}" for code, timeframe in SERIES),
    *(f"analysis:{code}" for code in SYMBOLS),
    "scan",
    *(f"evidence:{code}" for code in SYMBOLS),
    "journal",
    "brief",
)
TOTAL_STEPS = len(STEPS)
SAMPLE_METADATA: dict[str, object] = {"sample": True, "syntheticData": True, "templateVersion": 1}


def sample_source_id(workspace_id: UUID) -> UUID:
    return uuid5(TEMPLATE_NAMESPACE, str(workspace_id))


class StarterContentBuilder:
    def __init__(self, session: AsyncSession, settings: Settings, workspace_id: UUID) -> None:
        self.session = session
        self.settings = settings
        self.workspace_id = workspace_id
        self.source_id = sample_source_id(workspace_id)

    async def prepare_step(self, step: int) -> None:
        if not 0 <= step < TOTAL_STEPS:
            raise AppError(422, "starter_step_invalid", "Invalid starter preparation step")
        action = STEPS[step].split(":")
        if action[0] == "definitions":
            await self.prepare_definitions()
        elif action[0] == "candles":
            code, timeframe = action[1], Timeframe(action[2])
            symbol = await self.symbol(code)
            candles = (
                SyntheticFixtureGenerator(12345)
                .generate(
                    fixture_request(symbol, timeframe, SYMBOLS.index(code), 0),
                )
                .candles
            )
            await ImportService(self.session).process_json_import(
                JsonCandleImportRequest(
                    workspace_id=self.workspace_id,
                    source_id=self.source_id,
                    symbol_id=symbol.id,
                    timeframe=timeframe,
                    candles=[raw_candle(candle) for candle in candles],
                )
            )
        elif action[0] == "analysis":
            await self.prepare_analysis(action[1])
        elif action[0] == "evidence":
            await self.prepare_evidence(action[1])
        elif action[0] == "scan":
            await self.prepare_scan()
        elif action[0] == "journal":
            await self.prepare_journal()
        elif action[0] == "brief":
            await self.prepare_brief()

    async def prepare_definitions(self) -> None:
        for code in SYMBOLS:
            await self.session.execute(
                insert(Symbol)
                .values(
                    symbol=code,
                    display_name=f"{code.removesuffix('USDT')} / USDT",
                    market_type="crypto",
                    base_asset=code.removesuffix("USDT"),
                    quote_asset="USDT",
                    tick_size=Decimal("0.01"),
                    price_precision=2,
                    quantity_precision=8,
                    is_active=True,
                )
                .on_conflict_do_nothing(index_elements=[Symbol.symbol])
            )
        if await self.session.get(DataSource, self.source_id) is None:
            self.session.add(
                DataSource(
                    id=self.source_id,
                    workspace_id=self.workspace_id,
                    name="Sample market history",
                    provider="quantrift_sample",
                    source_type="json_import",
                    status="active",
                    config_json=dict(SAMPLE_METADATA),
                )
            )
        await StrategyProfileService(self.session).seed_default_profiles()
        await self.session.commit()
        service = MarketScanService(self.session, self.settings)
        watchlist = await self.watchlist()
        if watchlist is None:
            watchlist = await service.create_watchlist(
                WatchlistCreate(
                    workspace_id=self.workspace_id,
                    name="Sample crypto watchlist",
                    description="Editable starter watchlist using labeled synthetic history.",
                    metadata_json=dict(SAMPLE_METADATA),
                )
            )
        for code in SYMBOLS:
            symbol = await self.symbol(code)
            try:
                await service.add_watchlist_item(
                    watchlist.id,
                    WatchlistItemCreate(
                        symbol_id=symbol.id,
                        source_id=self.source_id,
                        timeframe=Timeframe.ONE_HOUR,
                        metadata_json=dict(SAMPLE_METADATA),
                    ),
                )
            except AppError as error:
                if error.code != "market_watchlist_item_conflict":
                    raise
        if await self.scan_config() is None:
            await service.create_scan_config(
                ScheduledScanConfigCreate(
                    workspace_id=self.workspace_id,
                    name="Sample market scan",
                    watchlist_id=watchlist.id,
                    source_id=self.source_id,
                    scan_mode=ScheduledScanMode.WATCHLIST,
                    lookback_minutes=7200,
                    interval_seconds=86400,
                    next_run_at=datetime(2100, 1, 1, tzinfo=UTC),
                    description="Sample scan. Paused after the starter run; enable when ready.",
                    metadata_json=dict(SAMPLE_METADATA),
                )
            )
        profile = await self.session.scalar(
            select(PersonalStrategyPreferenceProfile).where(
                PersonalStrategyPreferenceProfile.workspace_id == self.workspace_id,
                PersonalStrategyPreferenceProfile.name == "Starter research preferences",
            )
        )
        if profile is None:
            await PreferenceProfileService(
                self.session, settings=self.settings
            ).create_preference_profile(
                PreferenceProfileCreate(
                    workspace_id=self.workspace_id,
                    name="Starter research preferences",
                    description="Editable example preferences. No automated trading.",
                    market_types_json=[MarketType.CRYPTO],
                    timeframes_json=list(TIMEFRAMES),
                    metadata_json=dict(SAMPLE_METADATA),
                ),
            )

    async def symbol(self, code: str) -> Symbol:
        symbol = await self.session.scalar(select(Symbol).where(Symbol.symbol == code))
        if symbol is None:
            raise AppError(409, "starter_symbol_missing", "Sample symbols need preparation")
        return symbol

    async def watchlist(self) -> MarketWatchlist | None:
        return await self.session.scalar(
            select(MarketWatchlist)
            .where(
                MarketWatchlist.workspace_id == self.workspace_id,
                MarketWatchlist.metadata_json.contains({"sample": True}),
            )
            .order_by(MarketWatchlist.created_at)
            .limit(1)
        )

    async def scan_config(self) -> ScheduledScanConfig | None:
        return await self.session.scalar(
            select(ScheduledScanConfig)
            .where(
                ScheduledScanConfig.workspace_id == self.workspace_id,
                ScheduledScanConfig.source_id == self.source_id,
            )
            .limit(1)
        )

    async def analysis(self, code: str) -> AnalysisRun | None:
        symbol = await self.symbol(code)
        return await self.session.scalar(
            select(AnalysisRun)
            .where(
                AnalysisRun.workspace_id == self.workspace_id,
                AnalysisRun.source_id == self.source_id,
                AnalysisRun.symbol_id == symbol.id,
                AnalysisRun.timeframe == Timeframe.ONE_HOUR.value,
            )
            .order_by(AnalysisRun.created_at)
            .limit(1)
        )

    async def prepare_analysis(self, code: str) -> None:
        existing = await self.analysis(code)
        if existing is not None:
            if existing.status != "completed":
                await AnalysisService(self.session).retry_run(existing.id)
            return
        symbol = await self.symbol(code)
        candles = (
            SyntheticFixtureGenerator(12345)
            .generate(
                fixture_request(symbol, Timeframe.ONE_HOUR, SYMBOLS.index(code), 0),
            )
            .candles
        )
        run = await AnalysisService(self.session).create_historical_run(
            AnalysisRunCreate(
                workspace_id=self.workspace_id,
                source_id=self.source_id,
                symbol_id=symbol.id,
                timeframe=Timeframe.ONE_HOUR,
                start_time=candles[60].timestamp,
                end_time=candles[149].timestamp,
                warmup_start_time=candles[0].timestamp,
                baseline_start_time=candles[0].timestamp,
            )
        )
        if run.status != "completed":
            raise AppError(409, "starter_analysis_incomplete", "Sample analysis is not complete")

    async def signal(self, code: str) -> Signal:
        analysis = await self.analysis(code)
        signal = (
            await self.session.scalar(
                select(Signal).where(
                    Signal.analysis_run_id == analysis.id,
                )
            )
            if analysis
            else None
        )
        if signal is None:
            raise AppError(409, "starter_signal_missing", "Sample signal is not available")
        return signal

    async def prepare_evidence(self, code: str) -> None:
        symbol = await self.symbol(code)
        signals = list(
            (
                await self.session.scalars(
                    select(Signal)
                    .join(
                        AnalysisRun,
                        Signal.analysis_run_id == AnalysisRun.id,
                    )
                    .where(
                        AnalysisRun.workspace_id == self.workspace_id,
                        AnalysisRun.source_id == self.source_id,
                        Signal.symbol_id == symbol.id,
                        Signal.timeframe == Timeframe.ONE_HOUR.value,
                    )
                    .order_by(Signal.created_at)
                )
            ).all()
        )
        if not signals:
            raise AppError(409, "starter_signal_missing", "Sample signals need preparation")
        read_models = ReadModelService(self.session, self.settings)
        for signal in signals:
            await SetupContextService(self.session, self.settings).build_for_signal(signal.id)
            await SignalPriorityService(self.session, self.settings).score_signal(signal.id)
            await OutcomeEvaluationService(self.session, self.settings).evaluate_signal_outcomes(
                signal.id,
                horizons_minutes=[60, 240],
            )
            await HistoricalCaseService(self.session, self.settings).build_case_vector_for_signal(
                signal.id,
            )
            await read_models.rebuild_signal_card(signal.id)
        await read_models.rebuild_symbol_read_model(
            self.workspace_id,
            symbol.id,
            Timeframe.ONE_HOUR.value,
            self.source_id,
        )

    async def prepare_scan(self) -> None:
        config = await self.scan_config()
        if config is None:
            raise AppError(409, "starter_scan_missing", "Sample scan needs preparation")
        existing = await self.session.scalar(
            select(ScheduledScanRun)
            .where(
                ScheduledScanRun.scan_config_id == config.id,
                ScheduledScanRun.status.in_(("completed", "completed_with_warnings")),
            )
            .limit(1)
        )
        if existing is None:
            running = await self.session.scalar(
                select(ScheduledScanRun)
                .where(
                    ScheduledScanRun.scan_config_id == config.id,
                    ScheduledScanRun.status == "running",
                )
                .limit(1)
            )
            if running is not None:
                if running.started_at and running.started_at > utc_now() - timedelta(minutes=2):
                    raise AppError(409, "starter_scan_busy", "Sample scan is still preparing")
                running.status = "failed"
                running.completed_at = utc_now()
                running.error_message = "Starter preparation was interrupted; retrying safely."
            config.status = "active"
            config.next_run_at = datetime(2100, 1, 1, tzinfo=UTC)
            await self.session.commit()
            try:
                run = await MarketScanExecutor(self.session, self.settings).run_scan_config(
                    config.id,
                    force=True,
                )
            finally:
                config.status = "paused"
                config.next_run_at = None
                await self.session.commit()
            if run.status not in {"completed", "completed_with_warnings"}:
                raise AppError(409, "starter_scan_incomplete", "Sample scan needs another attempt")
        else:
            config.status = "paused"
            config.next_run_at = None
            await self.session.commit()

    async def prepare_journal(self) -> None:
        existing = await self.session.scalar(
            select(JournalEntry)
            .where(
                JournalEntry.workspace_id == self.workspace_id,
                JournalEntry.tags_json.contains(["starter-sample"]),
            )
            .limit(1)
        )
        if existing is None:
            signal = await self.signal(SYMBOLS[0])
            await TradingJournalService(self.session, self.settings).create_journal_entry(
                JournalEntryCreateRequest(
                    workspace_id=self.workspace_id,
                    signal_id=signal.id,
                    analysis_run_id=signal.analysis_run_id,
                    title="Sample: reviewing a market setup",
                    decision_type=JournalDecisionType.OBSERVED,
                    tags=["sample", "starter-sample"],
                    user_notes="Sample research note. Compare the chart with its evidence, check "
                    "invalidation conditions, then review the observed outcome. Edit this note "
                    "or replace it with your own observations. Prices are synthetic examples.",
                    metadata=dict(SAMPLE_METADATA),
                ),
            )

    async def prepare_brief(self) -> None:
        watchlist = await self.watchlist()
        if watchlist is None:
            return
        existing = await self.session.scalar(
            select(DailyBriefRun)
            .where(
                DailyBriefRun.workspace_id == self.workspace_id,
                DailyBriefRun.watchlist_id == watchlist.id,
            )
            .limit(1)
        )
        if existing is None:
            await DailyBriefService(self.session, self.settings).create_brief(
                DailyBriefCreate(
                    workspace_id=self.workspace_id,
                    brief_type=DailyBriefType.WATCHLIST,
                    watchlist_id=watchlist.id,
                    period_start=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
                    period_end=utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
                    + timedelta(days=1),
                    timezone="UTC",
                    filters=DailyBriefFilters(timeframes=[Timeframe.ONE_HOUR]),
                )
            )
        await ReadModelService(self.session, self.settings).rebuild_command_center(
            self.workspace_id
        )
