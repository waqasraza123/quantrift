import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-5 py-1 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-[var(--strong)] sm:text-[34px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        {meta && <div className="mt-3 flex flex-wrap gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
