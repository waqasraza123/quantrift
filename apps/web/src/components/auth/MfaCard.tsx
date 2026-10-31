"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ProductIcon } from "@/components/ui/ProductIcon";
import { cancelMfa, getMfaSetup, getMfaStatus, recoverMfa, verifyMfaCode } from "@/lib/api/mfa";
import { authModeHref, safeAuthDestination } from "@/lib/auth/redirects";
import type { MfaSetup } from "@/lib/auth/mfa";
import { AuthField } from "./AuthField";
import styles from "./auth.module.css";

type Stage = "loading" | "enroll" | "verify" | "recovery" | "codes" | "expired" | "error";

export function MfaCard({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const loginHref = authModeHref("login", nextPath);

  useEffect(() => {
    let active = true;
    setStage("loading");
    setError("");
    async function load() {
      const status = await getMfaStatus();
      if (!active) return;
      if (!status.ok) {
        setError(status.message);
        setStage(status.code === "mfa_challenge_expired" || status.code === "mfa_locked" ? "expired" : "error");
        return;
      }
      if (status.data.nextAction === "verify") {
        setStage("verify");
        return;
      }
      const result = await getMfaSetup();
      if (!active) return;
      if (!result.ok) {
        setError(result.message);
        setStage(result.code === "mfa_challenge_expired" || result.code === "mfa_locked" ? "expired" : "error");
        return;
      }
      setSetup(result.data);
      setStage("enroll");
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  function handleFailure(result: { message: string; code?: string }) {
    setError(result.message);
    setCode("");
    if (result.code === "mfa_challenge_expired" || result.code === "mfa_locked") {
      setSetup(null);
      setRecoveryCode("");
      setStage("expired");
    }
  }

  function enterWorkspace() {
    setRecoveryCodes([]);
    setSetup(null);
    router.replace(safeAuthDestination(nextPath));
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (stage === "recovery" && !/^[a-f0-9]{8}(-[a-f0-9]{8}){3}$/i.test(recoveryCode.trim())) {
      setError("Enter a complete recovery code, including its hyphens.");
      return;
    }
    if (stage !== "recovery" && !/^[0-9]{6}$/.test(code)) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    if (stage === "recovery") {
      const result = await recoverMfa(recoveryCode.trim().toLowerCase());
      setRecoveryCode("");
      setBusy(false);
      if (!result.ok) { handleFailure(result); return; }
      setNotice("Recovery code accepted. Set up your replacement authenticator to finish signing in.");
      setRetry((value) => value + 1);
      return;
    }
    const result = await verifyMfaCode(code);
    setCode("");
    if (!result.ok) { setBusy(false); handleFailure(result); return; }
    setSetup(null);
    if (result.data.recoveryCodes) {
      setRecoveryCodes(result.data.recoveryCodes);
      setStage("codes");
      setBusy(false);
    } else enterWorkspace();
  }

  async function cancel() {
    if (busy) return;
    setBusy(true);
    await cancelMfa();
    setSetup(null);
    setCode("");
    setRecoveryCode("");
    router.replace(loginHref);
    router.refresh();
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied. Store it somewhere private.");
    } catch {
      setNotice("Copy wasn’t available. Select and copy the text below.");
    }
  }

  const title = stage === "enroll" ? "Add your authenticator." : stage === "codes" ? "Keep your recovery codes." : stage === "recovery" ? "Use a recovery code." : stage === "expired" ? "Let’s start again." : stage === "error" ? "Verification is unavailable." : stage === "loading" ? "Getting things ready." : "One more step.";

  return (
    <section className={styles.card} aria-labelledby="mfa-title">
      <span className={styles.cardIcon}><ProductIcon name="shield" /></span>
      <h2 id="mfa-title">{title}</h2>
      <p className={styles.intro}>{stage === "enroll" ? "Scan this code with your authenticator app, then enter the code it generates." : stage === "codes" ? "Save these somewhere private before continuing. Each code works once if you lose your authenticator. These codes are shown only now." : stage === "recovery" ? "Enter one of the recovery codes you saved. You’ll then set up a replacement authenticator." : stage === "verify" ? "Enter the six-digit code from your authenticator app to finish signing in." : stage === "loading" ? "Loading your sign-in verification…" : "Return to sign in to continue."}</p>
      {stage === "loading" && <p className={styles.notice} role="status"><span className={styles.spinner} aria-hidden="true" /> Loading…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {stage === "enroll" && setup && <div className={styles.setup}>
        <div className={styles.qr}><QRCodeSVG value={setup.otpauthUri} size={176} level="M" marginSize={4} title={`Authenticator setup for ${setup.issuer}`} /></div>
        <details><summary>Can’t scan? Enter a setup key</summary><p className={styles.fieldHelp}>Choose a time-based account in your authenticator app and enter this key.</p><code className={styles.secret}>{setup.secret}</code><button type="button" className={styles.secondary} onClick={() => void copy(setup.secret)}>Copy setup key</button></details>
      </div>}
      {(stage === "enroll" || stage === "verify" || stage === "recovery") && <>
        <form className={`${styles.form} ${styles.mfaForm}`} onSubmit={(event) => void submit(event)} aria-busy={busy}>
          {stage === "recovery" ? <AuthField label="Recovery code" name="recoveryCode" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={35} placeholder="xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx" required disabled={busy} /> : <AuthField label="Authenticator code" name="code" value={code} onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required disabled={busy} />}
          <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Verifying…" : stage === "recovery" ? "Use recovery code" : stage === "enroll" ? "Confirm authenticator" : "Verify and sign in"}</button>
        </form>
        {stage !== "enroll" && <button className={styles.textButton} type="button" disabled={busy} onClick={() => { setCode(""); setRecoveryCode(""); setError(""); setStage(stage === "recovery" ? "verify" : "recovery"); }}>{stage === "recovery" ? "Use my authenticator instead" : "Lost your authenticator? Use a recovery code"}</button>}
        <button className={styles.textButton} type="button" disabled={busy} onClick={() => void cancel()}>Cancel and return to sign in</button>
      </>}
      {stage === "codes" && <div className={styles.actions}>
        <ol className={styles.recoveryCodes}>{recoveryCodes.map((value) => <li key={value}><code>{value}</code></li>)}</ol>
        <button className={styles.secondary} type="button" onClick={() => void copy(recoveryCodes.join("\n"))}>Copy recovery codes</button>
        <label className={styles.confirm}><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />I’ve saved my recovery codes somewhere private.</label>
        <button className={styles.submit} type="button" disabled={!saved} onClick={enterWorkspace}>Continue to workspace <ProductIcon name="arrow" /></button>
      </div>}
      {(stage === "expired" || stage === "error") && <div className={styles.actions}>{stage === "error" && <button type="button" className={styles.secondary} onClick={() => setRetry((value) => value + 1)}>Try again</button>}<Link className={styles.submit} href={loginHref}>Return to sign in</Link></div>}
    </section>
  );
}
