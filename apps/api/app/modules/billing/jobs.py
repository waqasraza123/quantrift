from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.modules.billing.models import BillingEvent
from app.modules.billing.service import BillingService
from app.modules.billing.state import billing_account
from app.modules.job_queue.dispatcher import JobQueueHandlerResult
from app.modules.job_queue.models import JobQueueItem


async def handle_billing_job(job: JobQueueItem, session: AsyncSession) -> JobQueueHandlerResult:
    event_id = job.payload_json.get("eventId")
    event = await session.scalar(select(BillingEvent).where(
        BillingEvent.event_id == event_id,
    ))
    if event is None or job.workspace_id is None:
        raise AppError(422, "invalid_billing_job", "Billing job payload is invalid.")
    account = await billing_account(session, job.workspace_id, lock=True)
    if account.customer_id != event.customer_id:
        raise AppError(422, "invalid_billing_job", "Billing job workspace does not match.")
    if event.processed_at is None:
        await BillingService(session, get_settings()).reconcile(account)
        event.processed_at = utc_now()
        await session.commit()
    return JobQueueHandlerResult(result_json={"eventId": event.event_id})
