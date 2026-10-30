import hashlib
import json
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.modules.analysis.models import AnalysisRun
from app.modules.candles.models import Candle
from app.modules.candles.quality import CandleQualityInput, calculate_candle_quality
from app.modules.candles.timeframes import Timeframe, timeframe_duration
from app.modules.data_sources.models import DataSource
from app.modules.features.engine import calculate_feature_snapshot
from app.modules.indicators.engine import calculate_indicator_snapshot
from app.modules.market_memory.freshness import FreshnessThresholds, freshness_threshold_seconds
from app.modules.signals.models import Signal
from app.modules.symbols.models import Symbol


def freshness_seconds(timeframe: str, settings: Settings) -> int:
    return freshness_threshold_seconds(timeframe, FreshnessThresholds(
        fresh_seconds_1m=settings.market_memory_fresh_seconds_1m,
        fresh_seconds_5m=settings.market_memory_fresh_seconds_5m,
        fresh_seconds_15m=settings.market_memory_fresh_seconds_15m,
        fresh_seconds_1h=settings.market_memory_fresh_seconds_1h,
    ))


def candle_json(candle: Candle) -> dict[str, Any]:
    return {
        "id": str(candle.id), "timestamp": candle.timestamp.isoformat(),
        "open": str(candle.open), "high": str(candle.high), "low": str(candle.low),
        "close": str(candle.close),
        "volume": str(candle.volume) if candle.volume is not None else None,
    }


def context_fingerprint(context: dict[str, Any], configuration: dict[str, Any]) -> str:
    encoded = json.dumps([context, configuration], sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode()).hexdigest()


async def build_context(
    session: AsyncSession, signal: Signal, settings: Settings
) -> tuple[dict[str, Any], datetime]:
    now = utc_now()
    try:
        timeframe = Timeframe(signal.timeframe)
    except ValueError as error:
        raise AppError(422, "unsupported_timeframe", "The chart timeframe is unsupported.") from error
    duration = timeframe_duration(timeframe)
    run = await session.get(AnalysisRun, signal.analysis_run_id)
    if run is None or run.workspace_id != signal.workspace_id:
        raise AppError(422, "analysis_context_missing", "The source analysis is unavailable.")
    base = select(Candle).where(
        Candle.workspace_id == signal.workspace_id,
        Candle.symbol_id == signal.symbol_id,
        Candle.timeframe == signal.timeframe,
        Candle.is_final.is_(True),
        Candle.timestamp <= now - duration,
    )
    source_id = run.source_id
    if source_id is None:
        sources = (await session.scalars(
            base.with_only_columns(Candle.source_id).distinct().limit(2)
        )).all()
        if len(sources) != 1:
            raise AppError(422, "ambiguous_candle_source", "A single candle source is required.")
        source_id = sources[0]
    source = await session.get(DataSource, source_id)
    if source is None or source.workspace_id != signal.workspace_id or source.status != "active":
        raise AppError(422, "candle_source_unavailable", "The candle source is unavailable.")
    candles = list(reversed((await session.scalars(
        base.where(Candle.source_id == source_id).order_by(Candle.timestamp.desc())
        .limit(settings.trade_suggestions_max_candles)
    )).all()))
    if len(candles) < settings.trade_suggestions_min_candles:
        raise AppError(
            422, "insufficient_candles",
            f"At least {settings.trade_suggestions_min_candles} closed candles are required.",
        )
    if any(
        not price.is_finite() or price <= 0
        for candle in candles for price in (candle.open, candle.high, candle.low, candle.close)
    ):
        raise AppError(422, "invalid_candle_prices", "Candle prices must be finite and positive.")
    cutoff = candles[-1].timestamp
    expires_at = cutoff + timedelta(seconds=freshness_seconds(signal.timeframe, settings))
    if expires_at <= now:
        raise AppError(422, "stale_candles", "Refresh market data before requesting a suggestion.")
    if candles[-1].timestamp - candles[0].timestamp > duration * len(candles) * 2:
        raise AppError(422, "candle_gaps", "The candle window contains excessive gaps.")
    quality = calculate_candle_quality(
        [CandleQualityInput(timestamp=c.timestamp, is_final=True) for c in candles],
        timeframe, candles[0].timestamp, cutoff,
    )
    if quality.quality_score < settings.trade_suggestions_min_quality or any(
        c.quality_score is not None and c.quality_score < settings.trade_suggestions_min_quality
        for c in candles
    ):
        raise AppError(422, "candle_quality_blocked", "Candle quality is below the required level.")
    symbol = await session.get(Symbol, signal.symbol_id)
    if symbol is None or not symbol.is_active:
        raise AppError(422, "symbol_unavailable", "The symbol is unavailable.")
    analysis = candles[-settings.trade_suggestions_min_candles:]
    warmup = candles[:-settings.trade_suggestions_min_candles]
    return {
        "workspace_id": str(signal.workspace_id), "symbol_id": str(signal.symbol_id),
        "symbol": symbol.symbol, "price_precision": symbol.price_precision,
        "source_id": str(source_id), "timeframe": signal.timeframe,
        "cutoff": cutoff.isoformat(), "as_of": (cutoff + duration).isoformat(),
        "candles": [candle_json(c) for c in candles],
        "indicators": calculate_indicator_snapshot(analysis, warmup, warmup),
        "features": calculate_feature_snapshot(symbol, analysis, warmup, warmup, quality),
        "quality": quality.model_dump(mode="json"),
        "original_signal": {
            "id": str(signal.id), "bias": signal.bias,
            "created_at": signal.created_at.isoformat(),
            "historical_context_only": True,
        },
        "evidence_refs": [*[f"candle:{c.id}" for c in candles], "indicators", "features", "quality"],
    }, expires_at


async def latest_final_timestamp(
    session: AsyncSession, context: dict[str, Any]
) -> datetime | None:
    if not context:
        return None
    return await session.scalar(select(Candle.timestamp).where(
        Candle.workspace_id == UUID(context["workspace_id"]),
        Candle.symbol_id == UUID(context["symbol_id"]),
        Candle.source_id == UUID(context["source_id"]),
        Candle.timeframe == context["timeframe"],
        Candle.is_final.is_(True),
        Candle.timestamp <= utc_now() - timeframe_duration(Timeframe(context["timeframe"])),
    ).order_by(Candle.timestamp.desc()).limit(1))
