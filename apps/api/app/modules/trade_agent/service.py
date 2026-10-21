from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.errors import AppError
from app.modules.decision_readiness.models import DecisionReadinessAssessment
from app.modules.historical_cases.models import HistoricalCaseSearch
from app.modules.market_memory.models import RollingMarketStateSnapshot
from app.modules.outcomes.models import OutcomeEvaluationStatus, OutcomeLabel, SignalOutcome
from app.modules.reasoning.models import ScenarioHypothesis
from app.modules.safety_policies.evaluator import SafetyPolicyEvaluator
from app.modules.safety_policies.schemas import SafetyStatus
from app.modules.setup_context.models import SetupContext
from app.modules.signal_priority.models import SignalPriorityScore
from app.modules.signals.models import (
    Signal,
    SignalClassificationStatus,
    SignalEvidence,
    SignalRiskNote,
)
from app.modules.trade_agent.models import (
    TradeAgentObservation,
    TradeAgentObservationLabel,
    TradeAgentPlan,
    TradeAgentPlanStatus,
    TradeAgentReview,
    TradeAgentReviewDecision,
)
from app.modules.trade_agent.repository import TradeAgentRepository
from app.modules.trade_agent.schemas import (
    TradeAgentObservationRead,
    TradeAgentObservationRequest,
    TradeAgentPlanRead,
    TradeAgentReviewRead,
    TradeAgentReviewRequest,
)
from app.modules.trading_journal.models import (
    JournalDecisionType,
    JournalEntryStatus,
    JournalUserBias,
)
from app.modules.trading_journal.schemas import JournalEntryCreateRequest
from app.modules.trading_journal.service import TradingJournalService

TRADE_AGENT_PLAN_VERSION = "paper_trade_agent_v1"
MAX_CONTEXT_ITEMS = 10


@dataclass(frozen=True)
class TradeAgentArtifacts:
    setup_context: SetupContext | None
    evidence: list[SignalEvidence]
    risk_notes: list[SignalRiskNote]
    outcomes: list[SignalOutcome]
    scenarios: list[ScenarioHypothesis]
    priority: SignalPriorityScore | None
    market_memory: RollingMarketStateSnapshot | None
    historical_searches: list[HistoricalCaseSearch]


class TradeAgentService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.repository = TradeAgentRepository(session)
        self.safety = SafetyPolicyEvaluator()

    async def create_plan_from_signal(
        self,
        signal_id: UUID,
        force_recompute: bool = False,
    ) -> TradeAgentPlanRead:
        signal = await self.repository.get_signal(signal_id)
        if signal is None:
            raise AppError(404, "signal_not_found", "Signal not found")
        readiness = await self.repository.get_readiness(signal_id)
        if readiness is not None and has_critical_blocker(readiness.blockers_json):
            raise AppError(
                422,
                "trade_agent_readiness_blocked",
                "Paper plan generation is blocked until critical readiness blockers are resolved.",
            )
        existing = await self.repository.get_plan_by_signal_version(
            signal_id,
            TRADE_AGENT_PLAN_VERSION,
        )
        artifacts = await self.load_artifacts(signal)
        plan = build_plan(signal, artifacts, readiness, self.settings)
        safety = self.safety.evaluate_text(f"{plan.thesis}\n{plan.summary}")
        if safety.safety_status == SafetyStatus.BLOCKED:
            raise AppError(
                422,
                "trade_agent_plan_safety_blocked",
                "Paper plan text failed safety policy evaluation.",
            )
        plan.safety_json = {
            **plan.safety_json,
            "policySetKey": safety.policy_set_key,
            "policySetVersion": safety.policy_set_version,
            "safetyStatus": safety.safety_status.value,
            "findingCodes": [finding.code for finding in safety.findings],
        }
        stored = await self.repository.upsert_plan(plan, existing, force_recompute)
        await self.session.commit()
        await self.session.refresh(stored)
        return TradeAgentPlanRead.model_validate(stored)

    async def get_plan(self, plan_id: UUID) -> TradeAgentPlanRead:
        plan = await self.get_plan_or_raise(plan_id)
        return TradeAgentPlanRead.model_validate(plan)

    async def list_plans(
        self,
        workspace_id: UUID,
        status: str | None = None,
        signal_id: UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[TradeAgentPlanRead]:
        plans = await self.repository.list_plans(
            workspace_id=workspace_id,
            status=status,
            signal_id=signal_id,
            limit=limit,
            offset=offset,
        )
        return [TradeAgentPlanRead.model_validate(plan) for plan in plans]

    async def review_plan(
        self,
        plan_id: UUID,
        payload: TradeAgentReviewRequest,
    ) -> TradeAgentReviewRead:
        plan = await self.get_plan_or_raise(plan_id)
        journal_service = TradingJournalService(self.session, settings=self.settings)
        journal = await journal_service.create_journal_entry(
            JournalEntryCreateRequest(
                workspace_id=plan.workspace_id,
                user_id=payload.user_id,
                signal_id=plan.signal_id,
                analysis_run_id=plan.analysis_run_id,
                setup_context_id=plan.setup_context_id,
                title=journal_title(payload.review_decision, plan),
                status=JournalEntryStatus.SAVED,
                decision_type=journal_decision(payload.review_decision),
                confidence_before=plan.readiness_score,
                user_bias=journal_bias(plan.directional_bias),
                user_notes=safe_notes(payload.notes, plan),
                tags=["trade_agent", "paper_review"],
                metadata={
                    "tradeAgentPlanId": str(plan.id),
                    "reviewDecision": payload.review_decision.value,
                    "paperOnly": True,
                    "brokerExecution": False,
                    "financialAdvice": False,
                    **payload.metadata_json,
                },
            )
        )
        review = await self.repository.create_review(
            TradeAgentReview(
                workspace_id=plan.workspace_id,
                plan_id=plan.id,
                user_id=payload.user_id,
                journal_entry_id=journal.id,
                review_decision=payload.review_decision.value,
                notes=payload.notes,
                metadata_json={
                    "journalEntryId": str(journal.id),
                    "paperOnly": True,
                    "brokerExecution": False,
                    "financialAdvice": False,
                    **payload.metadata_json,
                },
            )
        )
        plan.status = status_for_review(payload.review_decision).value
        await self.repository.update_plan(plan)
        await self.session.commit()
        await self.session.refresh(review)
        return TradeAgentReviewRead.model_validate(review)

    async def observe_plan(
        self,
        plan_id: UUID,
        payload: TradeAgentObservationRequest,
    ) -> TradeAgentObservationRead:
        plan = await self.get_plan_or_raise(plan_id)
        outcome = await self.resolve_outcome(plan, payload.outcome_id)
        label = observation_label(plan, outcome)
        observation = await self.repository.create_observation(
            TradeAgentObservation(
                workspace_id=plan.workspace_id,
                plan_id=plan.id,
                outcome_id=outcome.id if outcome is not None else None,
                observation_label=label.value,
                reflection_notes=observation_notes(label, outcome),
                metadata_json={
                    "paperOnly": True,
                    "brokerExecution": False,
                    "financialAdvice": False,
                    "reusedStoredOutcome": outcome is not None,
                    **payload.metadata_json,
                },
            )
        )
        plan.status = TradeAgentPlanStatus.REVIEWED.value
        await self.repository.update_plan(plan)
        await self.session.commit()
        await self.session.refresh(observation)
        return TradeAgentObservationRead.model_validate(observation)

    async def get_plan_or_raise(self, plan_id: UUID) -> TradeAgentPlan:
        plan = await self.repository.get_plan(plan_id)
        if plan is None:
            raise AppError(404, "trade_agent_plan_not_found", "Paper plan not found")
        return plan

    async def resolve_outcome(
        self,
        plan: TradeAgentPlan,
        outcome_id: UUID | None,
    ) -> SignalOutcome | None:
        if outcome_id is not None:
            outcome = await self.repository.get_outcome(outcome_id)
            if outcome is None:
                raise AppError(404, "signal_outcome_not_found", "Signal outcome not found")
            if outcome.signal_id != plan.signal_id or outcome.workspace_id != plan.workspace_id:
                raise AppError(
                    422,
                    "workspace_mismatch",
                    "Outcome does not belong to this paper plan",
                )
            return outcome
        outcomes = await self.repository.list_outcomes(plan.signal_id)
        evaluated = [
            outcome
            for outcome in outcomes
            if outcome.evaluation_status == OutcomeEvaluationStatus.EVALUATED.value
        ]
        return evaluated[0] if evaluated else outcomes[0] if outcomes else None

    async def load_artifacts(self, signal: Signal) -> TradeAgentArtifacts:
        setup_context = await self.repository.get_setup_context(signal.id)
        priority = await self.repository.get_signal_priority(signal.id)
        market_memory = await self.repository.get_market_memory(signal)
        return TradeAgentArtifacts(
            setup_context=setup_context,
            evidence=await self.repository.list_evidence(signal.id),
            risk_notes=await self.repository.list_risk_notes(signal.id),
            outcomes=await self.repository.list_outcomes(signal.id),
            scenarios=await self.repository.list_scenarios(signal.id),
            priority=priority,
            market_memory=market_memory,
            historical_searches=await self.repository.list_historical_searches(signal.id),
        )


def build_plan(
    signal: Signal,
    artifacts: TradeAgentArtifacts,
    readiness: DecisionReadinessAssessment | None,
    settings: Settings,
) -> TradeAgentPlan:
    setup_context = artifacts.setup_context
    evidence = artifacts.evidence
    risk_notes = artifacts.risk_notes
    outcomes = artifacts.outcomes
    scenarios = artifacts.scenarios
    priority = artifacts.priority
    market_memory = artifacts.market_memory
    historical_searches = artifacts.historical_searches
    setup_warnings = setup_context.data_quality_warnings_json if setup_context is not None else []
    warnings = [
        *json_list(readiness.warnings_json if readiness is not None else []),
        *json_list(setup_warnings),
    ]
    if setup_context is None:
        warnings.append(
            {
                "code": "setup_context_missing",
                "severity": "medium",
                "message": "Setup context is not available for this signal.",
            }
        )
    if signal.classification_status != SignalClassificationStatus.SIGNAL.value:
        warnings.append(
            {
                "code": "not_directional_signal",
                "severity": "medium",
                "message": "Signal is not classified as a directional setup.",
            }
        )
    directional_bias = (
        str(setup_context.directional_bias)
        if setup_context is not None
        else str(signal.bias)
    )
    thesis = build_thesis(signal, setup_context, readiness)
    return TradeAgentPlan(
        workspace_id=signal.workspace_id,
        signal_id=signal.id,
        analysis_run_id=signal.analysis_run_id,
        symbol_id=signal.symbol_id,
        setup_context_id=setup_context.id if setup_context is not None else None,
        status=TradeAgentPlanStatus.READY_FOR_REVIEW.value,
        plan_version=TRADE_AGENT_PLAN_VERSION,
        directional_bias=directional_bias,
        readiness_label=readiness.readiness_label if readiness is not None else None,
        readiness_score=readiness.readiness_score if readiness is not None else None,
        thesis=thesis,
        summary=build_summary(signal, setup_context, readiness, len(evidence), len(risk_notes)),
        supporting_evidence_json=evidence_json(evidence),
        blocker_json=json_list(readiness.blockers_json if readiness is not None else []),
        warning_json=warnings[:MAX_CONTEXT_ITEMS],
        risk_notes_json=risk_json(risk_notes, setup_context),
        observation_zones_json=json_list(
            setup_context.observation_zones_json if setup_context is not None else []
        ),
        invalidation_context_json=json_list(
            setup_context.invalidation_context_json if setup_context is not None else []
        ),
        target_context_zones_json=json_list(
            setup_context.target_context_zones_json if setup_context is not None else []
        ),
        scenario_context_json=scenario_json(scenarios),
        outcome_context_json=outcome_json(outcomes),
        historical_context_json=historical_json(historical_searches),
        safety_json={
            "paperOnly": True,
            "brokerExecution": False,
            "autoTrading": False,
            "financialAdvice": False,
            "liveExecution": False,
        },
        metadata_json={
            "deterministic": True,
            "llmUsed": False,
            "tradeAgentVersion": TRADE_AGENT_PLAN_VERSION,
            "readinessAssessmentId": str(readiness.id) if readiness is not None else None,
            "signalPriorityScoreId": str(priority.id) if priority is not None else None,
            "marketMemorySnapshotId": str(market_memory.id) if market_memory is not None else None,
            "capability": {
                "executionType": "human_review",
                "safetyLevel": "paper_only",
                "brokerExecution": False,
            },
            "settingsVersion": settings.service_version,
        },
    )


def has_critical_blocker(blockers: list[dict[str, object]]) -> bool:
    return any(str(item.get("severity", "")).lower() == "critical" for item in blockers)


def build_thesis(
    signal: Signal,
    setup_context: SetupContext | None,
    readiness: DecisionReadinessAssessment | None,
) -> str:
    bias = setup_context.directional_bias if setup_context is not None else signal.bias
    quality = (
        setup_context.setup_quality_label
        if setup_context is not None
        else signal.confidence_label
    )
    readiness_label = readiness.readiness_label if readiness is not None else "not assessed"
    return (
        f"Paper review plan for {bias} directional bias with {quality} setup context "
        f"and {readiness_label} readiness."
    )


def build_summary(
    signal: Signal,
    setup_context: SetupContext | None,
    readiness: DecisionReadinessAssessment | None,
    evidence_count: int,
    risk_count: int,
) -> str:
    base = setup_context.summary if setup_context is not None else signal.summary
    readiness_label = readiness.readiness_label if readiness is not None else "not assessed"
    return (
        f"{base} Evidence items: {evidence_count}. Risk notes: {risk_count}. "
        f"Readiness: {readiness_label}. Paper review only."
    )


def evidence_json(items: list[SignalEvidence]) -> list[dict[str, object]]:
    return [
        {
            "id": str(item.id),
            "type": item.evidence_type,
            "direction": item.direction,
            "message": item.message,
            "weight": str(item.weight),
            "numericValue": str(item.numeric_value) if item.numeric_value is not None else None,
        }
        for item in items[:MAX_CONTEXT_ITEMS]
    ]


def risk_json(
    risk_notes: list[SignalRiskNote],
    setup_context: SetupContext | None,
) -> list[dict[str, object]]:
    signal_risks = [
        {
            "id": str(item.id),
            "code": item.code,
            "message": item.message,
            "severity": item.severity,
            "source": "signal_risk_note",
        }
        for item in risk_notes[:MAX_CONTEXT_ITEMS]
    ]
    setup_risks = json_list(setup_context.risk_notes_json if setup_context is not None else [])
    return [*signal_risks, *setup_risks][:MAX_CONTEXT_ITEMS]


def scenario_json(items: list[ScenarioHypothesis]) -> list[dict[str, object]]:
    return [
        {
            "id": str(item.id),
            "scenarioType": item.scenario_type,
            "title": item.title,
            "summary": item.summary,
            "confidenceScore": str(item.confidence_score),
            "suggestedBackendActions": item.suggested_backend_actions_json,
        }
        for item in items[:MAX_CONTEXT_ITEMS]
    ]


def outcome_json(items: list[SignalOutcome]) -> list[dict[str, object]]:
    return [
        {
            "id": str(item.id),
            "horizonMinutes": item.horizon_minutes,
            "evaluationStatus": item.evaluation_status,
            "outcomeLabel": item.outcome_label,
            "directionFollowed": item.direction_followed,
            "reversalDetected": item.reversal_detected,
        }
        for item in items[:MAX_CONTEXT_ITEMS]
    ]


def historical_json(items: list[HistoricalCaseSearch]) -> list[dict[str, object]]:
    return [
        {
            "id": str(item.id),
            "searchVersion": item.search_version,
            "resultCount": item.result_count,
            "results": item.results_json[:5],
        }
        for item in items[:3]
    ]


def json_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)][:MAX_CONTEXT_ITEMS]


def journal_decision(decision: TradeAgentReviewDecision) -> JournalDecisionType:
    mapping = {
        TradeAgentReviewDecision.PAPER_FOLLOW: JournalDecisionType.PAPER_FOLLOWED,
        TradeAgentReviewDecision.OBSERVE_ONLY: JournalDecisionType.OBSERVED,
        TradeAgentReviewDecision.DISMISS: JournalDecisionType.IGNORED,
        TradeAgentReviewDecision.NEEDS_MORE_CONTEXT: JournalDecisionType.UNCERTAIN,
        TradeAgentReviewDecision.NO_ACTION: JournalDecisionType.NO_ACTION,
    }
    return mapping[decision]


def status_for_review(decision: TradeAgentReviewDecision) -> TradeAgentPlanStatus:
    mapping = {
        TradeAgentReviewDecision.PAPER_FOLLOW: TradeAgentPlanStatus.PAPER_FOLLOWED,
        TradeAgentReviewDecision.OBSERVE_ONLY: TradeAgentPlanStatus.OBSERVED_ONLY,
        TradeAgentReviewDecision.DISMISS: TradeAgentPlanStatus.DISMISSED,
        TradeAgentReviewDecision.NEEDS_MORE_CONTEXT: TradeAgentPlanStatus.READY_FOR_REVIEW,
        TradeAgentReviewDecision.NO_ACTION: TradeAgentPlanStatus.REVIEWED,
    }
    return mapping[decision]


def journal_bias(directional_bias: str) -> JournalUserBias | None:
    normalized = directional_bias.lower()
    if normalized in {item.value for item in JournalUserBias}:
        return JournalUserBias(normalized)
    return JournalUserBias.UNCLEAR


def journal_title(decision: TradeAgentReviewDecision, plan: TradeAgentPlan) -> str:
    return f"Paper plan review: {decision.value.replace('_', ' ')} for {plan.directional_bias}"


def safe_notes(notes: str, plan: TradeAgentPlan) -> str:
    if notes.strip():
        return notes
    return f"Reviewed paper plan {plan.id}. This records an observational decision only."


def observation_label(
    plan: TradeAgentPlan,
    outcome: SignalOutcome | None,
) -> TradeAgentObservationLabel:
    if outcome is None:
        return TradeAgentObservationLabel.INSUFFICIENT_OUTCOME_DATA
    if outcome.evaluation_status != OutcomeEvaluationStatus.EVALUATED.value:
        return TradeAgentObservationLabel.INSUFFICIENT_OUTCOME_DATA
    if (
        outcome.outcome_label == OutcomeLabel.CONTINUATION.value
        and outcome.direction_followed is True
    ):
        return TradeAgentObservationLabel.ALIGNED
    if outcome.outcome_label in {OutcomeLabel.REVERSAL.value, OutcomeLabel.NO_FOLLOW_THROUGH.value}:
        return TradeAgentObservationLabel.CONFLICTED
    if plan.status == TradeAgentPlanStatus.READY_FOR_REVIEW.value:
        return TradeAgentObservationLabel.NEEDS_MORE_REVIEW
    return TradeAgentObservationLabel.INCONCLUSIVE


def observation_notes(
    label: TradeAgentObservationLabel,
    outcome: SignalOutcome | None,
) -> str:
    if outcome is None:
        return "No stored outcome is available yet for this paper plan."
    return (
        f"Stored outcome {outcome.outcome_label} at {outcome.horizon_minutes} minutes "
        f"mapped to paper observation {label.value}."
    )
