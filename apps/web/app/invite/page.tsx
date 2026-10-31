import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { InvitationCard } from "@/components/billing/InvitationCard";
import { getProductConfig } from "@/config/product";

export const metadata: Metadata = { title: "Workspace invitation", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function InvitationPage() {
  const product = getProductConfig();
  return <main className="marketing-page"><header className="marketing-nav"><div className="marketing-container marketing-nav-inner"><Link href="/" className="marketing-brand"><BrandMark className="h-8 w-8" />{product.name}</Link><Link href="/" className="marketing-text-link">Back to homepage</Link></div></header><div className="marketing-container"><InvitationCard /></div></main>;
}
