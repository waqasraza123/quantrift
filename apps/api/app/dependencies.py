from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_database_session
from app.modules.billing.usage import release_uncommitted_credits


async def database_session() -> AsyncIterator[AsyncSession]:
    async for session in get_database_session():
        try:
            yield session
        finally:
            await release_uncommitted_credits(session)
