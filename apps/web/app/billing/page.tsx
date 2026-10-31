import type { Metadata } from "next";
import { BillingDashboard } from "@/components/billing/BillingDashboard";
import { AppShell } from "@/components/layout/AppShell";
import { getAccountData } from "@/lib/api/accountServer";

export const metadata: Metadata = { title: "Billing", robots: { index: false, follow: false } };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string; checkout?: string }> }) {
  const [data, params] = await Promise.all([getAccountData(), searchParams]);
  const workspace = data.authContext?.identity.workspace;
  return <AppShell appName={data.appName} workspaceId={workspace?.id} workspaceName={workspace?.name}><div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Your workspace</p><h1 className="mt-2 text-3xl font-bold">Plan & billing</h1></div><BillingDashboard selectedPlan={params.plan} checkoutState={params.checkout} /></div></AppShell>;
}
