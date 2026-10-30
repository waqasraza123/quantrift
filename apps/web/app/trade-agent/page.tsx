import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/empty-states/empty-state";
import { ButtonLink } from "@/components/ui/Button";
import { DisclosurePanel } from "@/components/ui/DisclosurePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspaceStats } from "@/components/ui/WorkspaceStats";
import { TradeAgentPlanBoard } from "@/components/trade-agent/TradeAgentPlanBoard";
import { getTradeAgentData } from "@/lib/api/tradeAgent";
import { navigationHref } from "@/lib/ui/navigation";

export default async function TradeAgentPage({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const data = await getTradeAgentData(await searchParams);
  return (
    <AppShell appName={data.appName} workspaceId={data.workspace?.id} workspaceName={data.workspace?.name}>
      <div className="space-y-6">
        <PageHeader eyebrow="Keep your research together" title="Paper plans" description="Revisit the setups you saved, review their context, and link your observations to your journal."
          actions={<><ButtonLink href={navigationHref("journal", data.workspace?.id)} variant="quiet">Open journal</ButtonLink><ButtonLink href={navigationHref("triage", data.workspace?.id)} variant="primary">Explore setups</ButtonLink></>} />
        <WorkspaceStats items={[
          { label: "Saved plans", value: data.plans.length },
          { label: "Ready to review", value: data.plans.filter((plan) => plan.status === "ready_for_review").length },
          { label: "Paper followed", value: data.plans.filter((plan) => plan.status === "paper_followed").length },
        ]} />
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm leading-6 text-[var(--muted)]">Looking for a new AI assessment? Open a setup chart and choose <span className="font-medium text-[var(--strong)]">Analyze with AI</span>. This page holds your saved paper plans.</div>
        <TradeAgentPlanBoard data={data} />
        {data.failures.some((failure) => !failure.missing) && <DisclosurePanel title="Data availability" description="Review connection details for any missing planning context."><EmptyState title="Some planning context is unavailable" message={data.failures.filter((failure) => !failure.missing).map((failure) => failure.message).join(" · ")} /></DisclosurePanel>}
      </div>
    </AppShell>
  );
}
