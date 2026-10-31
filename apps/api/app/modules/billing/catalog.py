from dataclasses import dataclass
from typing import Literal

type PlanKey = Literal["free", "pro", "team"]
STRIPE_PRODUCT_ID = "quantrift_workspace_v1"


@dataclass(frozen=True)
class Plan:
    key: PlanKey
    name: str
    amount: int
    credits: int
    members: int
    description: str


PLANS: dict[PlanKey, Plan] = {
    "free": Plan("free", "Free", 0, 0, 1, "Build your daily research routine."),
    "pro": Plan("pro", "Pro", 2900, 100, 1, "Bring AI agents into your setup review."),
    "team": Plan("team", "Team", 7900, 500, 5, "Research together in a shared workspace."),
}

CORE_FEATURES = (
    "Charts and market context", "Watchlists and market scanner",
    "Setup evidence and confidence", "Journal and saved research",
)
