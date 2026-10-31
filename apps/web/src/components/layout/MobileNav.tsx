"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { cn } from "@/lib/ui/cn";
import { isActiveNavigationPath, navigationHref, navigationItems, primaryNavigationTargets, secondaryNavigationTargets } from "@/lib/ui/navigation";

export function MobileNav({ appName, workspaceName, workspaceId }: {
  appName: string; apiBaseUrl: string; workspaceName?: string | null; workspaceId?: string | null;
}) {
  const pathname = usePathname();
  return (
    <header className="border-b border-[var(--line)] bg-[var(--surface)] px-4 pt-3">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <Link href={navigationHref("terminal", workspaceId)} className="flex items-center gap-2 font-semibold tracking-tight text-[var(--strong)]"><BrandMark className="h-7 w-7 text-[var(--accent-strong)]" />{appName}</Link>
        <AuthStatus />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] text-[var(--muted)]">{workspaceName || "Your workspace"}</p>
        <details key={pathname} className="group relative">
          <summary className="cursor-pointer list-none py-2 text-xs font-medium text-[var(--muted)] [&::-webkit-details-marker]:hidden">More ▾</summary>
          <nav aria-label="More navigation" className="absolute right-0 top-full z-50 grid max-h-[60vh] w-56 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-lg">
            <div className="mb-2 border-b border-[var(--line)] pb-2"><WorkspaceSwitcher workspaceId={workspaceId} workspaceName={workspaceName} /></div>
            {secondaryNavigationTargets.map((key) => {
              const item = navigationItems.find((candidate) => candidate.key === key);
              return item && <Link key={key} href={navigationHref(key, workspaceId)} className="rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--surface-muted)]">{item.label}</Link>;
            })}
          </nav>
        </details>
      </div>
      <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto">
        {primaryNavigationTargets.map((key) => {
          const item = navigationItems.find((candidate) => candidate.key === key);
          if (!item) return null;
          const active = isActiveNavigationPath(pathname, item.href);
          return <Link key={key} href={navigationHref(key, workspaceId)} aria-current={active ? "page" : undefined} className={cn("shrink-0 border-b-2 px-3 py-3 text-xs font-semibold", active ? "border-[var(--accent)] text-[var(--accent-strong)]" : "border-transparent text-[var(--muted)]")}>{item.label}</Link>;
        })}
      </nav>
    </header>
  );
}
