import { Button, ButtonLink } from "@/components/ui/Button";
import { triageColumns } from "@/lib/triage/labels";
import type { TriageBoardData } from "@/lib/triage/types";
import { humanizeLabel } from "@/lib/formatting/labels";

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--strong)]";

export function TriageFilters({ data }: { data: TriageBoardData }) {
  const filters = data.filters;
  const workspaceId = data.workspace?.id || filters.workspaceId;
  const symbolsById = new Map(data.symbols.map((symbol) => [symbol.id, symbol]));
  const timeframes = uniqueOptions(data.allCandidates.map((candidate) => candidate.signal.signal.timeframe));
  const moreFilters = Boolean(filters.bias || filters.confidence || filters.column || filters.freshness || filters.profileKey || filters.preferenceProfileId || filters.symbolId || filters.onlyReviewRequired);
  const resetHref = workspaceId ? `/triage?workspaceId=${encodeURIComponent(workspaceId)}` : "/triage";
  return (
    <form action="/triage" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      {workspaceId && <input type="hidden" name="workspaceId" value={workspaceId} />}
      <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(160px,1.4fr)_1fr_1fr_auto]">
        <label className="block text-xs font-medium text-[var(--muted)]">Search markets<input className={inputClass} name="symbolSearch" defaultValue={filters.symbolSearch || ""} placeholder="BTC, ETH, SPY…" /></label>
        <Select name="timeframe" label="Timeframe" value={filters.timeframe} options={timeframes.map((value) => ({ value, label: value }))} />
        <Select name="sort" label="Sort by" value={filters.sort || "priority"} includeAll={false} options={[{ value: "priority", label: "Review priority" }, { value: "freshness", label: "Freshness" }, { value: "confidence", label: "Confidence" }, { value: "created", label: "Most recent" }]} />
        <div className="flex min-h-10 items-center gap-2"><Button type="submit" variant="primary">Apply filters</Button><ButtonLink href={resetHref} variant="quiet">Reset</ButtonLink></div>
      </div>
      <div className="mt-4 flex items-center gap-4"><label className="inline-flex items-center gap-2 text-xs text-[var(--muted)]"><input type="checkbox" name="onlyFresh" value="1" defaultChecked={filters.onlyFresh} className="accent-[var(--accent)]" />Fresh context only</label></div>
      <details open={moreFilters} className="group mt-4 border-t border-[var(--line)] pt-3">
        <summary className="w-fit cursor-pointer text-xs font-medium text-[var(--muted)]">More filters</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select name="symbolId" label="Specific market" value={filters.symbolId} options={uniqueOptions(data.allCandidates.map((candidate) => candidate.signal.signal.symbol_id)).map((value) => ({ value, label: symbolsById.get(value)?.symbol || value }))} />
          <Select name="bias" label="Direction" value={filters.bias} options={uniqueOptions(data.allCandidates.map((candidate) => candidate.signal.signal.bias)).map(labelOption)} />
          <Select name="confidence" label="Confidence" value={filters.confidence} options={uniqueOptions(data.allCandidates.map((candidate) => candidate.signal.signal.confidence_label)).map(labelOption)} />
          <Select name="column" label="Review status" value={filters.column} options={triageColumns.map((column) => ({ value: column.key, label: column.title }))} />
          <Select name="freshness" label="Data freshness" value={filters.freshness} options={uniqueOptions(data.allCandidates.map((candidate) => candidate.memory?.freshness_label)).map(labelOption)} />
          <Select name="profileKey" label="Strategy" value={filters.profileKey} options={uniqueOptions(data.allCandidates.map((candidate) => candidate.signal.signal.strategy_profile_key)).map(labelOption)} />
          <Select name="preferenceProfileId" label="Review preferences" value={filters.preferenceProfileId} options={data.preferenceProfiles.map((profile) => ({ value: profile.id, label: profile.name }))} />
          <label className="flex items-center gap-2 self-end py-3 text-xs text-[var(--muted)]"><input type="checkbox" name="onlyReviewRequired" value="1" defaultChecked={filters.onlyReviewRequired} className="accent-[var(--accent)]" />Needs manual review</label>
        </div>
      </details>
    </form>
  );
}

function Select({ label, name, value, options, includeAll = true }: {
  label: string; name: string; value?: string; options: { value: string; label: string }[]; includeAll?: boolean;
}) {
  return <label className="block text-xs font-medium text-[var(--muted)]">{label}<select className={inputClass} name={name} defaultValue={value || ""}>{includeAll && <option value="">All</option>}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function uniqueOptions(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
}

function labelOption(value: string) {
  return { value, label: humanizeLabel(value) };
}
