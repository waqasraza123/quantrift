import { AppShell } from "@/components/layout/AppShell";
import { ScanConfigForm } from "@/components/scanner/ScanConfigForm";
import { ScanConfigList } from "@/components/scanner/ScanConfigList";
import { ScanResultSignalList } from "@/components/scanner/ScanResultSignalList";
import { ScanRunDetail } from "@/components/scanner/ScanRunDetail";
import { ScanRunHistory } from "@/components/scanner/ScanRunHistory";
import { ScannerEmptyState } from "@/components/scanner/ScannerEmptyState";
import { ScannerErrorState } from "@/components/scanner/ScannerErrorState";
import { ScannerHero } from "@/components/scanner/ScannerHero";
import { ScannerPresetGallery } from "@/components/scanner/ScannerPresetGallery";
import { WatchlistManager } from "@/components/scanner/WatchlistManager";
import { DailyWorkflowPanel } from "@/components/daily-workflows/DailyWorkflowPanel";
import { RunScanNowPanel } from "@/components/scanner/RunScanNowPanel";
import { DisclosurePanel } from "@/components/ui/DisclosurePanel";
import { getScannerData } from "@/lib/api/scanner";

type ScannerPageProps = { searchParams: Promise<{ workspaceId?: string; runId?: string; workflowRunId?: string }> };

export default async function ScannerPage({ searchParams }: ScannerPageProps) {
  const params = await searchParams;
  const data = await getScannerData(params);
  const needsConfiguration = data.scanConfigs.every((config) => config.status !== "active");
  return (
    <AppShell appName={data.appName} workspaceId={data.workspace?.id} workspaceName={data.workspace?.name}>
      <div className="space-y-6">
        <ScannerHero data={data} />
        {!data.workspace ? <ScannerEmptyState title="Choose your first markets" message="Create a workspace to add watchlists and start scanning." /> : (
          <>
            {needsConfiguration && <div className="rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--strong)]">Start with a preset below, or add your own watchlist and scan schedule.</div>}
            {!needsConfiguration && <RunScanNowPanel data={data} />}
            <ScanResultSignalList data={data} />
            <DisclosurePanel id="scanner-configuration" title="Watchlists & scan settings" description="Add markets, choose a preset, or manage recurring scans." open={needsConfiguration}>
              <ScannerPresetGallery data={data} />
              <WatchlistManager data={data} />
              <ScanConfigForm data={data} />
              <ScanConfigList data={data} />
            </DisclosurePanel>
            <DisclosurePanel title="Scan history & details" description="Revisit a previous scan and its data context." open={Boolean(params.runId)}>
              <ScanRunHistory data={data} />
              <ScanRunDetail data={data} />
            </DisclosurePanel>
            <DisclosurePanel title="Daily research workflow" description="Run and inspect the longer data-to-brief workflow." open={Boolean(params.workflowRunId)}>
              <DailyWorkflowPanel workspaceId={data.workspace.id} watchlistId={data.watchlists[0]?.watchlist.id || null} runs={data.dailyWorkflowRuns} selectedRun={data.selectedDailyWorkflowRun} selectedSteps={data.selectedDailyWorkflowSteps} basePath="/scanner" />
            </DisclosurePanel>
            {data.failures.length > 0 && <DisclosurePanel title="Data availability" description="Review missing sources or connection issues."><ScannerErrorState failures={data.failures} /></DisclosurePanel>}
          </>
        )}
      </div>
    </AppShell>
  );
}
