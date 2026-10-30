import Link from "next/link";
import { cn } from "@/lib/ui/cn";
import { navigationHref, navigationItems, type NavigationTarget } from "@/lib/ui/navigation";

export type WorkflowTarget = NavigationTarget;

export const workflowTargets: Record<WorkflowTarget, { href: string; label: string }> = {
  ...(Object.fromEntries(navigationItems.map((item) => [item.key, { href: item.href, label: item.label }])) as Record<NavigationTarget, { href: string; label: string }>),
};

export const primaryWorkflowTargets: WorkflowTarget[] = ["commandCenter", "triage", "scanner", "journal"];

export function WorkflowLinks({ workspaceId, targets = primaryWorkflowTargets, className = "" }: {
  workspaceId?: string | null; targets?: WorkflowTarget[]; className?: string;
}) {
  const visible = targets.slice(0, 3);
  const remaining = targets.slice(3);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {visible.map((target) => <Link key={target} href={workflowHref(target, workspaceId)} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)]">{workflowTargets[target].label}</Link>)}
      {remaining.length > 0 && <details className="relative"><summary className="cursor-pointer list-none rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium text-[var(--muted)] [&::-webkit-details-marker]:hidden">More ▾</summary><div className="absolute right-0 top-full z-30 mt-2 grid min-w-44 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-lg">{remaining.map((target) => <Link key={target} href={workflowHref(target, workspaceId)} className="whitespace-nowrap rounded-lg px-3 py-2 text-xs hover:bg-[var(--surface-muted)]">{workflowTargets[target].label}</Link>)}</div></details>}
    </div>
  );
}

export function workflowHref(target: WorkflowTarget, workspaceId?: string | null): string {
  return navigationHref(target, workspaceId);
}
