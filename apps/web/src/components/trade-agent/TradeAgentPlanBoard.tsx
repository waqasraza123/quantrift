import Link from "next/link";

import { EmptyState } from "@/components/empty-states/empty-state";
import { Badge, toneForQuality } from "@/components/status/badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/formatting/dates";
import { setupLabel, setupRecordText, sanitizeSetupText } from "@/lib/setup-detail/labels";
import type { JsonRecord } from "@/lib/api/types";
import type { TradeAgentData, TradeAgentPlan } from "@/lib/api/tradeAgent";
import { AnimatedListItem, motionRevealDensityStyle } from "@/lib/ui/motion";

type TradeAgentPlanBoardProps = {
  data: TradeAgentData;
};

export function TradeAgentPlanBoard({ data }: TradeAgentPlanBoardProps) {
  if (!data.workspace) {
    return <EmptyState title="No workspace available" message="Create or seed a workspace before paper plans can load." />;
  }
  const missing = data.failures.find((failure) => failure.label === "Paper plans" && failure.missing);
  if (missing) {
    return (
      <EmptyState
        title="Paper planning API unavailable"
        message="The backend trade-agent endpoints are not available in this environment yet."
      />
    );
  }
  if (data.plans.length === 0) {
    return (
      <EmptyState
        title="No paper plans"
        message="Open a setup from triage and create a paper-only plan when the backend has enough context."
      />
    );
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {data.plans.map((plan, index) => (
        <AnimatedListItem as="article" key={plan.id} style={motionRevealDensityStyle(index, "compact")}>
          <TradeAgentPlanCard plan={plan} />
        </AnimatedListItem>
      ))}
    </div>
  );
}

function TradeAgentPlanCard({ plan }: { plan: TradeAgentPlan }) {
  return (
    <div className="surface rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Paper plan</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--strong)]">{setupLabel(plan.directional_bias)} review</h2>
        </div>
        <ButtonLink href={`/signals/${plan.signal_id}`} size="sm" variant="quiet">
          Open setup
        </ButtonLink>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge value={setupLabel(plan.status)} tone={toneForQuality(plan.status)} />
        <Badge value={setupLabel(plan.readiness_label || "readiness not assessed")} tone={toneForQuality(plan.readiness_label || "")} />
        <Badge value={plan.safety_json.brokerExecution === false ? "Paper only" : "Review required"} tone="info" />
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{sanitizeSetupText(plan.summary)}</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <MiniList title="Blockers" items={plan.blocker_json} />
        <MiniList title="Warnings" items={plan.warning_json} />
        <MiniList title="Evidence" items={plan.supporting_evidence_json} />
        <MiniList title="Outcomes" items={plan.outcome_context_json} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>Created {formatDateTime(plan.created_at)}</span>
        <Link className="font-semibold text-[var(--info)]" href={`/journal?workspaceId=${plan.workspace_id}&signalId=${plan.signal_id}`}>
          Journal context
        </Link>
      </div>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: JsonRecord[] }) {
  return (
    <div className="muted-surface rounded-lg p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">None returned.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.slice(0, 3).map((item, index) => (
            <p key={`${title}-${index}`} className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              {setupRecordText(item)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
