import re
from decimal import Decimal

from app.modules.trade_agent.suggestions.schemas import SetupProposal

UNSUPPORTED_CLAIMS = re.compile(
    r"guaranteed|risk[- ]free|cannot lose|sure win|place (?:an? )?order|"
    r"execute (?:a )?trade|use leverage",
    re.IGNORECASE,
)


def validate_text(text: str) -> None:
    if UNSUPPORTED_CLAIMS.search(text):
        raise ValueError("Unsupported certainty or execution claim")


def validate_evidence(refs: list[str], available: set[str]) -> None:
    if not refs or len(refs) != len(set(refs)) or not set(refs).issubset(available):
        raise ValueError("Evidence references must identify supplied market evidence")


def validate_setup(
    proposal: SetupProposal, evidence_refs: set[str], minimum_ratio: Decimal
) -> Decimal | None:
    validate_evidence(proposal.evidence_refs, evidence_refs)
    validate_text(" ".join([proposal.rationale, proposal.invalidation, *proposal.risks]))
    if proposal.decision == "WAIT":
        if any(value is not None for value in (
            proposal.entry_lower, proposal.entry_upper, proposal.stop_loss
        )) or proposal.targets:
            raise ValueError("WAIT cannot contain trade levels")
        return None
    if None in (proposal.entry_lower, proposal.entry_upper, proposal.stop_loss):
        raise ValueError("Directional setups require entry bounds and a stop")
    lower, upper, stop = (
        Decimal(str(value))
        for value in (proposal.entry_lower, proposal.entry_upper, proposal.stop_loss)
    )
    targets = [Decimal(str(value)) for value in proposal.targets]
    if not targets or any(not value.is_finite() or value <= 0 for value in [
        lower, upper, stop, *targets
    ]) or lower > upper:
        raise ValueError("Prices must be finite, positive and ordered")
    if proposal.decision == "BUY":
        if not stop < lower <= upper < targets[0] or targets != sorted(set(targets)):
            raise ValueError("BUY requires stop < entry zone < increasing targets")
        ratio = (targets[0] - upper) / (upper - stop)
    else:
        if not targets[0] < lower <= upper < stop or targets != sorted(set(targets), reverse=True):
            raise ValueError("SELL requires decreasing targets < entry zone < stop")
        ratio = (lower - targets[0]) / (stop - lower)
    if ratio < minimum_ratio:
        raise ValueError(f"First target reward-to-risk must be at least {minimum_ratio}:1")
    return ratio
