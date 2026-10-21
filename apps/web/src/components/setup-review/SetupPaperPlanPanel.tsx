import { ButtonLink } from "@/components/ui/Button";
import { Badge, toneForQuality } from "@/components/status/badge";
import { formatDateTime } from "@/lib/formatting/dates";
import { setupLabel, setupRecordText, sanitizeSetupText } from "@/lib/setup-detail/labels";
import type { SetupReviewModel } from "@/lib/setup-review/types";
import type { JsonRecord } from "@/lib/api/types";
import { AnimatedListItem, motionRevealDensityStyle } from "@/lib/ui/motion";
import { SetupReviewCard, SetupReviewEmpty, SetupReviewSection } from "./SetupReviewSection";

type SetupPaperPlanPanelProps = {
  model: SetupReviewModel;
  workspaceId: string | null;
  signalId: string;
};

export function SetupPaperPlanPanel({ model, workspaceId, signalId }: SetupPaperPlanPanelProps) {
  const plan = model.tradeAgentPlan;
  const action = workspaceId ? (
    <ButtonLink href={`/trade-agent?workspaceId=${workspaceId}&signalId=${signalId}`} size="sm" variant="quiet">
      Open queue
    </ButtonLink>
  ) : null;

  return (
    <SetupReviewSection eyebrow="Paper plan" title="QuantRift agent review" action={action}>
      {!plan ? (
        <SetupReviewEmpty
          title="No paper plan yet"
          message="Create a paper-only plan from this setup when the backend trade-agent endpoint is available."
        />
      ) : (
        <div className="space-y-4">
          <SetupReviewCard>
            <div className="flex flex-wrap gap-2">
              <Badge value={setupLabel(plan.status)} tone={toneForQuality(plan.status)} />
              <Badge value={setupLabel(plan.directional_bias)} tone="info" />
              <Badge value={setupLabel(plan.readiness_label || "readiness not assessed")} tone={toneForQuality(plan.readiness_label || "")} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{sanitizeSetupText(plan.thesis)}</p>
            <p className="mt-2 text-xs text-slate-500">Updated {formatDateTime(plan.updated_at)}</p>
          </SetupReviewCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <PlanList title="Supporting evidence" items={plan.supporting_evidence_json} empty="No evidence copied into the plan." />
            <PlanList title="Risk notes" items={plan.risk_notes_json} empty="No risk notes copied into the plan." />
            <PlanList title="Invalidation context" items={plan.invalidation_context_json} empty="No invalidation context returned." />
            <PlanList title="Outcome follow-up" items={plan.outcome_context_json} empty="No stored outcomes linked yet." />
          </div>
        </div>
      )}
    </SetupReviewSection>
  );
}

function PlanList({ title, items, empty }: { title: string; items: JsonRecord[]; empty: string }) {
  return (
    <SetupReviewCard>
      <p className="text-sm font-semibold text-[var(--strong)]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-slate-500">{empty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.slice(0, 4).map((item, index) => (
            <AnimatedListItem
              as="p"
              key={`${title}-${index}`}
              style={motionRevealDensityStyle(index, "compact")}
              className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
            >
              {setupRecordText(item)}
            </AnimatedListItem>
          ))}
        </div>
      )}
    </SetupReviewCard>
  );
}
