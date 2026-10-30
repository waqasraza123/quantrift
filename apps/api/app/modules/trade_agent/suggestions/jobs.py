import asyncio
from contextlib import suppress
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.errors import AppError
from app.db.session import get_async_session_factory
from app.modules.job_queue.dispatcher import JobQueueHandlerResult
from app.modules.job_queue.models import JobQueueItem
from app.modules.job_queue.service import JobQueueService
from app.modules.trade_agent.suggestions.service import SuggestionService


async def handle_trade_suggestion_job(
    job: JobQueueItem, session: AsyncSession
) -> JobQueueHandlerResult:
    try:
        suggestion_id = UUID(str(job.payload_json["suggestionId"]))
    except (KeyError, ValueError, TypeError) as error:
        raise AppError(422, "invalid_suggestion_job", "Suggestion job payload is invalid.") from error
    settings = get_settings()
    factory = get_async_session_factory()
    if factory is None or job.locked_by is None:
        raise AppError(503, "suggestion_worker_unavailable", "A leased database job is required.")
    worker_id = job.locked_by
    service = SuggestionService(session, settings)
    run = await service.require_run(suggestion_id)
    if run.workspace_id != job.workspace_id or run.job_id != job.id:
        raise AppError(422, "invalid_suggestion_job", "Suggestion job ownership does not match.")

    async def heartbeat() -> None:
        while True:
            await asyncio.sleep(max(1, settings.job_queue_lock_seconds / 3))
            async with factory() as heartbeat_session:
                await JobQueueService(heartbeat_session, settings).heartbeat(job.id, worker_id)

    heartbeat_task = asyncio.create_task(heartbeat())
    generation_task = asyncio.create_task(service.execute(suggestion_id))
    try:
        done, _ = await asyncio.wait(
            {heartbeat_task, generation_task}, return_when=asyncio.FIRST_COMPLETED,
        )
        if generation_task not in done:
            generation_task.cancel()
            with suppress(asyncio.CancelledError):
                await generation_task
            raise AppError(503, "suggestion_lease_lost", "The suggestion worker lost its lease.") from None
        result = await generation_task
        return JobQueueHandlerResult(
            result_json={"suggestionId": str(result.id), "status": result.status},
            completed_with_warnings=result.status != "completed",
        )
    finally:
        heartbeat_task.cancel()
        generation_task.cancel()
        with suppress(asyncio.CancelledError, Exception):
            await heartbeat_task
        with suppress(asyncio.CancelledError, Exception):
            await generation_task
