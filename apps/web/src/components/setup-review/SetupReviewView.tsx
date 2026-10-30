import { SetupEmptySection } from "@/components/setup-detail/SetupEmptySection";
import { SetupErrorSection } from "@/components/setup-detail/SetupErrorSection";
import { SetupVisualPanel } from "@/components/setup-detail/SetupVisualPanel";
import { ButtonLink } from "@/components/ui/Button";
import { DisclosurePanel } from "@/components/ui/DisclosurePanel";
import { composeSetupReview } from "@/lib/setup-review/composeSetupReview";
import type { SetupDetailData } from "@/lib/setup-detail/types";
import { navigationHref } from "@/lib/ui/navigation";
import { SetupAuditReviewPanel } from "./SetupAuditReviewPanel";
import { SetupContextReviewPanel } from "./SetupContextReviewPanel";
import { SetupEvidenceReviewPanel } from "./SetupEvidenceReviewPanel";
import { SetupHistoricalReviewPanel } from "./SetupHistoricalReviewPanel";
import { SetupIntelligenceContextPanel } from "./SetupIntelligenceContextPanel";
import { SetupJournalReviewPanel } from "./SetupJournalReviewPanel";
import { SetupPaperPlanPanel } from "./SetupPaperPlanPanel";
import { SetupReasoningReviewPanel } from "./SetupReasoningReviewPanel";
import { SetupReviewHeader } from "./SetupReviewHeader";
import { SetupWaitAvoidReviewPanel } from "./SetupWaitAvoidReviewPanel";

export function SetupReviewView({ data }: { data: SetupDetailData }) {
  const model = composeSetupReview(data);
  const signal = model.signal?.signal || null;
  const workspaceId = signal?.workspace_id || model.setupContext?.workspace_id || model.report?.workspace_id || null;
  if (!model.signal && !model.report && !model.setupContext) {
    return <div className="space-y-5"><ButtonLink href={navigationHref("triage", workspaceId)} variant="quiet">← Back to setups</ButtonLink><SetupEmptySection title="Setup not available" message="This setup could not be loaded. Return to your setup list or check the connection details." /><SetupErrorSection failures={model.failures} /></div>;
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><ButtonLink href={navigationHref("triage", workspaceId)} variant="quiet" size="sm">← All setups</ButtonLink><a href="#journal" className="text-xs font-medium text-[var(--accent-strong)]">Add a research note ↓</a></div>
      <SetupReviewHeader model={model} />
      {model.failures.some((failure) => !failure.missing) && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-[var(--muted)]">Some supporting context could not be loaded. Check data availability below before relying on this setup.</p>}
      <SetupVisualPanel model={model} />
      <div className="grid items-start gap-6 xl:grid-cols-2"><SetupContextReviewPanel model={model} /><SetupEvidenceReviewPanel model={model} /></div>
      <SetupWaitAvoidReviewPanel model={model} />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <SetupJournalReviewPanel workspaceId={workspaceId} signalId={data.signalId} model={model} />
        <SetupPaperPlanPanel workspaceId={workspaceId} signalId={data.signalId} model={model} />
      </div>
      <DisclosurePanel title="More market context" description="Historical cases, related markets, timeframe agreement, and prior reasoning.">
        <SetupHistoricalReviewPanel model={model} />
        <SetupIntelligenceContextPanel model={model} />
        <SetupReasoningReviewPanel model={model} />
      </DisclosurePanel>
      <DisclosurePanel title="Data availability & audit trail" description="Source events, missing context, and the setup’s analysis history.">
        <SetupErrorSection failures={model.failures} />
        <SetupAuditReviewPanel model={model} />
      </DisclosurePanel>
    </div>
  );
}
