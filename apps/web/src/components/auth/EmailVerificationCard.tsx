"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { resendVerificationEmail, verifyEmailToken } from "@/lib/api/auth";

type VerificationView = "verifying" | "verified" | "already_verified" | "expired" | "invalid" | "error";

export function EmailVerificationCard({ token }: { token?: string }) {
  const requested = useRef(false);
  const [view, setView] = useState<VerificationView>(token ? "verifying" : "invalid");
  const [message, setMessage] = useState(token ? "Confirming your secure link…" : "This verification link is missing its token.");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;
    void verifyEmailToken(token).then((result) => {
      if (result.ok && result.verification) {
        const status = result.verification.status;
        setView(status === "already_verified" ? "already_verified" : "verified");
        setMessage(result.verification.message);
        return;
      }
      if (result.code === "verification_token_expired") setView("expired");
      else if (result.code === "invalid_verification_token") setView("invalid");
      else setView("error");
      setMessage(result.message || "We could not verify this email address.");
    });
  }, [token]);

  async function handleResend() {
    if (!email.trim() || resending) return;
    setResending(true);
    setResendMessage(null);
    const result = await resendVerificationEmail(email);
    setResending(false);
    setResendMessage(result.message || (result.ok ? "Verification email sent." : "Delivery failed."));
  }

  const successful = view === "verified" || view === "already_verified";
  return (
    <section aria-live="polite" className="motion-reveal motion-reveal-scale w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[#09111f]/95 p-7 text-slate-100 shadow-[0_32px_120px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-10">
      <StatusMark view={view} />
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">Email verification</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{verificationTitle(view)}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
      {view === "verifying" && (
        <div className="mt-7 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-300" role="status">
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-teal-200 border-r-transparent motion-reduce:animate-none" />
          Verifying email address…
        </div>
      )}
      {successful && (
        <Link className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-teal-300 bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-200 focus-visible:ring-4 focus-visible:ring-teal-300/20" href="/login">
          Continue to sign in
        </Link>
      )}
      {(view === "expired" || view === "invalid" || view === "error") && (
        <div className="mt-7 border-t border-white/10 pt-6">
          <label className="block" htmlFor="verification-email">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Account email</span>
            <input className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-teal-300/60 focus:ring-4 focus:ring-teal-300/10" id="verification-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" type="email" value={email} />
          </label>
          <Button className="mt-3 w-full" disabled={!email.trim()} loading={resending} loadingText="Sending…" onClick={handleResend} variant="primary">Send a new link</Button>
          {resendMessage && <p className="mt-3 text-sm leading-6 text-slate-300" role="status">{resendMessage}</p>}
          <Link className="mt-4 block text-center text-sm font-semibold text-slate-400 transition hover:text-white" href="/login">Back to sign in</Link>
        </div>
      )}
    </section>
  );
}

function StatusMark({ view }: { view: VerificationView }) {
  const successful = view === "verified" || view === "already_verified";
  const loading = view === "verifying";
  return (
    <div aria-hidden="true" className={`grid h-12 w-12 place-items-center rounded-2xl border ${successful ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : loading ? "border-teal-300/30 bg-teal-300/10 text-teal-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>
      {successful ? "✓" : loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" /> : "!"}
    </div>
  );
}

function verificationTitle(view: VerificationView): string {
  if (view === "verifying") return "Verifying your email";
  if (view === "verified") return "Email verified";
  if (view === "already_verified") return "Already verified";
  if (view === "expired") return "This link has expired";
  if (view === "invalid") return "This link is not valid";
  return "Verification is unavailable";
}
