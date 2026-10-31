"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ProductIcon } from "@/components/ui/ProductIcon";
import { resendVerificationEmail, verifyEmailToken } from "@/lib/api/auth";
import { AuthField } from "./AuthField";
import styles from "./auth.module.css";

type VerificationView = "verifying" | "verified" | "already_verified" | "expired" | "invalid" | "error";

export function EmailVerificationCard({ token }: { token?: string }) {
  const attempt = useRef<{ token: string; promise: ReturnType<typeof verifyEmailToken> } | null>(null);
  const [view, setView] = useState<VerificationView>(token ? "verifying" : "invalid");
  const [message, setMessage] = useState(token ? "Confirming your email address…" : "This verification link is missing its token.");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    setView("verifying");
    setMessage("Confirming your email address…");
    if (attempt.current?.token !== token) attempt.current = { token, promise: verifyEmailToken(token) };
    void attempt.current.promise.then((result) => {
      if (!active) return;
      if (result.ok && result.verification) {
        setView(result.verification.status === "already_verified" ? "already_verified" : "verified");
        setMessage(result.verification.message);
      } else {
        setView(result.code === "verification_token_expired" ? "expired" : result.code === "invalid_verification_token" ? "invalid" : "error");
        setMessage(result.message || "We couldn’t verify this email address. Try requesting a new link.");
      }
    });
    return () => { active = false; };
  }, [token]);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resending) return;
    setResending(true);
    setResendMessage("");
    const result = await resendVerificationEmail(email.trim());
    setResending(false);
    setResendMessage(result.verification?.message || result.message || "We couldn’t send a new link. Try again.");
  }

  const successful = view === "verified" || view === "already_verified";
  const title = view === "verifying" ? "Verifying your email." : view === "verified" ? "You’re verified." : view === "already_verified" ? "You’re already verified." : view === "expired" ? "This link has expired." : view === "invalid" ? "Let’s get a new link." : "We couldn’t verify your email.";

  return (
    <section className={styles.card} aria-labelledby="verification-title">
      <span className={styles.cardIcon}>{view === "verifying" ? <span className={styles.spinner} /> : <ProductIcon name={successful ? "check" : "shield"} />}</span>
      <h2 id="verification-title">{title}</h2>
      <p className={styles.intro} role="status">{message}</p>
      {successful ? <Link href="/login" className={styles.submit}>Continue to sign in <ProductIcon name="arrow" /></Link> : view !== "verifying" && (
        <form className={styles.form} onSubmit={(event) => void resend(event)} aria-busy={resending}>
          <AuthField label="Account email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={320} required disabled={resending} />
          <button className={styles.submit} type="submit" disabled={resending}>{resending ? "Sending…" : "Send a new link"}</button>
          {resendMessage && <p className={styles.notice} role="status">{resendMessage}</p>}
        </form>
      )}
      <p className={styles.switch}><Link href="/login">Back to sign in</Link></p>
    </section>
  );
}
