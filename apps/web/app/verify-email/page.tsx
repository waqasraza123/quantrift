import Link from "next/link";
import { EmailVerificationCard } from "@/components/auth/EmailVerificationCard";
import { BrandMark } from "@/components/brand/BrandMark";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  return (
    <main className="landing-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061416] px-4 py-20">
      <div className="landing-glow pointer-events-none absolute inset-0" />
      <Link className="absolute left-5 top-5 z-10 flex items-center gap-2.5 text-sm font-bold transition focus-visible:ring-2 focus-visible:ring-[#67e8d5]" href="/"><BrandMark className="h-8 w-8 text-white" /><span className="text-white transition hover:text-[#9cf2e6]">QuantRift</span></Link>
      <div className="relative z-10 w-full max-w-lg"><EmailVerificationCard token={token} /></div>
    </main>
  );
}
