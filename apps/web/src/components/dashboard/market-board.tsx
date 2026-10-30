import Link from "next/link";
import { EmptyState } from "@/components/empty-states/empty-state";
import { Panel } from "@/components/layout/panel";
import { Badge, toneForBias, toneForQuality } from "@/components/status/badge";
import { ProductIcon } from "@/components/ui/ProductIcon";
import type { DashboardData } from "@/lib/api/dashboard";
import type { MarketMemorySnapshot } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/formatting/dates";
import { humanizeLabel, shortIdentifier } from "@/lib/formatting/labels";
import { navigationHref } from "@/lib/ui/navigation";

export function MarketBoard({ data }: { data: DashboardData }) {
  const symbols = new Map(data.symbols.map((symbol) => [symbol.id, symbol]));
  const rows = new Map<string, { symbolId: string; timeframe: string; memory: MarketMemorySnapshot | null }>();
  for (const snapshot of data.memorySnapshots) {
    rows.set(`${snapshot.symbol_id}:${snapshot.timeframe}`, { symbolId: snapshot.symbol_id, timeframe: snapshot.timeframe, memory: snapshot });
  }
  for (const { items } of data.watchlists) {
    for (const item of items) {
      const key = `${item.symbol_id}:${item.timeframe}`;
      if (!rows.has(key)) rows.set(key, { symbolId: item.symbol_id, timeframe: item.timeframe, memory: null });
    }
  }
  return (
    <Panel title="Your markets" action={<Link href={navigationHref("scanner", data.workspace?.id)} className="text-xs font-semibold text-[var(--accent-strong)]">Edit watchlists →</Link>}>
      {!rows.size ? <div className="space-y-4"><EmptyState title="Build your watchlist" message="Choose a few markets in the scanner. Their latest context will appear here after analysis." /><Link href={navigationHref("scanner", data.workspace?.id)} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-strong)]">Choose markets<ProductIcon name="arrow" className="h-4 w-4" /></Link></div> : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div aria-hidden="true" className="hidden grid-cols-[1.1fr_1fr_1fr_1fr_100px] gap-4 border-b border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] md:grid"><span>Market</span><span>Direction</span><span>Pattern</span><span>Last candle</span><span /></div>
          <ul className="divide-y divide-[var(--line)]">{Array.from(rows.entries()).map(([key, row]) => {
            const symbol = symbols.get(row.symbolId);
            const href = row.memory?.latest_signal_id ? `/signals/${row.memory.latest_signal_id}?workspaceId=${data.workspace?.id || ""}` : `/symbols/${row.symbolId}?workspaceId=${data.workspace?.id || ""}`;
            return <li key={key}><Link href={href} className="group grid grid-cols-2 items-center gap-3 px-4 py-4 transition-colors hover:bg-[var(--surface-muted)] md:grid-cols-[1.1fr_1fr_1fr_1fr_100px] md:gap-4">
              <div><p className="text-sm font-semibold">{symbol?.symbol || shortIdentifier(row.symbolId)}</p><p className="mt-1 text-xs text-[var(--muted)]">{row.timeframe}</p></div>
              <div className="justify-self-end md:justify-self-start"><Badge value={row.memory?.latest_signal_bias || "Awaiting data"} tone={toneForBias(row.memory?.latest_signal_bias)} /></div>
              <p className="text-xs text-[var(--muted)]">{humanizeLabel(row.memory?.latest_signal_pattern_type || "Not analyzed")}</p>
              <div className="text-right md:text-left"><p className="text-[11px] text-[var(--muted)]">{formatRelativeTime(row.memory?.latest_final_candle_time)}</p>{row.memory && <span className="mt-1 inline-block"><Badge value={row.memory.freshness_label || "Unknown"} tone={toneForQuality(row.memory.freshness_label)} /></span>}</div>
              <span className="col-span-2 inline-flex items-center gap-2 text-xs font-medium text-[var(--accent-strong)] md:col-span-1 md:justify-self-end">{row.memory?.latest_signal_id ? "Open setup" : "View market"}<ProductIcon name="arrow" className="h-3.5 w-3.5" /></span>
            </Link></li>;
          })}</ul>
        </div>
      )}
    </Panel>
  );
}
