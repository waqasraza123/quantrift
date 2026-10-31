import asyncio
import time
from datetime import timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, secret_is_empty
from app.core.errors import AppError
from app.core.time import utc_now
from app.modules.billing.usage import reserve_credit, finish_credit, require_reservation
from app.modules.job_queue.models import JobQueueItem, JobQueueJobType
from app.modules.job_queue.schemas import JobQueueJobCreate
from app.modules.job_queue.service import JobQueueService
from app.modules.signals.models import Signal
from app.modules.trade_agent.suggestions.context import (
    build_context,
    context_fingerprint,
    latest_final_timestamp,
)
from app.modules.trade_agent.suggestions.models import TradeSuggestionRun
from app.modules.trade_agent.suggestions.repository import SuggestionRepository
from app.modules.trade_agent.suggestions.schemas import (
    SuggestionAvailability,
    SuggestionCreate,
    SuggestionRead,
)

PROMPT_VERSION = "trade_suggestions_v1"
TERMINAL_JOB_FAILURES = {"failed", "dead_letter", "cancelled"}


class SuggestionService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.repository = SuggestionRepository(session)

    def availability(self) -> SuggestionAvailability:
        if not self.settings.trade_suggestions_enabled:
            return SuggestionAvailability(enabled=False, reason="AI trade suggestions are disabled.")
        if secret_is_empty(self.settings.openai_api_key):
            return SuggestionAvailability(enabled=False, reason="OpenAI is not configured.")
        return SuggestionAvailability(enabled=True, reason=None)

    async def require_signal(self, signal_id: UUID) -> Signal:
        signal = await self.session.get(Signal, signal_id)
        if signal is None:
            raise AppError(404, "signal_not_found", "Signal not found.")
        return signal

    async def require_run(self, run_id: UUID) -> TradeSuggestionRun:
        run = await self.session.get(TradeSuggestionRun, run_id)
        if run is None:
            raise AppError(404, "suggestion_not_found", "Suggestion not found.")
        return run

    async def create(self, signal: Signal, payload: SuggestionCreate) -> SuggestionRead:
        await self.repository.lock_workspace(signal.workspace_id)
        existing = await self.repository.by_request(signal.workspace_id, payload.request_id)
        if existing is not None:
            if existing.signal_id != signal.id:
                raise AppError(409, "request_id_conflict", "Request id belongs to another signal.")
            return await self.read(existing)
        recent = await self.repository.list_runs(signal.workspace_id, signal.id)
        for previous in recent:
            await self.reconcile(previous)
            if previous.status in {"queued", "running"}:
                await self.session.commit()
                return await self.read(previous)
        available = self.availability()
        if not available.enabled:
            raise AppError(503, "trade_suggestions_unavailable", available.reason or "Unavailable.")
        configuration = {
            name: str(value) if name == "trade_suggestions_min_reward_risk" else value
            for name, value in self.settings.model_dump().items()
            if name in {
                "trade_suggestions_model", "trade_suggestions_reasoning_effort",
                "trade_suggestions_min_reward_risk", "trade_suggestions_max_output_tokens",
                "trade_suggestions_model_timeout_seconds", "trade_suggestions_run_timeout_seconds",
            }
        }
        context: dict[str, Any] = {}
        expires_at = None
        blocked: AppError | None = None
        try:
            context, expires_at = await build_context(self.session, signal, self.settings)
        except AppError as error:
            blocked = error
        context["configuration"] = configuration
        fingerprint = context_fingerprint(context, {"prompt_version": PROMPT_VERSION})
        if not payload.regenerate and blocked is None:
            for previous in recent:
                if previous.fingerprint == fingerprint and previous.status == "completed":
                    result = await self.read(previous)
                    if not result.is_outdated:
                        await self.session.commit()
                        return result
        if await self.repository.hourly_count(
            signal.workspace_id, utc_now() - timedelta(hours=1)
        ) >= self.settings.trade_suggestions_hourly_limit:
            raise AppError(429, "trade_suggestions_rate_limited", "Hourly AI suggestion limit reached.")
        run_id = uuid4()
        if blocked is None:
            await reserve_credit(self.session, self.settings, signal.workspace_id, run_id, "setup_review")
        run = TradeSuggestionRun(
            id=run_id, workspace_id=signal.workspace_id, signal_id=signal.id,
            request_id=payload.request_id, status="blocked" if blocked else "queued",
            stage="blocked" if blocked else "queued", fingerprint=fingerprint,
            model=self.settings.trade_suggestions_model, prompt_version=PROMPT_VERSION,
            context_json=context, usage_json={}, expires_at=expires_at,
            error_code=blocked.code if blocked else None,
            error_message=blocked.message if blocked else None,
            completed_at=utc_now() if blocked else None,
        )
        self.session.add(run)
        await self.session.flush()
        if blocked is None:
            job = await JobQueueService(self.session, self.settings).enqueue_job(
                JobQueueJobCreate(
                    workspace_id=signal.workspace_id, job_type=JobQueueJobType.TRADE_AGENT_SUGGEST,
                    idempotency_key=f"trade_suggestion:{run.id}",
                    payload_json={"suggestionId": str(run.id)}, max_attempts=1,
                ), commit=False,
            )
            run.job_id = job.id
        await self.session.commit()
        await self.session.refresh(run)
        return await self.read(run)

    async def reconcile(self, run: TradeSuggestionRun) -> None:
        if run.status not in {"queued", "running"}:
            return
        job = await self.session.get(JobQueueItem, run.job_id) if run.job_id else None
        now = utc_now()
        deadline = (
            run.started_at + timedelta(seconds=run.context_json.get("configuration", {}).get(
                "trade_suggestions_run_timeout_seconds", self.settings.trade_suggestions_run_timeout_seconds
            ))
            if run.started_at else
            run.created_at + timedelta(seconds=self.settings.trade_suggestions_queue_timeout_seconds)
        )
        if deadline <= now or job is None or job.status in TERMINAL_JOB_FAILURES:
            run.status = "failed"
            run.stage = "failed"
            run.error_code = "suggestion_worker_unavailable"
            run.error_message = "Generation stopped or exceeded its deadline. Request a new run."
            run.completed_at = now
            if job is not None and job.status in {"pending", "running", "retrying", "scheduled"}:
                await JobQueueService(self.session, self.settings).fail_job(
                    job.id, run.error_code, run.error_message, commit=False,
                )
            await self.session.flush()
            await finish_credit(self.session, self.settings, run.id, success=False)

    async def read(self, run: TradeSuggestionRun) -> SuggestionRead:
        await self.reconcile(run)
        result = SuggestionRead.model_validate(run)
        if run.status == "completed":
            latest = await latest_final_timestamp(self.session, run.context_json)
            result.is_outdated = (
                run.expires_at is None or run.expires_at <= utc_now() or latest is None
                or latest.isoformat() != run.context_json.get("cutoff")
            )
            result.actionable = (
                self.availability().enabled and not result.is_outdated
                and result.result_json is not None and result.result_json.decision != "WAIT"
            )
        return result

    async def execute(self, run_id: UUID) -> TradeSuggestionRun:
        from app.modules.trade_agent.suggestions.graph import (
            OpenAITradeAgents,
            SuggestionState,
            build_suggestion_graph,
        )

        run = await self.session.scalar(select(TradeSuggestionRun).where(
            TradeSuggestionRun.id == run_id
        ).with_for_update())
        if run is None:
            raise AppError(404, "suggestion_not_found", "Suggestion not found.")
        if run.status != "queued":
            if run.status == "running":
                run.status = "failed"
                run.stage = "failed"
                run.error_code = "worker_interrupted"
                run.error_message = "The previous worker was interrupted. Request a new run."
                run.completed_at = utc_now()
            await self.session.commit()
            await finish_credit(self.session, self.settings, run.id, success=run.status == "completed")
            return run
        run.status, run.stage, run.started_at = "running", "context", utc_now()
        await self.session.commit()
        started = time.perf_counter()
        agents = None
        cancelled = False
        try:
            await require_reservation(self.session, self.settings, run.workspace_id, run.id)
            if not self.availability().enabled:
                raise AppError(503, "trade_suggestions_unavailable", "AI suggestions are unavailable.")
            if run.created_at + timedelta(
                seconds=self.settings.trade_suggestions_queue_timeout_seconds
            ) <= utc_now():
                raise AppError(422, "queue_deadline_exceeded", "The queued run expired. Request a new run.")
            latest = await latest_final_timestamp(self.session, run.context_json)
            if run.expires_at is None or run.expires_at <= utc_now() or (
                latest is None or latest.isoformat() != run.context_json.get("cutoff")
            ):
                raise AppError(422, "snapshot_outdated", "Market data changed. Request a new run.")
            configuration = run.context_json["configuration"]
            settings = Settings.model_validate({**self.settings.model_dump(), **configuration})
            agents = OpenAITradeAgents(settings)

            async def on_stage(stage: str) -> None:
                await self.session.refresh(run)
                if run.status != "running":
                    raise AppError(409, "suggestion_stopped", "Generation has been stopped.")
                run.stage = stage
                await self.session.commit()

            graph = build_suggestion_graph(agents, settings.trade_suggestions_min_reward_risk, on_stage)
            initial = SuggestionState(
                context=run.context_json, proposal=None, review=None, validation_error=None,
                revision=0, calls=0, reward_risk=None, terminal_error=None,
            )
            async with asyncio.timeout(settings.trade_suggestions_run_timeout_seconds):
                output = await graph.ainvoke(initial, {"recursion_limit": 16})
            if output.get("terminal_error"):
                raise AppError(422, "invalid_setup", "The agents could not produce a valid setup.")
            proposal, review = output["proposal"], output["review"]
            if proposal is None or review is None:
                raise AppError(422, "invalid_setup", "A validated proposal and review are required.")
            await self.session.refresh(run)
            if run.status != "running":
                return run
            run.result_json = proposal.model_dump(mode="json")
            run.review_json = review.model_dump(mode="json")
            run.reward_risk = output["reward_risk"]
            run.status = "completed"
            run.stage = "completed"
        except AppError as error:
            run.status = "blocked"
            run.stage = "blocked"
            run.error_code, run.error_message = error.code, error.message
        except asyncio.CancelledError:
            cancelled = True
            run.status = "failed"
            run.stage = "failed"
            run.error_code = "worker_interrupted"
            run.error_message = "The worker stopped. Request a new run."
        except Exception:
            run.status = "failed"
            run.stage = "failed"
            run.error_code = "ai_generation_failed"
            run.error_message = "AI generation failed, was refused, or timed out. Request a new run."
        finally:
            run.usage_json = {
                "calls": agents.usage if agents else [],
                "latency_ms": round((time.perf_counter() - started) * 1000),
            }
            run.completed_at = utc_now()
            completed = False
            try:
                await self.session.commit()
                completed = run.status == "completed"
            finally:
                await finish_credit(self.session, self.settings, run.id, success=completed)
        if cancelled:
            raise asyncio.CancelledError
        return run
