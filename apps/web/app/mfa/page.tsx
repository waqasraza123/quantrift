import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { MfaCard } from "@/components/auth/MfaCard";
import { getCurrentIdentity } from "@/lib/api/auth";
import { authModeHref, safeAuthDestination } from "@/lib/auth/redirects";
import { getMfaToken } from "../api/auth/mfa/cookie";
import { getAuthSessionToken } from "../api/auth/session";

export const metadata: Metadata = { title: "Verify your sign-in", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (!(await getMfaToken())) {
    if (await getAuthSessionToken()) {
      const identity = await getCurrentIdentity();
      if (identity.ok && identity.data.authenticated) redirect(safeAuthDestination(next));
    }
    redirect(authModeHref("login", next));
  }
  return <AuthLayout><MfaCard nextPath={next} /></AuthLayout>;
}
