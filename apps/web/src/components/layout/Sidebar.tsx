"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { ProductIcon, type ProductIconName } from "@/components/ui/ProductIcon";
import { cn } from "@/lib/ui/cn";
import {
  isActiveNavigationPath, navigationHref, navigationItems,
  primaryNavigationTargets, secondaryNavigationTargets, type NavigationTarget,
} from "@/lib/ui/navigation";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const icons: Partial<Record<NavigationTarget, ProductIconName>> = {
  terminal: "chart", commandCenter: "overview", dashboard: "chart", triage: "setups", scanner: "scanner", journal: "journal",
};

export function Sidebar({ appName, workspaceName, workspaceId }: {
  appName: string; workspaceName?: string | null; workspaceId?: string | null;
}) {
  const pathname = usePathname();
  const toolsActive = secondaryNavigationTargets.some((key) => {
    const item = navigationItems.find((candidate) => candidate.key === key);
    return item ? isActiveNavigationPath(pathname, item.href) : false;
  });

  function navigationLink(key: NavigationTarget) {
    const item = navigationItems.find((candidate) => candidate.key === key);
    if (!item) return null;
    const active = isActiveNavigationPath(pathname, item.href);
    return (
      <Link key={key} href={navigationHref(key, workspaceId)} aria-current={active ? "page" : undefined}
        className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", active ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--strong)]")}>
        <ProductIcon name={icons[key] || "layers"} className="h-[18px] w-[18px] shrink-0" />
        <span>{item.label}</span>
        {active && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />}
      </Link>
    );
  }

  return (
    <aside className="flex h-full flex-col border-r border-[var(--line)] bg-[var(--surface)] px-4 py-6">
      <Link href={navigationHref("terminal", workspaceId)} className="flex items-center gap-2.5 px-3 text-xl font-semibold tracking-tight text-[var(--strong)]">
        <BrandMark className="h-8 w-8 text-[var(--accent-strong)]" />{appName}
      </Link>
      <div className="mt-8"><WorkspaceSwitcher workspaceId={workspaceId} workspaceName={workspaceName} /></div>
      <nav aria-label="Main navigation" className="mt-7 flex-1 space-y-1 overflow-y-auto">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Workspace</p>
        {primaryNavigationTargets.map(navigationLink)}
        <details key={pathname} open={toolsActive} className="group mt-7 border-t border-[var(--line)] pt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)] [&::-webkit-details-marker]:hidden">
            <ProductIcon name="settings" className="h-[18px] w-[18px]" />Research & tools
            <span aria-hidden="true" className="ml-auto transition-transform group-open:rotate-90"><ProductIcon name="chevron" className="h-3 w-3" /></span>
          </summary>
          <div className="mt-1 space-y-1">{secondaryNavigationTargets.map(navigationLink)}</div>
        </details>
      </nav>
      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--strong)]"><ProductIcon name="sparkles" className="h-4 w-4 text-[var(--accent)]" />A second perspective</div>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Open a setup chart to request an AI assessment and review its reasoning.</p>
        <Link href={navigationHref("triage", workspaceId)} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent-strong)]">Browse setups <ProductIcon name="arrow" className="h-3.5 w-3.5" /></Link>
      </div>
      <Link href="/" className="mt-5 px-3 text-xs text-[var(--muted)] hover:text-[var(--strong)]">About {appName} ↗</Link>
    </aside>
  );
}
