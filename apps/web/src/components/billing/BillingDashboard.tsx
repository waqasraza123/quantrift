"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createBillingPortal, createCheckout, formatPlanPrice, getPricingCatalog, getWorkspaceBilling, type PlanKey, type PricingCatalog, type WorkspaceBilling } from "@/lib/api/billing";

export function BillingDashboard({ selectedPlan, checkoutState }: { selectedPlan?: string; checkoutState?: string }) {
  const [billing, setBilling] = useState<WorkspaceBilling | null>(null);
  const [catalog, setCatalog] = useState<PricingCatalog | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const checkoutRequests = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setLoading(true);
    const [summary, plans] = await Promise.all([getWorkspaceBilling(), getPricingCatalog()]);
    if (summary.ok) { setBilling(summary.data); setError(""); }
    else setError(summary.error.message);
    if (plans.ok) setCatalog(plans.data);
    else if (summary.ok) setError(plans.error.message);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function redirectToBilling(plan?: PlanKey) {
    if (busy || !billing) return;
    setBusy(plan || "portal");
    setError("");
    const requestKey = `${billing.workspace_id}:${plan}`;
    const requestId = checkoutRequests.current.get(requestKey) || crypto.randomUUID();
    checkoutRequests.current.set(requestKey, requestId);
    const manageExisting = billing.portal_enabled && ["active", "past_due", "unpaid", "incomplete", "paused"].includes(billing.subscription_status || "");
    const result = plan && !manageExisting ? await createCheckout(plan, requestId) : await createBillingPortal();
    if (result.ok) window.location.assign(result.data.url);
    else { setError(result.error.message); setBusy(null); }
  }

  return (
    <div className="space-y-6">
      {checkoutState === "success" && <p className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-4 text-sm" role="status">Your checkout has returned. Your plan updates after Stripe confirms payment. Refresh if confirmation is still pending.</p>}
      {checkoutState === "canceled" && <p className="muted-surface rounded-xl p-4 text-sm" role="status">Checkout was canceled. Your current plan is unchanged.</p>}
      {error && <p role="alert" className="rounded-xl border border-[var(--danger)] p-4 text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--muted)]">Subscriptions and AI credits belong to the current workspace.</p><Button onClick={() => void load()} disabled={loading || Boolean(busy)}>{loading ? "Loading…" : "Refresh billing"}</Button></div>
      {billing && (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Current subscription">
            <div className="surface rounded-xl p-5"><p className="text-xs text-[var(--muted)]">Current plan</p><p className="mt-2 text-2xl font-bold capitalize">{billing.plan}</p><p className="mt-1 text-sm text-[var(--muted)]">{billing.status === "transition" ? "30-day Pro transition" : billing.status.replaceAll("_", " ")}</p></div>
            <div className="surface rounded-xl p-5"><p className="text-xs text-[var(--muted)]">AI credits remaining</p><p className="mt-2 text-2xl font-bold">{billing.remaining} <span className="text-sm font-normal text-[var(--muted)]">/ {billing.credits}</span></p><p className="mt-1 text-sm text-[var(--muted)]">{billing.used} used · {billing.reserved} in progress</p></div>
            <div className="surface rounded-xl p-5"><p className="text-xs text-[var(--muted)]">{billing.transition_ends_at ? "Transition ends" : billing.cancel_at_period_end ? "Plan ends" : "Billing period ends"}</p><p className="mt-2 text-lg font-semibold">{billing.period_end ? new Date(billing.period_end).toLocaleDateString() : "No paid billing period"}</p><Link href="/team" className="mt-2 inline-block text-sm text-[var(--accent)]">Manage your team →</Link></div>
          </section>
          {!billing.enforcement_enabled && <p role="status" className="muted-surface rounded-xl p-4 text-sm">Subscriptions are not enabled yet. Existing research access is unchanged.</p>}
          {!billing.ai_configured && <p role="status" className="muted-surface rounded-xl p-4 text-sm">AI setup reviews are currently unavailable in this workspace. A subscription does not enable an unavailable AI service.</p>}
          {billing.sync_pending && <p role="status" className="text-sm text-[var(--muted)]">A Stripe update is waiting to be synchronized.</p>}
          {["past_due", "unpaid", "incomplete", "paused"].includes(billing.subscription_status || "") && <p role="status" className="muted-surface rounded-xl p-4 text-sm">Your subscription needs payment attention. The workspace owner can use billing management to complete or recover the payment.</p>}
          {!billing.can_manage && <p className="text-sm text-[var(--muted)]">Ask your workspace owner to change plans or manage payment details.</p>}
          {billing.can_manage && billing.portal_enabled && <Button variant="primary" loading={busy === "portal"} disabled={Boolean(busy)} onClick={() => void redirectToBilling()}>Manage subscription, payments & invoices</Button>}
          <section className="grid gap-4 lg:grid-cols-3" aria-label="Available plans">
            {catalog?.plans.map((plan) => <article key={plan.key} className={`surface rounded-xl border p-6 ${selectedPlan === plan.key ? "border-[var(--accent)]" : "border-[var(--border)]"}`}><h2 className="text-lg font-bold">{plan.name}</h2><p className="mt-3 text-3xl font-bold">{formatPlanPrice(plan)}<span className="text-xs font-normal text-[var(--muted)]"> USD / month</span></p><p className="my-5 text-sm text-[var(--muted)]">{plan.credits} AI credits · {plan.members} {plan.members === 1 ? "member" : "members"}</p>{plan.key === "free" ? <p className="text-sm text-[var(--muted)]">Included without a subscription. Use billing management to cancel a paid plan.</p> : <Button variant={plan.key === "pro" ? "primary" : "secondary"} loading={busy === plan.key} disabled={Boolean(busy) || !billing.can_manage || !billing.checkout_enabled || (billing.plan === plan.key && billing.status === "active")} onClick={() => void redirectToBilling(plan.key)}>Choose {plan.name}</Button>}</article>)}
          </section>
          {!billing.checkout_enabled && <p className="text-sm text-[var(--muted)]">Paid checkout is not available yet. No payment has been taken.</p>}
          <p className="text-xs leading-6 text-[var(--muted)]">Credits reset each billing month with no rollover or automatic overage charges. Team has five seats including the owner. Downgrading or canceling Team suspends other members when the paid period ends, while preserving memberships and saved research.</p>
        </>
      )}
    </div>
  );
}
