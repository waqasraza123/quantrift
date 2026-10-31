"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductIcon } from "@/components/ui/ProductIcon";
import { resendVerificationEmail } from "@/lib/api/auth";
import { authModeHref } from "@/lib/auth/redirects";
import styles from "./auth.module.css";

export type VerificationState = "pending" | "sent" | "delivery_failed";

export function VerificationPendingCard({ email, initialState, nextPath, onBack }: {
  email: string; initialState: VerificationState; nextPath?: string; onBack: () => void;
}) {
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [verified, setVerified] = useState(false);

  async function resend() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const result = await resendVerificationEmail(email);
    setBusy(false);
    if (!result.ok) {
      setState("delivery_failed");
      setMessage(result.message || "We couldn’t send the email. Please try again.");
      return;
    }
    if (result.verification?.status === "already_verified") {
      setVerified(true);
      setMessage("Your email is already verified. Sign in to continue.");
      return;
    }
    setState("sent");
    setMessage("If this account needs verification, a new link has been requested. Check your inbox and spam folder.");
  }

  return (
    <section className={styles.card} aria-labelledby="verification-pending-title">
      <span className={styles.cardIcon}><ProductIcon name={verified ? "check" : "shield"} /></span>
      <h2 id="verification-pending-title">{verified ? "You’re ready to sign in." : state === "delivery_failed" ? "Let’s finish your account." : "Check your inbox."}</h2>
      <p className={styles.intro}>{state === "delivery_failed" ? "Your account is waiting, but the verification email could not be delivered. Request another link to finish setting up." : "Open the link in your verification email. Once your address is confirmed, you can sign in to your research workspace."}</p>
      <p className={styles.email}>{email}</p>
      {message && <p className={state === "delivery_failed" && !verified ? styles.error : styles.notice} role={state === "delivery_failed" && !verified ? "alert" : "status"}>{message}</p>}
      <div className={styles.actions}>
        {!verified && <button type="button" className={styles.submit} disabled={busy} onClick={() => void resend()}>{busy ? <><span className={styles.spinner} aria-hidden="true" />Sending…</> : <>Resend verification<ProductIcon name="arrow" className="h-4 w-4" /></>}</button>}
        <Link href={authModeHref("login", nextPath)} onClick={onBack} className={verified ? styles.submit : styles.secondary}>Back to sign in</Link>
        <button type="button" className={styles.secondary} disabled={busy} onClick={onBack}>Use a different email</button>
      </div>
      <p className={styles.privacy}><ProductIcon name="shield" />Verify your email before signing in.</p>
    </section>
  );
}
