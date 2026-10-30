"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { listWorkspaces } from "@/lib/api/market";
import type { Workspace } from "@/lib/api/types";
import { readSelectedWorkspaceId, resolveSelectedWorkspace, workspaceScopedHref, writeSelectedWorkspaceId } from "@/lib/workspace/selectedWorkspace";
import { WorkspaceMissingState } from "./WorkspaceMissingState";

export function WorkspaceSelector({ workspaceId, workspaceName }: {
  workspaceId?: string | null; workspaceName?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectId = useId();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(workspaceId && workspaceName ? [{ id: workspaceId, name: workspaceName, created_at: "", updated_at: "" }] : []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void listWorkspaces().then((result) => {
      if (!active) return;
      if (result.ok) setWorkspaces(result.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const storedId = typeof window === "undefined" ? null : readSelectedWorkspaceId();
  const selected = useMemo(() => resolveSelectedWorkspace(workspaces, workspaceId || searchParams.get("workspaceId"), storedId), [workspaces, workspaceId, searchParams, storedId]);

  function selectWorkspace(nextWorkspaceId: string) {
    writeSelectedWorkspaceId(nextWorkspaceId || null);
    const params = new URLSearchParams(searchParams.toString());
    if (nextWorkspaceId) params.set("workspaceId", nextWorkspaceId);
    else params.delete("workspaceId");
    const query = params.toString();
    window.location.href = workspaceScopedHref(`${pathname}${query ? `?${query}` : ""}`, nextWorkspaceId || null);
  }

  if (!loading && !workspaces.length) return <WorkspaceMissingState />;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5">
      <label htmlFor={selectId} className="block text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">Workspace</label>
      <select id={selectId} value={selected?.id || ""} onChange={(event) => selectWorkspace(event.target.value)} disabled={loading && !workspaces.length} className="mt-1.5 block min-h-7 w-full min-w-0 bg-transparent text-xs font-semibold text-[var(--strong)]">
        {!workspaces.length && <option value="">Loading workspace…</option>}
        {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
      </select>
    </div>
  );
}
