import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspaceStats } from "@/components/ui/WorkspaceStats";
import { ButtonLink } from "@/components/ui/Button";
import type { ScannerData } from "@/lib/scanner/types";
import { navigationHref } from "@/lib/ui/navigation";

export function ScannerHero({ data }: { data: ScannerData }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Find something worth reviewing" title="Market scanner" description="Choose a watchlist, run a scan, and explore the setups it finds."
        actions={<><ButtonLink href={navigationHref("dataOnboarding", data.workspace?.id)} variant="quiet">Manage data</ButtonLink><ButtonLink href={navigationHref("triage", data.workspace?.id)}>View setups</ButtonLink></>} />
      <WorkspaceStats items={[
        { label: "Watchlists", value: data.watchlists.length },
        { label: "Active scans", value: data.scanConfigs.filter((config) => config.status === "active").length },
        { label: "Due to run", value: data.dueScanConfigs.length },
        { label: "Recent scans", value: data.recentRuns.length },
      ]} />
    </div>
  );
}
