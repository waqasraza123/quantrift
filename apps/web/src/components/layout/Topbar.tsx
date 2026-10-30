import { AuthStatus } from "@/components/auth/AuthStatus";
import { ApiStatusIndicator } from "./ApiStatusIndicator";

export function Topbar({ apiBaseUrl, workspaceName }: {
  apiBaseUrl: string; workspaceName?: string | null; workspaceId?: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 hidden h-[72px] items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-8 lg:flex">
      <p className="text-sm text-[var(--muted)]">Your workspace <span className="mx-2 opacity-40">/</span><span className="font-medium text-[var(--strong)]">{workspaceName || "Market research"}</span></p>
      <div className="flex items-center gap-4"><ApiStatusIndicator apiBaseUrl={apiBaseUrl} /><AuthStatus /></div>
    </header>
  );
}
