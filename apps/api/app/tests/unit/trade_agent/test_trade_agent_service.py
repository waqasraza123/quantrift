from types import SimpleNamespace
from typing import cast
from uuid import uuid4

from app.modules.outcomes.models import OutcomeEvaluationStatus, OutcomeLabel, SignalOutcome
from app.modules.trade_agent.models import (
    TradeAgentObservationLabel,
    TradeAgentPlan,
    TradeAgentPlanStatus,
    TradeAgentReviewDecision,
)
from app.modules.trade_agent.service import (
    has_critical_blocker,
    journal_decision,
    observation_label,
)


def test_critical_readiness_blocker_detection() -> None:
    assert has_critical_blocker([{"code": "missing_signal", "severity": "critical"}])
    assert not has_critical_blocker([{"code": "review", "severity": "medium"}])


def test_review_decision_maps_to_safe_journal_decision() -> None:
    assert journal_decision(TradeAgentReviewDecision.PAPER_FOLLOW).value == "paper_followed"
    assert journal_decision(TradeAgentReviewDecision.OBSERVE_ONLY).value == "observed"
    assert journal_decision(TradeAgentReviewDecision.DISMISS).value == "ignored"
    assert journal_decision(TradeAgentReviewDecision.NO_ACTION).value == "no_action"


def test_observation_reuses_stored_outcome_labels() -> None:
    plan = cast(
        TradeAgentPlan,
        SimpleNamespace(id=uuid4(), status=TradeAgentPlanStatus.PAPER_FOLLOWED.value),
    )
    aligned = outcome_stub(OutcomeLabel.CONTINUATION.value, True)
    conflicted = outcome_stub(OutcomeLabel.REVERSAL.value, False)

    assert observation_label(plan, aligned) == TradeAgentObservationLabel.ALIGNED
    assert observation_label(plan, conflicted) == TradeAgentObservationLabel.CONFLICTED
    assert observation_label(plan, None) == TradeAgentObservationLabel.INSUFFICIENT_OUTCOME_DATA


def outcome_stub(outcome_label: str, direction_followed: bool | None) -> SignalOutcome:
    return cast(
        SignalOutcome,
        SimpleNamespace(
            evaluation_status=OutcomeEvaluationStatus.EVALUATED.value,
            outcome_label=outcome_label,
            direction_followed=direction_followed,
        ),
    )
