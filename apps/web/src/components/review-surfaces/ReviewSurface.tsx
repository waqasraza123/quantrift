import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

type SurfaceTone = "neutral" | "good" | "warning" | "danger" | "info";

type SurfaceHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

type SurfacePanelProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

type SurfaceMetricProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: SurfaceTone;
};

type SurfaceEmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

const toneClassName: Record<SurfaceTone, string> = {
  neutral: "border-[var(--line)] bg-[var(--panel-muted)] text-slate-600 dark:text-slate-300",
  good: "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
  danger: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100",
};

export function ReviewSurfaceHero({ eyebrow, title, description, actions, meta }: SurfaceHeroProps) {
  return (
    <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} meta={meta} />
  );
}

export function ReviewSurfacePanel({
  eyebrow,
  title,
  description,
  action,
  children,
  className = "",
}: SurfacePanelProps) {
  return (
    <section className={`surface rounded-lg p-5 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>}
          <h2 className="mt-1 text-lg font-semibold text-[var(--strong)]">{title}</h2>
          {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center justify-end gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function ReviewMetricGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-4 ${className}`}>{children}</div>;
}

export function ReviewSurfaceMetric({ label, value, detail, tone = "neutral" }: SurfaceMetricProps) {
  return (
    <div className={`rounded-lg border p-4 ${toneClassName[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--strong)]">{value}</p>
      {detail && <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>}
    </div>
  );
}

export function ReviewSurfaceEmptyState({ title, message, action }: SurfaceEmptyStateProps) {
  return (
    <div className="muted-surface rounded-lg p-6">
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empty state</p>
        <h3 className="mt-2 text-lg font-semibold text-[var(--strong)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export function ReviewFilterShell({
  action,
  children,
  className = "",
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`surface rounded-lg p-4 ${className}`}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">{children}</div>
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function ReviewField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function reviewInputClassName(className = "") {
  return `min-h-10 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--strong)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] ${className}`;
}

export function ReviewTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function ReviewFact({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="muted-surface rounded-lg p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-[var(--strong)]">{value}</div>
      {detail && <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>}
    </div>
  );
}
