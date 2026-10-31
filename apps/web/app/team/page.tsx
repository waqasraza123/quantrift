import type { Metadata } from "next";
import { TeamPanel } from "@/components/billing/TeamPanel";
import { AppShell } from "@/components/layout/AppShell";
import { getAccountData } from "@/lib/api/accountServer";

export const metadata: Metadata = { title: "Team", robots: { index: false, follow: false } };

export default async function TeamPage() {
  const data = await getAccountData();
  const workspace = data.authContext?.identity.workspace;
  return <AppShell appName={data.appName} workspaceId={workspace?.id} workspaceName={workspace?.name}><div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Your workspace</p><h1 className="mt-2 text-3xl font-bold">Team & invitations</h1></div>{workspace ? <TeamPanel key={workspace.id} workspaceId={workspace.id} /> : <p role="alert">Sign in to view your workspace team.</p>}</div></AppShell>;
}
