import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailVerificationCard } from "@/components/auth/EmailVerificationCard";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthLayout><EmailVerificationCard key={token || "missing"} token={token} /></AuthLayout>;
}
