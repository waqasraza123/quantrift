import { CandleChart } from "@/components/charts/CandleChart";
import { Badge } from "@/components/status/badge";
import type { TradeSuggestion } from "@/lib/api/tradeSuggestions";
import { tradeSuggestionChart } from "@/lib/charts/tradeSuggestions";
import { formatDateTime } from "@/lib/formatting/dates";

type TradeSuggestionResultProps = {
  suggestion: TradeSuggestion;
  showLevels: boolean;
  now: number;
};

const priceFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 10 });

function price(value: number | null): string {
  return value === null ? "Unavailable" : priceFormatter.format(value);
}

export function TradeSuggestionResult({ suggestion, showLevels, now }: TradeSuggestionResultProps) {
  const expired = suggestion.is_outdated || !suggestion.expires_at || Date.parse(suggestion.expires_at) <= now;
  const chart = tradeSuggestionChart({ ...suggestion, is_outdated: expired }, showLevels && suggestion.actionable);
  const proposal = suggestion.result_json;
  const bias = suggestion.context_json.original_signal?.bias;
  const disagrees = proposal && (
    (proposal.decision === "BUY" && bias === "bearish") ||
    (proposal.decision === "SELL" && bias === "bullish")
  );

  return (
    <div className="space-y-4">
      {suggestion.error_message && (
        <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {suggestion.error_message}
        </p>
      )}
      {proposal && suggestion.status === "completed" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge value={`AI ${proposal.decision}`} tone={proposal.decision === "BUY" ? "good" : proposal.decision === "SELL" ? "danger" : "neutral"} />
            <Badge value="Paper setup · human review" tone="info" />
            {expired && <Badge value="Outdated · regenerate to reassess" tone="warning" />}
            {disagrees && <Badge value="Differs from original signal" tone="warning" />}
            {suggestion.reward_risk && <Badge value={`${Number(suggestion.reward_risk).toFixed(2)}:1 reward/risk`} tone="info" />}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--strong)]">{proposal.rationale}</p>
          {proposal.decision !== "WAIT" && (
            <dl className={`grid gap-3 text-sm sm:grid-cols-3 ${expired ? "opacity-60" : ""}`}>
              <div className="muted-surface rounded-lg p-3"><dt className="text-slate-500">Proposed entry zone</dt><dd>{price(proposal.entry_lower)} – {price(proposal.entry_upper)}</dd></div>
              <div className="muted-surface rounded-lg p-3"><dt className="text-slate-500">Stop loss</dt><dd>{price(proposal.stop_loss)}</dd></div>
              <div className="muted-surface rounded-lg p-3"><dt className="text-slate-500">Targets</dt><dd>{proposal.targets.map(price).join(" / ")}</dd></div>
            </dl>
          )}
        </>
      )}
      {chart.slots.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Saved candle window used by the agents · {suggestion.context_json.timeframe}</p>
          <CandleChart slots={chart.slots} overlays={chart.overlays} latestFinalCandle={chart.latest} />
        </div>
      )}
      {proposal && (
        <div className="grid gap-3 text-sm lg:grid-cols-2">
          <div className="muted-surface rounded-lg p-3"><p className="font-semibold">Invalidation / reassessment</p><p className="mt-2 whitespace-pre-wrap">{proposal.invalidation}</p></div>
          <div className="muted-surface rounded-lg p-3"><p className="font-semibold">Risk review</p><p className="mt-2 whitespace-pre-wrap">{suggestion.review_json?.summary || "No review available."}</p></div>
          {proposal.risks.length > 0 && <div className="lg:col-span-2"><p className="font-semibold">Risks</p><ul className="mt-2 list-disc space-y-1 pl-5">{proposal.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul></div>}
          <details className="lg:col-span-2">
            <summary className="cursor-pointer text-slate-500">Supporting evidence references</summary>
            <ul className="mt-2 space-y-1 break-all text-xs">{proposal.evidence_refs.map((reference) => <li key={reference}>{reference}</li>)}</ul>
          </details>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Data closed: {formatDateTime(suggestion.context_json.as_of)} · Expires: {formatDateTime(suggestion.expires_at)} · {suggestion.model}
      </p>
    </div>
  );
}
