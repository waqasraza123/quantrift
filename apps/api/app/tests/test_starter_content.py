from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.modules.candles.timeframes import Timeframe
from app.modules.demo_mode.service import fixture_request
from app.modules.starter_content.builder import sample_source_id
from app.modules.starter_content.models import WorkspaceStarterContent
from app.modules.starter_content.service import StarterContentService
from app.modules.symbols.models import Symbol
from app.modules.synthetic_fixtures.generator import SyntheticFixtureGenerator


def test_sample_sources_are_isolated_and_reproducible() -> None:
    first = uuid4()
    second = uuid4()
    assert sample_source_id(first) == sample_source_id(first)
    assert sample_source_id(first) != sample_source_id(second)


@pytest.mark.parametrize("timeframe", list(Timeframe))
def test_sample_candles_are_historical_and_ohlc_valid(timeframe: Timeframe) -> None:
    symbol = Symbol(symbol="BTCUSDT")
    request = fixture_request(symbol, timeframe, 0, 0)
    first = SyntheticFixtureGenerator(12345).generate(request)
    second = SyntheticFixtureGenerator(12345).generate(request)
    assert first.candles == second.candles
    assert first.candles[-1].timestamp < datetime(2026, 11, 1, tzinfo=UTC)
    assert len({candle.timestamp for candle in first.candles}) == len(first.candles)
    for candle in first.candles:
        assert candle.low <= min(candle.open, candle.close)
        assert candle.high >= max(candle.open, candle.close)
        assert candle.low > 0


@pytest.mark.asyncio
async def test_existing_market_data_is_not_replaced_with_samples() -> None:
    workspace_id = uuid4()
    state = WorkspaceStarterContent(workspace_id=workspace_id, status="pending", step=0)
    session = AsyncMock(spec=AsyncSession)
    session.scalar.side_effect = [state, uuid4(), uuid4()]
    session.get.side_effect = lambda model, *_args, **_kwargs: (
        state if model is WorkspaceStarterContent else None
    )
    with patch("app.modules.starter_content.service.StarterContentBuilder") as builder:
        result = await StarterContentService(session, Settings(), workspace_id).advance()
    assert result.status == "existing_data"
    builder.assert_not_called()


@pytest.mark.asyncio
async def test_active_lease_prevents_a_second_preparation_run() -> None:
    workspace_id = uuid4()
    state = WorkspaceStarterContent(
        workspace_id=workspace_id,
        status="pending",
        step=4,
        lease_until=datetime.now(UTC) + timedelta(minutes=1),
        lease_id="other-tab",
    )
    session = AsyncMock(spec=AsyncSession)
    session.scalar.side_effect = [state, uuid4()]
    session.get.side_effect = lambda model, *_args, **_kwargs: (
        state if model is WorkspaceStarterContent else None
    )
    with patch("app.modules.starter_content.service.StarterContentBuilder") as builder:
        result = await StarterContentService(session, Settings(), workspace_id).advance()
    assert result.busy
    assert result.step == 4
    builder.assert_not_called()
