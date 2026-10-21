from datetime import timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.data_sources.models import DataSource
from app.modules.decision_readiness.service import DecisionReadinessService
from app.modules.outcomes.models import OutcomeEvaluationStatus, OutcomeLabel, SignalOutcome
from app.modules.setup_context.service import SetupContextService
from app.modules.signals.service import SignalClassificationService
from app.modules.symbols.models import Symbol
from app.modules.users.models import User
from app.modules.workspaces.models import Workspace
from app.tests.golden.helpers import run_golden_analysis

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_trade_agent_plan_review_and_observation_api(
    api_client: AsyncClient,
    db_session: AsyncSession,
    workspace: Workspace,
    user: User,
    eurusd_symbol: Symbol,
    json_data_source: DataSource,
    seeded_strategy_profiles: None,
) -> None:
    result = await run_golden_analysis(
        db_session,
        "bullish_breakout_eurusd_1m",
        workspace,
        user,
        eurusd_symbol,
        json_data_source,
    )
    signal_response = await SignalClassificationService(db_session).get_by_analysis_run_id(
        result.analysis_run.id
    )
    signal = signal_response.signal
    await SetupContextService(db_session).build_for_signal(signal.id, force_recompute=True)
    await DecisionReadinessService(db_session).assess_signal(signal.id, force_recompute=True)

    create_response = await api_client.post(
        f"/trade-agent/plans/from-signal/{signal.id}",
        json={"forceRecompute": True},
    )
    assert create_response.status_code == 201
    plan = create_response.json()
    assert plan["signalId"] == str(signal.id)
    assert plan["safetyJson"]["brokerExecution"] is False
    assert plan["status"] == "ready_for_review"

    second_create_response = await api_client.post(
        f"/trade-agent/plans/from-signal/{signal.id}",
        json={"forceRecompute": False},
    )
    assert second_create_response.status_code == 201
    assert second_create_response.json()["id"] == plan["id"]

    list_response = await api_client.get(
        "/trade-agent/plans",
        params={"workspaceId": str(workspace.id), "signalId": str(signal.id)},
    )
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [plan["id"]]

    review_response = await api_client.post(
        f"/trade-agent/plans/{plan['id']}/review",
        json={
            "reviewDecision": "paper_follow",
            "userId": str(user.id),
            "notes": "Paper review accepted for observation.",
        },
    )
    assert review_response.status_code == 201
    review = review_response.json()
    assert review["journalEntryId"] is not None
    assert review["reviewDecision"] == "paper_follow"

    outcome = SignalOutcome(
        workspace_id=workspace.id,
        analysis_run_id=signal.analysis_run_id,
        signal_id=signal.id,
        symbol_id=signal.symbol_id,
        timeframe=signal.timeframe,
        strategy_profile_key=signal.strategy_profile_key,
        strategy_profile_version=signal.strategy_profile_version,
        pattern_type=signal.pattern_type,
        bias=signal.bias,
        classification_status=signal.classification_status,
        horizon_minutes=15,
        evaluation_status=OutcomeEvaluationStatus.EVALUATED.value,
        reference_time=result.analysis_run.end_time,
        reference_price=Decimal("1.1000"),
        future_window_start=result.analysis_run.end_time,
        future_window_end=result.analysis_run.end_time + timedelta(minutes=15),
        future_candle_count=15,
        max_favorable_move=Decimal("0.0020"),
        max_adverse_move=Decimal("0.0005"),
        net_move=Decimal("0.0010"),
        direction_followed=True,
        reversal_detected=False,
        outcome_label=OutcomeLabel.CONTINUATION.value,
        evaluation_version="trade_agent_test",
    )
    db_session.add(outcome)
    await db_session.flush()
    await db_session.refresh(outcome)

    observe_response = await api_client.post(
        f"/trade-agent/plans/{plan['id']}/observe",
        json={"outcomeId": str(outcome.id)},
    )
    assert observe_response.status_code == 201
    assert observe_response.json()["observationLabel"] == "aligned"


@pytest.mark.asyncio
async def test_trade_agent_rejects_workspace_mismatch_for_outcome(
    api_client: AsyncClient,
    db_session: AsyncSession,
    workspace: Workspace,
    user: User,
    eurusd_symbol: Symbol,
    json_data_source: DataSource,
    seeded_strategy_profiles: None,
) -> None:
    result = await run_golden_analysis(
        db_session,
        "bullish_breakout_eurusd_1m",
        workspace,
        user,
        eurusd_symbol,
        json_data_source,
    )
    signal = (
        await SignalClassificationService(db_session).get_by_analysis_run_id(result.analysis_run.id)
    ).signal
    create_response = await api_client.post(
        f"/trade-agent/plans/from-signal/{signal.id}",
        json={"forceRecompute": True},
    )
    assert create_response.status_code == 201
    observe_response = await api_client.post(
        f"/trade-agent/plans/{create_response.json()['id']}/observe",
        json={"outcomeId": str(signal.id)},
    )
    assert observe_response.status_code == 404
