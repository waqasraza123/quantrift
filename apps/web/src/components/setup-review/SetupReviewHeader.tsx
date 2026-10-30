import { Badge } from "@/components/status/badge";
import { BiasBadge } from "@/components/status/BiasBadge";
import { ConfidenceBadge } from "@/components/status/ConfidenceBadge";
import { SetupQualityBadge } from "@/components/status/SetupQualityBadge";
import type { SetupReviewModel } from "@/lib/setup-review/types";

export function SetupReviewHeader({ model }: { model: SetupReviewModel }) {
  const { header } = model;
  return (
    <header className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Chart & setup review</p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--strong)]">{header.symbol}</h1><Badge value={header.timeframe} tone="neutral" /></div>
        <div className="flex flex-wrap gap-2"><BiasBadge value={header.bias} /><ConfidenceBadge value={header.confidenceLabel} /><SetupQualityBadge value={header.setupQualityLabel} /></div>
      </div>
      <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">{header.summary}</p>
      <p className="text-[11px] text-[var(--muted)]">The original signal and AI assessment are separate perspectives. Check the candle timestamps and invalidation conditions.</p>
    </header>
  );
}
