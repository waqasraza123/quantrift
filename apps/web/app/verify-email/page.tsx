import Link from "next/link";
import { EmailVerificationCard } from "@/components/auth/EmailVerificationCard";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  return (
    <main className="landing-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050811] px-4 py-16">
      <div className="landing-glow pointer-events-none absolute inset-0" />
      <Link className="absolute left-5 top-5 z-10 text-sm font-semibold text-slate-400 transition hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300" href="/">← Back to QuantRift</Link>
      <div className="relative z-10 w-full max-w-lg"><EmailVerificationCard token={token} /></div>
    </main>
  );
}
