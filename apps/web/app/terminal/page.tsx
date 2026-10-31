import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicEnv } from "@/config/env";
import { getCurrentIdentity } from "@/lib/api/auth";
import { listWorkspaces, listSymbols } from "@/lib/api/market";
import { TerminalWorkspace } from "@/components/terminal/TerminalWorkspace";
import "./terminal.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research terminal",
  robots: { index: false, follow: false },
};

export default async function TerminalPage() {
  const sessionMode = getPublicEnv().authMode === "session";
  const identity = sessionMode ? await getCurrentIdentity() : null;
  if (sessionMode && identity && !identity.ok && identity.error.status === 401)
    redirect("/login?next=%2Fterminal");
  if (sessionMode && identity?.ok && !identity.data.authenticated)
    redirect("/login?next=%2Fterminal");
  if (sessionMode && identity && !identity.ok)
    return (
      <main className="qt-bootstrap-error">
        <h1>Research terminal unavailable</h1>
        <p>Your session could not be verified. Please reload to reconnect.</p>
        <a href="/terminal">Try again</a>
      </main>
    );
  const [workspaces, symbols] = await Promise.all([
    listWorkspaces(),
    listSymbols(),
  ]);
  if (!workspaces.ok && workspaces.error.status === 401)
    redirect("/login?next=%2Fterminal");
  return (
    <TerminalWorkspace
      workspaces={workspaces.ok ? workspaces.data : []}
      symbols={symbols.ok ? symbols.data : []}
      userId={identity?.ok ? identity.data.user?.id || "local" : "local"}
      initialError={
        !workspaces.ok
          ? workspaces.error.message
          : !symbols.ok
            ? symbols.error.message
            : null
      }
    />
  );
}
