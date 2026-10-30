import { WorkspaceStats } from "@/components/ui/WorkspaceStats";
import type { DashboardData } from "@/lib/api/dashboard";

export function TopSummaryRail({ data }: { data: DashboardData }) {
  const fresh = data.memorySnapshots.filter((snapshot) => snapshot.freshness_label === "fresh").length;
  return <WorkspaceStats items={[
    { label: "Watchlists", value: data.watchlists.filter(({ watchlist }) => watchlist.status === "active").length },
    { label: "Market views", value: data.memorySnapshots.length, detail: "Symbol / timeframe pairs" },
    { label: "Fresh views", value: fresh },
    { label: "Needs a refresh", value: data.memorySnapshots.length - fresh },
  ]} />;
}
