import { apiDelete, apiGet, apiPost } from "./client";

export type PlanKey = "free" | "pro" | "team";

export type PricingPlan = {
  key: PlanKey;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  credits: number;
  members: number;
  description: string;
  features: string[];
};

export type PricingCatalog = { plans: PricingPlan[]; checkout_enabled: boolean };

export type WorkspaceBilling = {
  workspace_id: string;
  plan: PlanKey;
  status: string;
  subscription_status: string | null;
  credits: number;
  used: number;
  reserved: number;
  remaining: number;
  members: number;
  period_start: string | null;
  period_end: string | null;
  transition_ends_at: string | null;
  cancel_at_period_end: boolean;
  can_manage: boolean;
  checkout_enabled: boolean;
  portal_enabled: boolean;
  ai_configured: boolean;
  enforcement_enabled: boolean;
  sync_pending: boolean;
};

export type WorkspaceTeam = {
  workspace_id: string;
  can_manage: boolean;
  can_invite: boolean;
  seat_limit: number;
  members: { user_id: string; name: string; email: string; role: string; suspended: boolean }[];
  invitations: { id: string; email: string; expires_at: string }[];
};

export function getPricingCatalog() {
  return apiGet<PricingCatalog>("/billing/plans", { timeoutMs: 5000 });
}

export function getWorkspaceBilling() {
  return apiGet<WorkspaceBilling>("/billing/workspace");
}

export function createCheckout(plan: PlanKey, requestId: string) {
  return apiPost<{ url: string }>("/billing/checkout", { plan, requestId }, { timeoutMs: 60_000 });
}

export function createBillingPortal() {
  return apiPost<{ url: string }>("/billing/portal", undefined, { timeoutMs: 40_000 });
}

export function switchWorkspace(workspaceId: string) {
  return apiPost("/auth/workspace", { workspaceId });
}

export function getWorkspaceTeam(workspaceId: string) {
  return apiGet<WorkspaceTeam>(`/workspaces/${workspaceId}/members`);
}

export function inviteTeammate(workspaceId: string, email: string) {
  return apiPost(`/workspaces/${workspaceId}/invitations`, { email }, { timeoutMs: 40_000 });
}

export function revokeInvitation(workspaceId: string, invitationId: string) {
  return apiDelete(`/workspaces/${workspaceId}/invitations/${invitationId}`);
}

export function removeTeammate(workspaceId: string, userId: string) {
  return apiDelete(`/workspaces/${workspaceId}/members/${userId}`);
}

export function acceptInvitation(token: string) {
  return apiPost<{ workspace_id: string }>("/workspace-invitations/accept", { token });
}

export function formatPlanPrice(plan: PricingPlan): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: plan.currency.toUpperCase(), maximumFractionDigits: 0,
  }).format(plan.amount / 100);
}
