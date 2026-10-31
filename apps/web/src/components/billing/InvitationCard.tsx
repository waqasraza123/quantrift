"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getCurrentIdentity, type CurrentIdentity } from "@/lib/api/auth";
import { acceptInvitation, switchWorkspace } from "@/lib/api/billing";
import { authModeHref } from "@/lib/auth/redirects";
import { writeSelectedWorkspaceId } from "@/lib/workspace/selectedWorkspace";

const invitationStorageKey = "quantrift:pending-invitation";

export function InvitationCard() {
  const [token, setToken] = useState("");
  const [identity, setIdentity] = useState<CurrentIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const fromLink = new URLSearchParams(window.location.hash.slice(1)).get("token");
    let pending = fromLink || "";
    try {
      if (fromLink) { sessionStorage.setItem(invitationStorageKey, fromLink); window.history.replaceState(null, "", "/invite"); }
      else pending = sessionStorage.getItem(invitationStorageKey) || "";
    } catch { pending = fromLink || ""; }
    setToken(pending);
    void getCurrentIdentity().then((result) => {
      if (!active) return;
      if (result.ok && result.data.authenticated) setIdentity(result.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function accept() {
    if (busy || !token) return;
    setBusy(true); setError("");
    const result = await acceptInvitation(token);
    if (!result.ok) { setError(result.error.message); setBusy(false); return; }
    const switched = await switchWorkspace(result.data.workspace_id);
    if (!switched.ok) { setError(switched.error.message); setBusy(false); return; }
    try { sessionStorage.removeItem(invitationStorageKey); } catch { setToken(""); }
    writeSelectedWorkspaceId(result.data.workspace_id);
    window.location.assign(`/command-center?workspaceId=${encodeURIComponent(result.data.workspace_id)}`);
  }

  return <section className="pricing-card mx-auto my-16 max-w-lg" aria-labelledby="invitation-title"><h1 id="invitation-title" className="text-3xl font-bold">Join your team’s workspace.</h1><p className="mt-5 text-sm leading-7 text-[var(--brand-muted)]">Accept your invitation with the email address it was sent to. Your own workspace and research stay with you.</p>{loading ? <p role="status" className="mt-6">Checking your account…</p> : <>{!token && <p role="alert" className="mt-6 text-sm">Open the original invitation email to continue. The invitation link may be missing or expired.</p>}{identity ? <div className="mt-6 space-y-4"><p className="break-all text-sm">Signed in as {identity.user?.email}</p><Button variant="primary" disabled={!token} loading={busy} onClick={() => void accept()}>Accept invitation</Button><p className="text-xs text-[var(--brand-muted)]">If this is the wrong account, sign out from your account page and reopen the invitation.</p></div> : <div className="mt-6 flex flex-wrap gap-3"><Link className="marketing-button" href={authModeHref("login", "/invite")}>Sign in to continue</Link><Link className="marketing-text-link" href={authModeHref("register", "/invite")}>Create an account →</Link></div>}</>}{error && <p role="alert" className="mt-5 text-sm text-[var(--brand-danger)]">{error}</p>}</section>;
}
