"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { FormEvent } from "react";
import { ProductIcon } from "@/components/ui/ProductIcon";
import { getProductConfig } from "@/config/product";
import { loginWithPassword, registerWithPassword } from "@/lib/api/auth";
import { authModeHref, safeAuthDestination } from "@/lib/auth/redirects";
import { AuthField } from "./AuthField";
import { VerificationPendingCard, type VerificationState } from "./VerificationPendingCard";
import styles from "./auth.module.css";

type FieldErrors = Partial<Record<"workspaceName" | "name" | "email" | "password", string>>;

export function AuthCard({ mode, nextPath }: { mode: "login" | "register"; nextPath?: string }) {
  const router = useRouter();
  const product = getProductConfig();
  const passwordId = useId();
  const errorId = useId();
  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState<VerificationState | null>(null);
  const signup = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const errors: FieldErrors = {};
    if (signup && !name.trim()) errors.name = "Enter your name.";
    if (signup && !workspaceName.trim()) errors.workspaceName = "Enter a workspace name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Enter your password.";
    else if (signup && password.length < 12) errors.password = "Use at least 12 characters.";
    setFieldErrors(errors);
    setError("");
    if (Object.keys(errors).length) return;
    setBusy(true);
    const result = signup
      ? await registerWithPassword({ name: name.trim(), workspaceName: workspaceName.trim(), email: email.trim(), password })
      : await loginWithPassword(email.trim(), password);
    if (!result.ok) {
      setBusy(false);
      if (result.code === "email_unverified") {
        setPassword("");
        setVerification("pending");
      } else if (signup && result.code === "verification_delivery_failed") {
        setPassword("");
        setVerification("delivery_failed");
      } else {
        setError(result.message || "We couldn’t finish that. Check your details and try again.");
      }
      return;
    }
    setPassword("");
    if (signup) {
      setBusy(false);
      setVerification("pending");
      return;
    }
    if (result.mfa) {
      router.replace(`/mfa?${new URLSearchParams({ next: safeAuthDestination(nextPath) })}`);
      return;
    }
    router.replace(safeAuthDestination(nextPath));
    router.refresh();
  }

  function returnToForm() {
    setVerification(null);
    setError("");
    setFieldErrors({});
    setPassword("");
  }

  if (verification) return <VerificationPendingCard key={email} email={email} initialState={verification} nextPath={nextPath} onBack={returnToForm} />;

  return (
    <section className={styles.card} aria-labelledby="auth-title">
      <span className={styles.cardIcon}><ProductIcon name={signup ? "layers" : "chart"} /></span>
      <h2 id="auth-title">{signup ? "Make room for your research." : "Good to have you back."}</h2>
      <p className={styles.intro}>{signup ? "Create your account and verify your email to get started." : "Sign in to pick up where you left off."}</p>
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)} aria-busy={busy} aria-describedby={error ? errorId : undefined}>
        {signup && <>
          <AuthField label="Your name" name="name" autoComplete="name" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} error={fieldErrors.name} maxLength={160} required disabled={busy} />
          <AuthField label="Workspace name" name="workspaceName" autoComplete="organization" placeholder="Your research workspace" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} error={fieldErrors.workspaceName} maxLength={120} required disabled={busy} />
        </>}
        <AuthField label="Email address" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} error={fieldErrors.email} maxLength={320} required disabled={busy} autoCapitalize="none" spellCheck={false} />
        <div>
          <label className={styles.field} htmlFor={passwordId}>
            Password
            <span className={styles.password}>
              <input id={passwordId} name="password" type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "Create a strong password" : "Your password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={signup ? 12 : 1} maxLength={256} required disabled={busy} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={signup || fieldErrors.password ? `${passwordId}-help` : undefined} />
              <button type="button" aria-pressed={showPassword} aria-controls={passwordId} aria-label={showPassword ? "Hide password" : "Show password"} disabled={busy} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</button>
            </span>
          </label>
          {(signup || fieldErrors.password) && <p id={`${passwordId}-help`} className={fieldErrors.password ? styles.fieldError : styles.fieldHelp}>{fieldErrors.password || "Use at least 12 characters. A few memorable words work well."}</p>}
        </div>
        {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
        <button className={styles.submit} disabled={busy} type="submit">{busy ? <><span className={styles.spinner} aria-hidden="true" />Just a moment…</> : <>{signup ? "Create account" : "Sign in"}<ProductIcon name="arrow" className="h-4 w-4" /></>}</button>
      </form>
      <p className={styles.switch}>{signup ? "Already have an account?" : `New to ${product.name}?`} <Link href={authModeHref(signup ? "login" : "register", nextPath)}>{signup ? "Sign in" : "Create an account"}</Link></p>
      <p className={styles.privacy}><ProductIcon name="shield" />Your workspace stays private. You stay in control.</p>
    </section>
  );
}
