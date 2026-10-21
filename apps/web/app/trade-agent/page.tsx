import { AppShell } from "@/components/layout/AppShell";
import { WorkflowLinks } from "@/components/layout/workflow-links";
import { EmptyState } from "@/components/empty-states/empty-state";
import {
  ReviewMetricGrid,
  ReviewSurfaceHero,
  ReviewSurfaceMetric,
} from "@/components/review-surfaces/ReviewSurface";
import { TradeAgentPlanBoard } from "@/components/trade-agent/TradeAgentPlanBoard";
import { getTradeAgentData } from "@/lib/api/tradeAgent";
import { AnimatedListItem, AnimatedSection, motionRevealDensityStyle } from "@/lib/ui/motion";

type TradeAgentPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function TradeAgentPage({ searchParams }: TradeAgentPageProps) {
  const params = await searchParams;
  const data = await getTradeAgentData(params);
  const activePlans = data.plans.filter((plan) => plan.status === "ready_for_review").length;
  const followedPlans = data.plans.filter((plan) => plan.status === "paper_followed").length;
  const reviewedPlans = data.plans.filter((plan) => plan.status === "reviewed").length;

  return (
    <AppShell appName={data.appName} workspaceId={data.workspace?.id} workspaceName={data.workspace?.name}>
      <AnimatedSection as="section" className="space-y-6">
        <AnimatedListItem as="section" style={motionRevealDensityStyle(0, "comfortable")}>
          <ReviewSurfaceHero
            eyebrow="AI paper trading agent"
            title="Paper plan review"
            description="Review paper-only setup plans composed from stored intelligence artifacts. This surface records observational decisions and excludes live execution."
            actions={
              <WorkflowLinks
                workspaceId={data.workspace?.id}
                targets={["commandCenter", "triage", "brief", "journal", "review"]}
              />
            }
          />
        </AnimatedListItem>
        {data.failures.some((failure) => !failure.missing) && (
          <AnimatedListItem as="section" style={motionRevealDensityStyle(1, "regular")}>
            <EmptyState
              title="Some paper planning context failed"
              message={data.failures.filter((failure) => !failure.missing).map((failure) => failure.message).join(" | ")}
            />
          </AnimatedListItem>
        )}
        <AnimatedListItem as="section" style={motionRevealDensityStyle(2, "regular")}>
          <ReviewMetricGrid>
            <ReviewSurfaceMetric label="Plans" value={data.plans.length} detail="Current workspace" tone="info" />
            <ReviewSurfaceMetric label="Ready" value={activePlans} detail="Waiting for review" tone="warning" />
            <ReviewSurfaceMetric label="Paper followed" value={followedPlans} detail="Journal-linked decisions" tone="good" />
            <ReviewSurfaceMetric label="Observed" value={reviewedPlans} detail="Outcome reflection recorded" />
          </ReviewMetricGrid>
        </AnimatedListItem>
        <AnimatedListItem as="section" style={motionRevealDensityStyle(3, "compact")}>
          <TradeAgentPlanBoard data={data} />
        </AnimatedListItem>
      </AnimatedSection>
    </AppShell>
  );
}
