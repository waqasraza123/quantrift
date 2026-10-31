import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { getPublicEnv } from "@/config/env";
import { getCurrentIdentity } from "@/lib/api/auth";
import { safeAuthDestination } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (getPublicEnv().authMode === "session") {
    const identity = await getCurrentIdentity();
    if (identity.ok && identity.data.authenticated) redirect(safeAuthDestination(next));
  }
  return <AuthLayout><AuthCard mode="login" nextPath={next} /></AuthLayout>;
}
