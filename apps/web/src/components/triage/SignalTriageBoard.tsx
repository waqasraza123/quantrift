import { EmptyState } from "@/components/empty-states/empty-state";
import { Panel } from "@/components/layout/panel";
import { SetupList } from "@/components/setups/SetupList";
import { ButtonLink } from "@/components/ui/Button";
import { DisclosurePanel } from "@/components/ui/DisclosurePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspaceStats } from "@/components/ui/WorkspaceStats";
import { humanizeLabel, shortIdentifier } from "@/lib/formatting/labels";
import type { TriageBoardData } from "@/lib/triage/types";
import { navigationHref } from "@/lib/ui/navigation";
import { TriageErrorState } from "./TriageErrorState";
import { TriageFilters } from "./TriageFilters";

export function SignalTriageBoard({ data }: { data: TriageBoardData }) {
  const workspaceId = data.workspace?.id;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Find your next review" title="Trade setups" description="A focused list of market ideas. Open a chart to inspect the evidence and request an AI assessment."
        actions={<><ButtonLink href={navigationHref("preferences", workspaceId)} variant="quiet">Review preferences</ButtonLink><ButtonLink href={navigationHref("scanner", workspaceId)} variant="primary">Scan for setups</ButtonLink></>} />
      {!data.workspace ? <div className="space-y-4"><EmptyState title="Set up your research workspace" message="Add a workspace and choose markets before reviewing setups." /><ButtonLink href="/onboarding">Get started</ButtonLink></div> : (
        <>
          <WorkspaceStats items={[
            { label: "In this view", value: data.candidates.length },
            { label: "Stronger context", value: data.allCandidates.filter((item) => item.classification.column === "high_quality_context").length },
            { label: "Waiting for confirmation", value: data.allCandidates.filter((item) => item.classification.column === "needs_confirmation").length },
            { label: "Data needs attention", value: data.allCandidates.filter((item) => item.classification.column === "stale_data_issue").length },
          ]} />
          <TriageFilters data={data} />
          <Panel title="Setups to explore" action={<span className="text-xs text-[var(--muted)]">{data.candidates.length} shown</span>}>
            <SetupList items={data.candidates.map((candidate) => {
              const signal = candidate.signal.signal;
              return {
                id: signal.id, symbol: candidate.symbol?.symbol || shortIdentifier(signal.symbol_id),
                timeframe: signal.timeframe, bias: humanizeLabel(signal.bias),
                confidence: humanizeLabel(signal.confidence_label),
                status: candidate.classification.mainReason.label,
                reason: candidate.classification.reasons.map((reason) => reason.label).slice(0, 2).join(" · ") || signal.summary,
                href: `/signals/${signal.id}?workspaceId=${encodeURIComponent(signal.workspace_id)}`,
              };
            })} emptyTitle="No setups match these filters" emptyDescription="Try a different symbol or timeframe, clear your filters, or run a new scan." />
          </Panel>
          {data.failures.length > 0 && <DisclosurePanel title="Data availability" description="Some context may be unavailable. Review the details before relying on a setup."><TriageErrorState failures={data.failures} /></DisclosurePanel>}
        </>
      )}
    </div>
  );
}
