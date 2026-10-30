import Link from "next/link";
import { EmptyState } from "@/components/empty-states/empty-state";
import { Panel } from "@/components/layout/panel";
import { SetupList } from "@/components/setups/SetupList";
import { Badge } from "@/components/status/badge";
import { ButtonLink } from "@/components/ui/Button";
import { DisclosurePanel } from "@/components/ui/DisclosurePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductIcon } from "@/components/ui/ProductIcon";
import { WorkspaceStats } from "@/components/ui/WorkspaceStats";
import { commandCenterHref } from "@/lib/command-center/labels";
import type { CommandCenterData } from "@/lib/command-center/types";
import { formatDateTime } from "@/lib/formatting/dates";
import { CommandCenterDailyScanButton } from "./CommandCenterDailyScanButton";
import { CommandCenterOverview } from "./CommandCenterOverview";
import { CommandCenterReadinessGate } from "./CommandCenterReadinessGate";
import { CommandCenterErrorState } from "./CommandCenterErrorState";

export function CommandCenterCockpit({ data }: { data: CommandCenterData }) {
  const workspaceId = data.workspace?.id || null;
  const href = (path: string) => commandCenterHref(path, workspaceId);
  const needsSetup = data.onboardingStatus && data.onboardingStatus.next_step.key !== "open_command_center";
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Your daily view" title="Start with what matters." description="Review the strongest context, keep an eye on your data, and pick up where you left off."
        actions={<><ButtonLink href={href("/triage")} variant="quiet">All setups</ButtonLink><CommandCenterDailyScanButton workspaceId={workspaceId} watchlistId={data.dailyWorkflowDefaultWatchlistId} preferenceProfileId={data.selectedPreferenceProfile?.id} /></>} />
      {data.backendUnavailable && <div role="status" className="rounded-xl border border-amber-300/60 bg-amber-500/5 px-4 py-3 text-sm text-[var(--strong)]">Some market data could not be loaded. Your saved research is still available where connected.</div>}
      {!data.workspace ? (
        <div className="space-y-4"><EmptyState title="Create your first workspace" message="Choose your markets and add a data source to start building your research view." /><ButtonLink href="/onboarding" variant="primary">Set up your workspace</ButtonLink></div>
      ) : (
        <>
          {needsSetup && <CommandCenterReadinessGate data={data} />}
          <WorkspaceStats items={[
            { label: "Ready to review", value: data.summary.reviewFirstCount, detail: "Prioritized setups" },
            { label: "Needs confirmation", value: data.summary.confirmationCount, detail: "Keep on watch" },
            { label: "Fresh market views", value: data.summary.freshSymbolCount, detail: "Stored candle context" },
            { label: "Follow-up reviews", value: data.summary.outcomeReadyCount, detail: "Observed outcomes" },
          ]} />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-6">
              <Panel title="Setups to look at" action={<Link href={href("/triage")} className="text-xs font-semibold text-[var(--accent-strong)]">View all →</Link>}>
                <SetupList items={data.reviewFirst.slice(0, 6).map((item) => ({
                  id: item.signalId, symbol: item.symbol, timeframe: item.timeframe,
                  bias: item.bias, confidence: item.confidenceLabel, status: item.setupQualityLabel,
                  reason: item.mainReason, href: item.href,
                }))} />
              </Panel>
              <Panel title="Keep on watch" action={<Link href={href("/triage")} className="text-xs text-[var(--accent-strong)]">Browse setups →</Link>}>
                {data.needsConfirmation.length ? <ul className="divide-y divide-[var(--line)]">{data.needsConfirmation.slice(0, 4).map((item) => <li key={item.id}><Link href={item.href} className="flex items-start justify-between gap-4 py-3"><div><p className="text-sm font-medium text-[var(--strong)]">{item.symbol}<span className="ml-2 text-xs font-normal text-[var(--muted)]">{item.timeframe}</span></p><p className="mt-1 text-xs leading-6 text-[var(--muted)]">{item.reason}</p></div><Badge value="Waiting" tone="warning" /></Link></li>)}</ul> : <p className="text-sm leading-6 text-[var(--muted)]">No setups are waiting for confirmation in the current view.</p>}
              </Panel>
              {data.outcomeReview.length > 0 && <Panel title="Ready for a look back" action={<Link href={href("/review/outcomes")} className="text-xs text-[var(--accent-strong)]">Review outcomes →</Link>}><ul className="divide-y divide-[var(--line)]">{data.outcomeReview.slice(0, 3).map((item) => <li key={item.id}><Link href={item.href} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{item.symbol} <span className="text-xs text-[var(--muted)]">{item.timeframe}</span></p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.detail}</p></div><Badge value={item.observationLabel} tone="info" /></Link></li>)}</ul></Panel>}
            </div>
            <aside className="space-y-5">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
                <ProductIcon name="sparkles" className="h-5 w-5 text-[var(--accent)]" /><h2 className="mt-4 text-base font-semibold tracking-tight">Give a setup a second look.</h2><p className="mt-2 text-xs leading-6 text-[var(--muted)]">Open a setup chart, request an AI assessment, and compare the analyst’s idea with its risk review.</p><ButtonLink href={href("/triage")} className="mt-4" size="sm">Find a setup</ButtonLink>
              </div>
              <Panel title="Data to check"><p className="text-xs leading-6 text-[var(--muted)]">{data.summary.staleOrDegradedCount > 0 ? `${data.summary.staleOrDegradedCount} market view(s) need fresher data before you rely on their context.` : "Check the candle timestamp on each setup before using its assessment."}</p><Link href={href("/data/onboarding")} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent-strong)]">Manage market data<ProductIcon name="arrow" className="h-3.5 w-3.5" /></Link></Panel>
              <Panel title="Your research notes">{data.journalPrompts.length ? <ul className="space-y-4">{data.journalPrompts.slice(0, 3).map((item) => <li key={item.id}><Link href={item.href} className="block"><p className="text-xs font-medium text-[var(--strong)]">{item.label}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{item.detail}</p></Link></li>)}</ul> : <p className="text-xs leading-6 text-[var(--muted)]">Record what you noticed and what would change your view.</p>}<Link href={href("/journal")} className="mt-4 block text-xs font-semibold text-[var(--accent-strong)]">Open journal →</Link></Panel>
            </aside>
          </div>
          <DisclosurePanel title="Workspace details" description="Workflow progress, readiness, data warnings, and connection details.">
            <CommandCenterOverview data={data} />
            <CommandCenterErrorState failures={data.failures} backendUnavailable={data.backendUnavailable} />
            <div className="flex flex-wrap gap-3 text-xs text-[var(--accent-strong)]"><Link href={href("/readiness")}>Readiness</Link><Link href={href("/quality")}>Data diagnostics</Link><Link href={href("/notifications")}>Notifications</Link></div>
          </DisclosurePanel>
        </>
      )}
      <p className="text-[11px] text-[var(--muted)]">Updated {formatDateTime(data.generatedAt)} · Suggestions are for research and human review.</p>
    </div>
  );
}
