"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { getWorkspaceTeam, inviteTeammate, removeTeammate, revokeInvitation, type WorkspaceTeam } from "@/lib/api/billing";

export function TeamPanel({ workspaceId }: { workspaceId: string }) {
  const [team, setTeam] = useState<WorkspaceTeam | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await getWorkspaceTeam(workspaceId);
    if (result.ok) setTeam(result.data);
    else setError(result.error.message);
  }, [workspaceId]);
  useEffect(() => { void load(); }, [load]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    const result = await inviteTeammate(workspaceId, email.trim());
    if (result.ok) { setEmail(""); setMessage("Invitation sent. The seat is reserved for seven days."); await load(); }
    else setError(result.error.message);
    setBusy(false);
  }

  async function remove(id: string, invitation: boolean) {
    if (busy || !window.confirm(invitation ? "Revoke this invitation?" : "Remove this member’s access to this workspace? Their research will be preserved.")) return;
    setBusy(true); setError(""); setMessage("");
    const result = invitation ? await revokeInvitation(workspaceId, id) : await removeTeammate(workspaceId, id);
    if (result.ok) { setMessage(invitation ? "Invitation revoked." : "Member removed."); await load(); }
    else setError(result.error.message);
    setBusy(false);
  }

  return <div className="space-y-6">
    {error && <p role="alert" className="rounded-xl border border-[var(--danger)] p-4 text-sm text-[var(--danger)]">{error}</p>}
    {message && <p role="status" className="muted-surface rounded-xl p-4 text-sm">{message}</p>}
    {team ? <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--muted)]">{team.members.filter((member) => !member.suspended).length} active members · {team.invitations.length} pending invitations · {team.seat_limit} seats</p><Link href="/billing" className="text-sm font-semibold text-[var(--accent)]">View your plan →</Link></div>
      {team.can_manage && (team.can_invite ? <form onSubmit={(event) => void invite(event)} className="surface flex flex-wrap items-end gap-3 rounded-xl p-5"><label className="grid grow gap-2 text-sm font-medium">Invite a teammate<input className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--foreground)]" type="email" autoComplete="email" name="email" placeholder="teammate@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={320} disabled={busy} /></label><Button type="submit" variant="primary" loading={busy}>Send invitation</Button></form> : <p className="muted-surface rounded-xl p-4 text-sm">Upgrade this workspace to Team to invite up to four teammates.</p>)}
      <section className="surface rounded-xl p-5"><h2 className="mb-4 text-lg font-bold">Members</h2><ul className="divide-y divide-[var(--border)]">{team.members.map((member) => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{member.name}</p><p className="mt-1 break-all text-sm text-[var(--muted)]">{member.email}</p><p className="mt-1 text-xs capitalize text-[var(--muted)]">{member.role}{member.suspended ? " · Access suspended until Team resumes" : ""}</p></div>{team.can_manage && member.role !== "owner" && <Button disabled={busy} onClick={() => void remove(member.user_id, false)}>Remove member</Button>}</li>)}</ul></section>
      {team.can_manage && <section className="surface rounded-xl p-5"><h2 className="mb-4 text-lg font-bold">Pending invitations</h2>{team.invitations.length ? <ul className="divide-y divide-[var(--border)]">{team.invitations.map((invitation) => <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="break-all text-sm font-medium">{invitation.email}</p><p className="mt-1 text-xs text-[var(--muted)]">Expires {new Date(invitation.expires_at).toLocaleDateString()}</p></div><Button disabled={busy} onClick={() => void remove(invitation.id, true)}>Revoke invitation</Button></li>)}</ul> : <p className="text-sm text-[var(--muted)]">No pending invitations.</p>}</section>}
      <p className="text-xs leading-6 text-[var(--muted)]">Team credits are shared across the workspace. Each member keeps their own sign-in and can switch between workspaces. Removing access does not delete saved research.</p>
    </> : !error && <p role="status" className="text-sm text-[var(--muted)]">Loading your team…</p>}
  </div>;
}
