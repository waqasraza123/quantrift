import { BackendStatePanel } from "@/components/dashboard/backend-state-panel";
import { FollowUpPanel } from "@/components/dashboard/follow-up-panel";
import { MarketBoard } from "@/components/dashboard/market-board";
import { SignalFocusPanel } from "@/components/dashboard/signal-focus-panel";
import { SignalDigestPanel } from "@/components/dashboard/signal-digest-panel";
import { TopSummaryRail } from "@/components/dashboard/top-summary-rail";
import { WatchlistPanel } from "@/components/dashboard/watchlist-panel";
import { EmptyState } from "@/components/empty-states/empty-state";
import { AppShell } from "@/components/layout/AppShell";
import { ButtonLink } from "@/components/ui/Button";
import { DisclosurePanel } from "@/components/ui/DisclosurePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { getDashboardData } from "@/lib/api/dashboard";
import { navigationHref } from "@/lib/ui/navigation";

type DashboardPageProps = { searchParams: Promise<{ workspaceId?: string; signalId?: string }> };

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const data = await getDashboardData(params);
  const workspaceId = data.workspace?.id;
  return (
    <AppShell appName={data.appName} workspaceId={workspaceId} workspaceName={data.workspace?.name}>
      <div className="space-y-6">
        <PageHeader eyebrow="Your watchlists" title="Markets in focus" description="Follow your symbols, check the latest context, and open a chart when something deserves a closer look."
          actions={<><ButtonLink href={navigationHref("dataOnboarding", workspaceId)} variant="quiet">Manage data</ButtonLink><ButtonLink href={navigationHref("scanner", workspaceId)} variant="primary">Scan watchlist</ButtonLink></>} />
        {!data.workspace ? <EmptyState title="Add your first market" message="Set up a workspace and choose your symbols to start following their market context." /> : (
          <>
            <TopSummaryRail data={data} />
            <MarketBoard data={data} />
            {params.signalId && <SignalFocusPanel data={data} />}
            <DisclosurePanel title="Watchlists & recent summaries" description="Manage the markets you follow and revisit recent scan summaries."><WatchlistPanel data={data} /><SignalDigestPanel data={data} /></DisclosurePanel>
            <DisclosurePanel title="Data & connection details" description="Source availability, pending updates, and diagnostics."><FollowUpPanel data={data} /><BackendStatePanel data={data} /></DisclosurePanel>
          </>
        )}
      </div>
    </AppShell>
  );
}
