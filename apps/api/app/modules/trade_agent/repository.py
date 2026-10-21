from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.decision_readiness.models import DecisionReadinessAssessment
from app.modules.historical_cases.models import HistoricalCaseSearch
from app.modules.market_memory.models import RollingMarketStateSnapshot
from app.modules.outcomes.models import SignalOutcome
from app.modules.reasoning.models import LlmReasoningRun, ScenarioHypothesis
from app.modules.setup_context.models import SetupContext
from app.modules.signal_priority.models import SignalPriorityScore
from app.modules.signals.models import Signal, SignalEvidence, SignalRiskNote
from app.modules.trade_agent.models import TradeAgentObservation, TradeAgentPlan, TradeAgentReview


class TradeAgentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_signal(self, signal_id: UUID) -> Signal | None:
        return await self.session.get(Signal, signal_id)

    async def get_plan(self, plan_id: UUID) -> TradeAgentPlan | None:
        return await self.session.get(TradeAgentPlan, plan_id)

    async def get_plan_by_signal_version(
        self,
        signal_id: UUID,
        plan_version: str,
    ) -> TradeAgentPlan | None:
        statement: Select[tuple[TradeAgentPlan]] = select(TradeAgentPlan).where(
            TradeAgentPlan.signal_id == signal_id,
            TradeAgentPlan.plan_version == plan_version,
        )
        result = await self.session.execute(statement.limit(1))
        return result.scalar_one_or_none()

    async def list_plans(
        self,
        workspace_id: UUID,
        status: str | None,
        signal_id: UUID | None,
        limit: int,
        offset: int,
    ) -> list[TradeAgentPlan]:
        statement: Select[tuple[TradeAgentPlan]] = (
            select(TradeAgentPlan)
            .where(TradeAgentPlan.workspace_id == workspace_id)
            .order_by(TradeAgentPlan.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if status is not None:
            statement = statement.where(TradeAgentPlan.status == status)
        if signal_id is not None:
            statement = statement.where(TradeAgentPlan.signal_id == signal_id)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def upsert_plan(
        self,
        plan: TradeAgentPlan,
        existing: TradeAgentPlan | None,
        force_recompute: bool,
    ) -> TradeAgentPlan:
        if existing is not None and not force_recompute:
            return existing
        if existing is None:
            self.session.add(plan)
            await self.session.flush()
            await self.session.refresh(plan)
            return plan
        copy_plan_values(plan, existing)
        await self.session.flush()
        await self.session.refresh(existing)
        return existing

    async def update_plan(self, plan: TradeAgentPlan) -> TradeAgentPlan:
        await self.session.flush()
        await self.session.refresh(plan)
        return plan

    async def create_review(self, review: TradeAgentReview) -> TradeAgentReview:
        self.session.add(review)
        await self.session.flush()
        await self.session.refresh(review)
        return review

    async def create_observation(self, observation: TradeAgentObservation) -> TradeAgentObservation:
        self.session.add(observation)
        await self.session.flush()
        await self.session.refresh(observation)
        return observation

    async def get_setup_context(self, signal_id: UUID) -> SetupContext | None:
        statement: Select[tuple[SetupContext]] = (
            select(SetupContext)
            .where(SetupContext.signal_id == signal_id)
            .order_by(SetupContext.updated_at.desc())
        )
        result = await self.session.execute(statement.limit(1))
        return result.scalar_one_or_none()

    async def get_readiness(self, signal_id: UUID) -> DecisionReadinessAssessment | None:
        statement: Select[tuple[DecisionReadinessAssessment]] = (
            select(DecisionReadinessAssessment)
            .where(DecisionReadinessAssessment.signal_id == signal_id)
            .order_by(DecisionReadinessAssessment.updated_at.desc())
        )
        result = await self.session.execute(statement.limit(1))
        return result.scalar_one_or_none()

    async def list_evidence(self, signal_id: UUID) -> list[SignalEvidence]:
        statement: Select[tuple[SignalEvidence]] = (
            select(SignalEvidence)
            .where(SignalEvidence.signal_id == signal_id)
            .order_by(SignalEvidence.created_at.asc())
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def list_risk_notes(self, signal_id: UUID) -> list[SignalRiskNote]:
        statement: Select[tuple[SignalRiskNote]] = (
            select(SignalRiskNote)
            .where(SignalRiskNote.signal_id == signal_id)
            .order_by(SignalRiskNote.created_at.asc())
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def list_outcomes(self, signal_id: UUID) -> list[SignalOutcome]:
        statement: Select[tuple[SignalOutcome]] = (
            select(SignalOutcome)
            .where(SignalOutcome.signal_id == signal_id)
            .order_by(SignalOutcome.horizon_minutes.asc(), SignalOutcome.created_at.desc())
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_outcome(self, outcome_id: UUID) -> SignalOutcome | None:
        return await self.session.get(SignalOutcome, outcome_id)

    async def list_scenarios(self, signal_id: UUID) -> list[ScenarioHypothesis]:
        run_statement: Select[tuple[LlmReasoningRun]] = (
            select(LlmReasoningRun)
            .where(LlmReasoningRun.signal_id == signal_id)
            .order_by(LlmReasoningRun.created_at.desc())
        )
        run_result = await self.session.execute(run_statement.limit(3))
        run_ids = [run.id for run in run_result.scalars().all()]
        if not run_ids:
            return []
        statement: Select[tuple[ScenarioHypothesis]] = (
            select(ScenarioHypothesis)
            .where(ScenarioHypothesis.reasoning_run_id.in_(run_ids))
            .order_by(ScenarioHypothesis.sort_order.asc(), ScenarioHypothesis.created_at.asc())
        )
        result = await self.session.execute(statement.limit(10))
        return list(result.scalars().all())

    async def get_signal_priority(self, signal_id: UUID) -> SignalPriorityScore | None:
        statement: Select[tuple[SignalPriorityScore]] = (
            select(SignalPriorityScore)
            .where(SignalPriorityScore.signal_id == signal_id)
            .order_by(SignalPriorityScore.updated_at.desc())
        )
        result = await self.session.execute(statement.limit(1))
        return result.scalar_one_or_none()

    async def get_market_memory(self, signal: Signal) -> RollingMarketStateSnapshot | None:
        statement: Select[tuple[RollingMarketStateSnapshot]] = (
            select(RollingMarketStateSnapshot)
            .where(
                RollingMarketStateSnapshot.workspace_id == signal.workspace_id,
                RollingMarketStateSnapshot.symbol_id == signal.symbol_id,
                RollingMarketStateSnapshot.timeframe == signal.timeframe,
            )
            .order_by(RollingMarketStateSnapshot.updated_at.desc())
        )
        result = await self.session.execute(statement.limit(1))
        return result.scalar_one_or_none()

    async def list_historical_searches(self, signal_id: UUID) -> list[HistoricalCaseSearch]:
        statement: Select[tuple[HistoricalCaseSearch]] = (
            select(HistoricalCaseSearch)
            .where(HistoricalCaseSearch.source_signal_id == signal_id)
            .order_by(HistoricalCaseSearch.created_at.desc())
        )
        result = await self.session.execute(statement.limit(3))
        return list(result.scalars().all())


def copy_plan_values(source: TradeAgentPlan, target: TradeAgentPlan) -> None:
    target.setup_context_id = source.setup_context_id
    target.status = source.status
    target.directional_bias = source.directional_bias
    target.readiness_label = source.readiness_label
    target.readiness_score = source.readiness_score
    target.thesis = source.thesis
    target.summary = source.summary
    target.supporting_evidence_json = source.supporting_evidence_json
    target.blocker_json = source.blocker_json
    target.warning_json = source.warning_json
    target.risk_notes_json = source.risk_notes_json
    target.observation_zones_json = source.observation_zones_json
    target.invalidation_context_json = source.invalidation_context_json
    target.target_context_zones_json = source.target_context_zones_json
    target.scenario_context_json = source.scenario_context_json
    target.outcome_context_json = source.outcome_context_json
    target.historical_context_json = source.historical_context_json
    target.safety_json = source.safety_json
    target.metadata_json = source.metadata_json
