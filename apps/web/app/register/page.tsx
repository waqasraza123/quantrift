import { AuthCard } from "@/components/auth/AuthCard";
import { BrandMark } from "@/components/brand/BrandMark";
import { getPublicEnv } from "@/config/env";
import { getCurrentIdentity } from "@/lib/api/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function RegisterPage() {
  if (getPublicEnv().authMode === "session") {
    const identity = await getCurrentIdentity();
    if (identity.ok && identity.data.authenticated) {
      redirect("/command-center");
    }
  }
  return (
    <main className="landing-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061416] px-4 py-24 md:py-10">
      <div className="landing-glow pointer-events-none absolute inset-0" />
      <Link className="absolute left-5 top-5 z-10 flex items-center gap-2.5 text-sm font-bold transition" href="/"><BrandMark className="h-8 w-8 text-white" /><span className="text-white transition hover:text-[#9cf2e6]">QuantRift</span></Link>
      <div className="relative z-10 w-full max-w-5xl"><AuthCard mode="register" /></div>
    </main>
  );
}
