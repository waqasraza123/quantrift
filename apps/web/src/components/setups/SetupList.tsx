import Link from "next/link";
import { Badge, toneForBias, toneForQuality } from "@/components/status/badge";
import { EmptyState } from "@/components/empty-states/empty-state";
import { ProductIcon } from "@/components/ui/ProductIcon";

export type SetupListItem = {
  id: string;
  symbol: string;
  timeframe: string;
  bias: string;
  confidence: string;
  status: string;
  reason: string;
  href: string;
};

export function SetupList({ items, emptyTitle = "No setups to review yet", emptyDescription = "Run a scan from your watchlist to find setups. They will appear here when analysis is available." }: {
  items: SetupListItem[]; emptyTitle?: string; emptyDescription?: string;
}) {
  if (!items.length) return <EmptyState title={emptyTitle} message={emptyDescription} />;
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)]">
      <div aria-hidden="true" className="hidden grid-cols-[1fr_.8fr_.9fr_1.8fr_24px] gap-4 border-b border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] lg:grid">
        <span>Market</span><span>Direction</span><span>Context</span><span>Why review it</span><span />
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="group grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)] lg:grid-cols-[1fr_.8fr_.9fr_1.8fr_24px] lg:gap-4">
              <div><p className="text-sm font-semibold text-[var(--strong)]">{item.symbol}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.timeframe} · {item.confidence}</p></div>
              <div><Badge value={item.bias} tone={toneForBias(item.bias)} /></div>
              <div className="hidden lg:block"><Badge value={item.status} tone={toneForQuality(item.status)} /></div>
              <p className="col-span-2 text-xs leading-6 text-[var(--muted)] lg:col-span-1">{item.reason}</p>
              <ProductIcon name="arrow" className="hidden h-4 w-4 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)] lg:block" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
