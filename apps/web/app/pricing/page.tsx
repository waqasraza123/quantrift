import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { PricingSection } from "@/components/billing/PricingSection";
import { getProductConfig } from "@/config/product";

export const metadata: Metadata = { title: "Pricing", alternates: { canonical: "/pricing" } };
export const dynamic = "force-dynamic";

export default function PricingPage() {
  const product = getProductConfig();
  return (
    <main className="marketing-page">
      <header className="marketing-nav"><div className="marketing-container marketing-nav-inner">
        <Link href="/" className="marketing-brand"><BrandMark className="h-8 w-8" />{product.name}</Link>
        <div className="marketing-nav-actions"><Link href="/login" className="marketing-signin">Sign in</Link><Link href="/register" className="marketing-button marketing-button-small">Get started</Link></div>
      </div></header>
      <PricingSection />
      <section className="marketing-container pricing-answers">
        <h2>Know what your plan includes.</h2>
        <div><h3>How do AI credits work?</h3><p>A new explanation, reasoning analysis, or intelligence analysis uses one credit. A paired analyst and risk review uses one credit together. An ensemble uses one credit for each new constituent analysis. Failed analyses and cached results do not use credits.</p></div>
        <div><h3>What happens if I cancel or downgrade?</h3><p>Your paid plan continues until the end of its billing period. On Free or Pro, the workspace owner retains access and other members are suspended. Your saved research and memberships are preserved if you return to Team.</p></div>
        <div><h3>What about existing workspaces?</h3><p>Workspaces created before billing launches receive 30 days of Pro access without a card. They return to Free at the end unless the owner subscribes. No automatic charge is made for that transition.</p></div>
      </section>
      <footer className="marketing-footer marketing-container"><Link href="/">{product.name}</Link><p>Market research and conditional paper setups. Not financial advice.</p><Link href="/register">Create your account</Link></footer>
    </main>
  );
}
