import { ButtonLink } from "@/components/ui/Button";
import { DisclosurePanel } from "@/components/ui/DisclosurePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspaceStats } from "@/components/ui/WorkspaceStats";
import { formatDateTime } from "@/lib/formatting/dates";
import { humanizeLabel, shortIdentifier } from "@/lib/formatting/labels";
import { navigationHref } from "@/lib/ui/navigation";
import { toneForBias, toneForDataQuality, toneForOutcome, toneForPriority } from "@/lib/ui/statusStyles";
import { cn } from "@/lib/ui/cn";
import { motionCardClass, motionRevealPresetClass, motionRevealDensityStyle } from "@/lib/ui/motion";
import type {
  BriefActiveSetupItem,
  BriefAvoidConditionItem,
  BriefDataQualityIssue,
  BriefOutcomeUpdateItem,
  BriefPendingActionItem,
  BriefReviewNeededItem,
  BriefWatchNextItem,
  WorkspaceBrief,
} from "@/lib/brief/types";
import {
  BriefBadge,
  BriefEmptyBlock,
  BriefPanel,
} from "./BriefNarrativePrimitives";

export function BriefNarrative({ brief }: { brief: WorkspaceBrief }) {
  return (
    <div className="space-y-6">
      <BriefHero brief={brief} />
      {brief.backendUnavailable && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-[var(--muted)]">Some sources are unavailable. This brief includes only the research context that could be loaded.</p>}
      {!brief.workspace ? <BriefEmptyBlock title="Start with a workspace" message="Choose markets and add a data source to build your daily brief." /> : (
        <>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
            <div className="space-y-6"><WhatChangedSection brief={brief} /><ReviewFirstSection items={brief.activeSetups} /><OutcomeReadySection items={brief.outcomeUpdates} /></div>
            <aside className="space-y-6"><NeedsConfirmationSection items={brief.reviewNeeded} /><AvoidConditionsSection items={brief.avoidConditions} /><WatchNextSection items={brief.watchNext} /></aside>
          </div>
          <DisclosurePanel title="Market coverage & follow-ups" description="Freshness, data quality, and pending research tasks."><FreshSymbolsSection brief={brief} /><DataQualitySection items={brief.dataQualityIssues} workspaceId={brief.workspace.id} /><PendingActionsSection items={brief.pendingActions} /></DisclosurePanel>
        </>
      )}
    </div>
  );
}

function BriefHero({ brief }: { brief: WorkspaceBrief }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Your daily research" title="The market brief" description="What changed, which setups deserve a look, and what to keep on watch."
        meta={<span className="text-xs text-[var(--muted)]">Updated {formatDateTime(brief.generatedAt)}</span>}
        actions={<><ButtonLink href={navigationHref("commandCenter", brief.workspace?.id)} variant="quiet">Overview</ButtonLink><ButtonLink href={navigationHref("triage", brief.workspace?.id)}>Explore setups</ButtonLink></>} />
      <WorkspaceStats items={[
        { label: "Markets reviewed", value: brief.summary.totalSymbolsReviewed },
        { label: "Setups in focus", value: brief.summary.activeSetupCount },
        { label: "Needs a closer look", value: brief.summary.reviewRecommendedCount },
        { label: "Outcome updates", value: brief.summary.recentOutcomeUpdateCount },
      ]} />
    </div>
  );
}

function WhatChangedSection({ brief }: { brief: WorkspaceBrief }) {
  const items = [
    ...brief.digestSummaries.slice(0, 4).map((item) => ({
      id: `digest:${item.id}`,
      title: item.title,
      detail: item.summary,
      tone: toneForPriority(item.priority),
      href: item.signalId ? `/signals/${item.signalId}` : navigationHref("brief", brief.workspace?.id),
      label: humanizeLabel(item.itemType),
    })),
    ...brief.outcomeUpdates.slice(0, 2).map((item) => ({
      id: `outcome:${item.id}`,
      title: `${item.symbol} ${item.timeframe}`,
      detail: item.safeSummary,
      tone: toneForOutcome(item.outcomeLabel),
      href: `/signals/${item.signalId}`,
      label: item.observationLabel,
    })),
    ...brief.dataQualityIssues.slice(0, 2).map((item) => ({
      id: `data:${item.id}`,
      title: `${item.symbol}${item.timeframe ? ` ${item.timeframe}` : ""}`,
      detail: item.detail,
      tone: toneForDataQuality(item.severity),
      href: navigationHref("dataOnboarding", brief.workspace?.id),
      label: humanizeLabel(item.label),
    })),
  ].slice(0, 8);
  return (
    <BriefPanel title="What Changed" eyebrow="Digest" className={motionRevealPresetClass()} style={motionRevealDensityStyle(3)}>
      {items.length === 0 ? (
        <BriefEmptyBlock title="No brief generated" message="No backend brief items or fallback digest rows were returned for this workspace." />
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <a
              key={item.id}
              href={item.href}
              className={cn(
                "block rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/45",
                motionCardClass,
                motionRevealPresetClass(),
              )}
              style={motionRevealDensityStyle(index, "compact")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold text-[var(--strong)]">{item.title}</p>
                <BriefBadge tone={item.tone}>{item.label}</BriefBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
            </a>
          ))}
        </div>
      )}
    </BriefPanel>
  );
}

function FreshSymbolsSection({ brief }: { brief: WorkspaceBrief }) {
  const freshItems = brief.marketFocus.filter((item) => item.freshnessLabel === "fresh").slice(0, 8);
  return (
    <BriefPanel title="Fresh Symbols" eyebrow="Data fresh" className={motionRevealPresetClass()} style={motionRevealDensityStyle(4)}>
      {freshItems.length === 0 ? (
        <BriefEmptyBlock title="No fresh data" message="No fresh market-memory rows were returned for the current brief scope." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {freshItems.map((item, index) => (
            <a
              key={item.id}
              href={`/symbols/${item.symbolId}`}
              className={cn(
                "rounded-2xl border border-emerald-200 bg-emerald-50/65 p-4 transition hover:bg-white dark:border-emerald-900 dark:bg-emerald-950/25",
                motionCardClass,
                motionRevealPresetClass(),
              )}
              style={motionRevealDensityStyle(index, "compact")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--strong)]">{item.symbol}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.timeframe}</p>
                </div>
                <BriefBadge tone={toneForBias(item.latestBias)}>{item.latestBias}</BriefBadge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <BriefBadge tone={toneForDataQuality(item.confidenceLabel)}>{item.confidenceLabel}</BriefBadge>
                <BriefBadge tone={toneForDataQuality(item.dataQualityLabel)}>{item.dataQualityLabel}</BriefBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.topWarning}</p>
            </a>
          ))}
        </div>
      )}
    </BriefPanel>
  );
}

function ReviewFirstSection({ items }: { items: BriefActiveSetupItem[] }) {
  return (
    <BriefPanel title="Review-First Setups" eyebrow="Setup context" className={motionRevealPresetClass()} style={motionRevealDensityStyle(5)}>
      {items.length === 0 ? (
        <BriefEmptyBlock title="No setups" message="No directional setup context was available in the current brief." />
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item, index) => (
            <a
              key={item.signalId}
              href={item.reviewLink}
              className={cn(
                "block rounded-2xl border border-slate-200 bg-white/70 p-4 transition hover:bg-teal-50/70 dark:border-slate-800 dark:bg-slate-950/45 dark:hover:bg-teal-950/20",
                motionCardClass,
                motionRevealPresetClass(),
              )}
              style={motionRevealDensityStyle(index, "compact")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--strong)]">{item.symbol} {item.timeframe}</p>
                  <p className="mt-1 text-sm text-slate-500">{humanizeLabel(item.patternType)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BriefBadge tone={toneForBias(item.bias)}>{item.bias}</BriefBadge>
                  <BriefBadge tone={toneForDataQuality(item.setupQualityLabel)}>{item.setupQualityLabel}</BriefBadge>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {item.keyEvidence.slice(0, 3).map((evidence) => (
                  <p key={evidence} className="text-sm leading-6 text-slate-600 dark:text-slate-300">{evidence}</p>
                ))}
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <BriefDetail label="Invalidation context" value={item.invalidationContext || "Not available"} />
                <BriefDetail label="Observation context" value={item.waitCondition || "Review first"} />
              </div>
            </a>
          ))}
        </div>
      )}
    </BriefPanel>
  );
}

function NeedsConfirmationSection({ items }: { items: BriefReviewNeededItem[] }) {
  return (
    <BriefPanel title="Needs Confirmation" eyebrow="Review queue" className={motionRevealPresetClass()} style={motionRevealDensityStyle(6)}>
      {items.length === 0 ? (
        <BriefEmptyBlock title="No confirmation items" message="No open review or readiness confirmation items were returned." />
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item, index) => (
            <a
              key={item.id}
              href={item.signalId ? `/signals/${item.signalId}` : "#"}
              className={cn(
                "block rounded-2xl border border-amber-200 bg-amber-50/65 p-4 dark:border-amber-900 dark:bg-amber-950/25",
                motionCardClass,
                motionRevealPresetClass(),
              )}
              style={motionRevealDensityStyle(index, "compact")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold text-[var(--strong)]">{item.label}</p>
                <BriefBadge tone={toneForPriority(item.priority)}>{humanizeLabel(item.priority)}</BriefBadge>
              </div>
              <p className="mt-2 text-sm text-slate-500">{item.source}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.reason}</p>
            </a>
          ))}
        </div>
      )}
    </BriefPanel>
  );
}

function AvoidConditionsSection({ items }: { items: BriefAvoidConditionItem[] }) {
  return (
    <BriefPanel title="Avoid Conditions" eyebrow="Constraints" className={motionRevealPresetClass()} style={motionRevealDensityStyle(7)}>
      {items.length === 0 ? (
        <BriefEmptyBlock title="No avoid conditions" message="No stale, conflicting, low-quality, or unresolved review constraints were returned." />
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item, index) => (
            <a
              key={item.id}
              href={item.signalId ? `/signals/${item.signalId}` : "#"}
              className={cn(
                "block rounded-2xl border border-slate-200 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-900/50",
                motionCardClass,
                motionRevealPresetClass(),
              )}
              style={motionRevealDensityStyle(index, "compact")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--strong)]">{item.condition}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.symbol}{item.timeframe ? ` ${item.timeframe}` : ""}</p>
                </div>
                <BriefBadge tone={toneForPriority(item.severity)}>{humanizeLabel(item.severity)}</BriefBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.reason}</p>
            </a>
          ))}
        </div>
      )}
    </BriefPanel>
  );
}

function OutcomeReadySection({ items }: { items: BriefOutcomeUpdateItem[] }) {
  return (
    <BriefPanel title="Outcomes Ready" eyebrow="Observed behavior" className={motionRevealPresetClass()} style={motionRevealDensityStyle(8)}>
      {items.length === 0 ? (
        <BriefEmptyBlock title="No outcomes ready" message="No recent observed outcome horizons were returned for the current brief." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.slice(0, 8).map((item, index) => (
            <a
              key={item.id}
              href={`/signals/${item.signalId}`}
              className={cn(
                "rounded-2xl border border-sky-200 bg-sky-50/65 p-4 transition hover:bg-white dark:border-sky-900 dark:bg-sky-950/25",
                motionCardClass,
                motionRevealPresetClass(),
              )}
              style={motionRevealDensityStyle(index, "compact")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--strong)]">{item.symbol} {item.timeframe}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.horizon}</p>
                </div>
                <BriefBadge tone={toneForOutcome(item.outcomeLabel)}>{item.observationLabel}</BriefBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.safeSummary}</p>
            </a>
          ))}
        </div>
      )}
    </BriefPanel>
  );
}

function WatchNextSection({ items }: { items: BriefWatchNextItem[] }) {
  return (
    <BriefPanel title="Watch Next" eyebrow="Observation zones" className={motionRevealPresetClass()} style={motionRevealDensityStyle(9)}>
      {items.length === 0 ? (
        <BriefEmptyBlock title="No watch-next rows" message="Setup context did not return next observations or observation zones." />
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item, index) => (
            <a
              key={item.id}
              href={item.signalId ? `/signals/${item.signalId}` : "#"}
              className={cn(
                "block rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/45",
                motionCardClass,
                motionRevealPresetClass(),
              )}
              style={motionRevealDensityStyle(index, "compact")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold text-[var(--strong)]">{item.symbol} {item.timeframe}</p>
                <BriefBadge tone="info">Observation zone</BriefBadge>
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--strong)]">{item.observation}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.reason}</p>
            </a>
          ))}
        </div>
      )}
    </BriefPanel>
  );
}

function PendingActionsSection({ items }: { items: BriefPendingActionItem[] }) {
  return (
    <BriefPanel
      title="Pending Backend-Safe Actions"
      eyebrow="Follow-up"
      className={motionRevealPresetClass()}
      style={motionRevealDensityStyle(10)}
    >
      {items.length === 0 ? (
        <BriefEmptyBlock title="No pending actions" message="No due backend-safe action items were returned." />
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "rounded-2xl border border-slate-200 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-900/50",
                motionCardClass,
                motionRevealPresetClass(),
              )}
              style={motionRevealDensityStyle(index, "compact")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold text-[var(--strong)]">{item.safeLabel}</p>
                <BriefBadge tone={toneForDataQuality(item.status)}>{humanizeLabel(item.status)}</BriefBadge>
              </div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <BriefDetail label="Source" value={item.source} />
                <BriefDetail label="Due" value={formatDateTime(item.dueTime)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </BriefPanel>
  );
}

function DataQualitySection({ items, workspaceId }: { items: BriefDataQualityIssue[]; workspaceId: string | null }) {
  return (
    <BriefPanel
      title="Data Quality and Recovery Context"
      eyebrow="Reliability"
      className={motionRevealPresetClass()}
      style={motionRevealDensityStyle(11)}
    >
      {items.length === 0 ? (
        <BriefEmptyBlock title="No data-quality issues" message="No freshness, gap, provider, or setup-quality issues were returned." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.slice(0, 9).map((item, index) => (
            <a
              key={item.id}
              href={navigationHref("dataOnboarding", workspaceId)}
              className={cn(
                "rounded-2xl border border-slate-200 bg-slate-50/75 p-4 transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/50",
                motionCardClass,
                motionRevealPresetClass(),
              )}
              style={motionRevealDensityStyle(index, "compact")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--strong)]">{humanizeLabel(item.label)}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.symbol}{item.timeframe ? ` ${item.timeframe}` : ""}</p>
                </div>
                <BriefBadge tone={toneForDataQuality(item.severity)}>{humanizeLabel(item.severity)}</BriefBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
            </a>
          ))}
        </div>
      )}
    </BriefPanel>
  );
}

function BriefDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-[var(--strong)]">{value}</dd>
    </div>
  );
}

function periodLabel(brief: WorkspaceBrief): string {
  if (brief.periodStart && brief.periodEnd) {
    return `${formatDateTime(brief.periodStart)} to ${formatDateTime(brief.periodEnd)}${brief.timezone ? ` ${brief.timezone}` : ""}`;
  }
  return `Generated ${formatDateTime(brief.generatedAt)}`;
}
