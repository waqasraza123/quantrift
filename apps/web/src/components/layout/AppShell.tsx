import { StarterContentGate } from "@/components/onboarding/StarterContentGate";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getPublicEnv } from "@/config/env";
import { getCurrentIdentity } from "@/lib/api/auth";
import { PageContainer } from "./PageContainer";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type AppShellProps = {
  appName: string;
  children: ReactNode;
  workspaceName?: string | null;
  workspaceId?: string | null;
};

export async function AppShell({ appName, children, workspaceName, workspaceId }: AppShellProps) {
  const env = getPublicEnv();
  if (env.authMode === "session") {
    const identity = await getCurrentIdentity();
    if (!identity.ok || !identity.data.authenticated) {
      redirect("/login");
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)]">
      <div className="sticky inset-x-0 top-0 z-40 lg:hidden">
        <MobileNav appName={appName} workspaceId={workspaceId} workspaceName={workspaceName} apiBaseUrl={env.apiBaseUrl} />
      </div>
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-60">
        <Sidebar appName={appName} workspaceId={workspaceId} workspaceName={workspaceName} />
      </div>
      <div className="min-h-screen lg:pl-60">
        <Topbar apiBaseUrl={env.apiBaseUrl} workspaceId={workspaceId} workspaceName={workspaceName} />
        <PageContainer><StarterContentGate workspaceId={workspaceId}>{children}</StarterContentGate></PageContainer>
      </div>
    </div>
  );
}
