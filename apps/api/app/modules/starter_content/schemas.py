from typing import Literal
from uuid import UUID

from app.core.schemas import ApiSchema


class StarterContentAction(ApiSchema):
    action: Literal["prepare", "disable"] = "prepare"


class StarterContentRead(ApiSchema):
    status: str
    step: int = 0
    total_steps: int
    can_initialize: bool
    source_id: UUID | None = None
    symbol_id: UUID | None = None
    timeframe: str = "1h"
    sample_data: bool = False
    busy: bool = False
