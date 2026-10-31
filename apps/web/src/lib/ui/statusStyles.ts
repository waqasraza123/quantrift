export type StatusTone = "neutral" | "good" | "warning" | "danger" | "info";

export const statusToneClassName: Record<StatusTone, string> = {
  neutral: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
  good: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
  warning: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
  info: "border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]",
};

export const statusDotClassName: Record<StatusTone, string> = {
  neutral: "bg-[var(--text-muted)]",
  good: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  info: "bg-[var(--info)]",
};

export function toneForBias(value: string | null | undefined): StatusTone {
  const normalized = normalizeStatus(value);
  if (normalized === "bullish") {
    return "good";
  }
  if (normalized === "bearish") {
    return "danger";
  }
  if (normalized === "neutral" || normalized === "no_signal" || normalized === "no_directional_signal") {
    return "info";
  }
  return "neutral";
}

export function toneForConfidence(value: string | null | undefined): StatusTone {
  const normalized = normalizeStatus(value);
  if (["very_high", "high", "strong"].includes(normalized)) {
    return "good";
  }
  if (["medium", "moderate", "acceptable"].includes(normalized)) {
    return "info";
  }
  if (["low", "weak", "uncertain"].includes(normalized)) {
    return "warning";
  }
  if (["failed", "blocked"].includes(normalized)) {
    return "danger";
  }
  return "neutral";
}

export function toneForFreshness(value: string | null | undefined): StatusTone {
  const normalized = normalizeStatus(value);
  if (normalized === "fresh" || normalized === "current") {
    return "good";
  }
  if (normalized === "delayed" || normalized === "aging") {
    return "info";
  }
  if (normalized === "stale" || normalized === "missing_data" || normalized === "recovery_needed") {
    return "warning";
  }
  if (normalized === "failed" || normalized === "unavailable") {
    return "danger";
  }
  return "neutral";
}

export function toneForDataQuality(value: string | null | undefined): StatusTone {
  const normalized = normalizeStatus(value);
  if (["strong", "healthy", "ready", "passed", "valid"].includes(normalized)) {
    return "good";
  }
  if (["acceptable", "review_recommended", "partial", "mixed"].includes(normalized)) {
    return "info";
  }
  if (["weak", "stale", "degraded", "warning", "skipped"].includes(normalized)) {
    return "warning";
  }
  if (["unhealthy", "failed", "blocked", "critical"].includes(normalized)) {
    return "danger";
  }
  return "neutral";
}

export function toneForSetupQuality(value: string | null | undefined): StatusTone {
  return toneForDataQuality(value);
}

export function toneForPriority(value: string | null | undefined): StatusTone {
  const normalized = normalizeStatus(value);
  if (["critical", "urgent", "high"].includes(normalized)) {
    return "danger";
  }
  if (["medium", "review_recommended"].includes(normalized)) {
    return "warning";
  }
  if (["low", "routine"].includes(normalized)) {
    return "info";
  }
  return "neutral";
}

export function toneForOutcome(value: string | null | undefined): StatusTone {
  const normalized = normalizeStatus(value);
  if (["continuation", "partial_follow_through", "aligned", "aligned_with_observed_outcome"].includes(normalized)) {
    return "good";
  }
  if (["insufficient_data", "insufficient_future_data", "insufficient_outcome_data"].includes(normalized)) {
    return "info";
  }
  if (["no_follow_through", "mixed", "conflicted_with_observed_outcome"].includes(normalized)) {
    return "warning";
  }
  if (["reversal", "failed"].includes(normalized)) {
    return "danger";
  }
  return "neutral";
}

export function toneForReadiness(value: string | null | undefined): StatusTone {
  const normalized = normalizeStatus(value);
  if (normalized === "ready" || normalized === "passed") {
    return "good";
  }
  if (normalized === "needs_setup" || normalized === "degraded" || normalized === "warning") {
    return "warning";
  }
  if (normalized === "blocked" || normalized === "failed") {
    return "danger";
  }
  return "neutral";
}

export function toneForWorkerStatus(value: string | null | undefined): StatusTone {
  const normalized = normalizeStatus(value);
  if (["available", "running", "healthy", "completed"].includes(normalized)) {
    return "good";
  }
  if (["pending", "queued", "active"].includes(normalized)) {
    return "info";
  }
  if (["disabled", "deprecated", "stale", "completed_with_warnings"].includes(normalized)) {
    return "warning";
  }
  if (["unavailable", "failed"].includes(normalized)) {
    return "danger";
  }
  return "neutral";
}

export function normalizeStatus(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}
