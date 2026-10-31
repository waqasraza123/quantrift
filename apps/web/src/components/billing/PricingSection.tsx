import Link from "next/link";
import { ProductIcon } from "@/components/ui/ProductIcon";
import { formatPlanPrice, getPricingCatalog } from "@/lib/api/billing";
import { authModeHref } from "@/lib/auth/redirects";

export async function PricingSection() {
  const result = await getPricingCatalog();
  return (
    <section className="marketing-section marketing-container" id="pricing" aria-labelledby="pricing-heading">
      <div className="marketing-section-heading">
        <div><p className="marketing-eyebrow">Plans for your research routine</p><h2 id="pricing-heading">Start with your markets.<br />Add AI when you need it.</h2></div>
        <p>Choose a monthly workspace plan. Keep your charts, scanner, journal, and saved research on every plan.</p>
      </div>
      {result.ok ? (
        <>
          <div className="pricing-grid">
            {result.data.plans.map((plan) => (
              <article key={plan.key} className={`pricing-card${plan.key === "pro" ? " pricing-card-featured" : ""}`}>
                <div className="pricing-card-top"><h3>{plan.name}</h3>{plan.key === "pro" && <span>For your daily setup review</span>}</div>
                <p className="pricing-description">{plan.description}</p>
                <p className="pricing-amount">{formatPlanPrice(plan)}<span> USD / month</span></p>
                <p className="pricing-allowance">{plan.credits ? `${plan.credits} AI credits per month` : "Core research tools"}<br />{plan.members === 1 ? "1 member" : `Up to ${plan.members} members · shared credits`}</p>
                <ul>{plan.features.map((feature) => <li key={feature}><ProductIcon name="check" />{feature}</li>)}{plan.credits > 0 && <li><ProductIcon name="check" />AI analyst and independent risk review</li>}{plan.members > 1 && <li><ProductIcon name="check" />Shared workspace and team invitations</li>}</ul>
                <Link href={authModeHref("register", plan.key === "free" ? "/command-center" : `/billing?plan=${plan.key}`)} className={`marketing-button${plan.key === "free" ? " pricing-button-secondary" : ""}`}>{plan.key === "free" ? "Start with Free" : `Choose ${plan.name}`}<ProductIcon name="arrow" className="h-4 w-4" /></Link>
              </article>
            ))}
          </div>
          <p className="pricing-footnote">One new AI analysis uses one credit. The paired analyst and risk review uses one credit total. Saved results are free to read. Credits reset each billing month and do not roll over.</p>
          <p className="pricing-footnote">AI features require availability in your workspace. Paid plans renew monthly; cancel for the end of your paid period. New accounts start on Free. {result.data.checkout_enabled ? "Payments are handled by Stripe." : "Paid checkout is not available yet. You can still create a Free account."}</p>
        </>
      ) : <p className="pricing-unavailable" role="status">Pricing is temporarily unavailable. Please try again shortly.</p>}
    </section>
  );
}
