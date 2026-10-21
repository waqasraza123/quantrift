"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  loginWithPassword,
  registerWithPassword,
  resendVerificationEmail,
} from "@/lib/api/auth";
import { cn } from "@/lib/ui/cn";

type AuthMode = "login" | "register";
type AuthCardProps = { mode: AuthMode; nextPath?: string };
type FieldErrors = Partial<Record<"workspaceName" | "name" | "email" | "password", string>>;
type VerificationState = "pending" | "sent" | "delivery_failed";

export function AuthCard({ mode, nextPath }: AuthCardProps) {
  const router = useRouter();
  const formErrorId = useId();
  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verificationState, setVerificationState] = useState<VerificationState | null>(null);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const validation = validateFields({ isRegister, workspaceName, name, email, password });
    setFieldErrors(validation);
    setErrorMessage(null);
    if (Object.keys(validation).length > 0) return;
    setLoading(true);
    const result = isRegister
      ? await registerWithPassword({ workspaceName, name, email, password })
      : await loginWithPassword(email, password);
    setLoading(false);
    if (!result.ok) {
      setErrorMessage(result.message || "Authentication failed");
      if (result.code === "email_unverified") setVerificationState("pending");
      if (isRegister && result.code === "verification_delivery_failed") {
        setVerificationState("delivery_failed");
      }
      return;
    }
    if (isRegister) {
      setVerificationState("pending");
      return;
    }
    router.push(safeNextPath(nextPath));
    router.refresh();
  }

  async function handleResend() {
    if (resending || !email.trim()) return;
    setResending(true);
    setErrorMessage(null);
    const result = await resendVerificationEmail(email);
    setResending(false);
    if (!result.ok) {
      setVerificationState("delivery_failed");
      setErrorMessage(result.message || "The verification email could not be sent");
      return;
    }
    if (result.verification?.status === "already_verified") {
      setVerificationState(null);
      setErrorMessage("This email is already verified. Sign in to continue.");
      return;
    }
    setVerificationState("sent");
  }

  if (verificationState) {
    return (
      <VerificationPendingCard
        email={email}
        errorMessage={errorMessage}
        onResend={handleResend}
        resending={resending}
        state={verificationState}
      />
    );
  }

  return (
    <section className="auth-card motion-reveal motion-reveal-scale grid w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#09111f]/95 text-slate-100 shadow-[0_32px_120px_rgba(0,0,0,0.5)] backdrop-blur-xl md:grid-cols-[0.88fr_1.12fr]">
      <AuthContextPanel isRegister={isRegister} />
      <div className="p-6 sm:p-8 md:p-10">
        <nav aria-label="Authentication mode" className="grid grid-cols-2 rounded-xl bg-white/[0.045] p-1">
          <AuthModeLink active={!isRegister} href="/login" label="Sign in" />
          <AuthModeLink active={isRegister} href="/register" label="Create account" />
        </nav>
        <div className="mt-7" key={mode}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">
            {isRegister ? "New workspace" : "Secure access"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {isRegister ? "Create your QuantRift workspace" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {isRegister
              ? "Set up your research workspace. You will verify your email before the first sign-in."
              : "Sign in to continue to your private market-intelligence workspace."}
          </p>
        </div>
        <form
          aria-describedby={errorMessage ? formErrorId : undefined}
          className="mt-7 space-y-4"
          noValidate
          onSubmit={handleSubmit}
        >
          {isRegister && (
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthField autoComplete="organization" error={fieldErrors.workspaceName} label="Workspace" name="workspaceName" onChange={setWorkspaceName} placeholder="Northstar Research" value={workspaceName} />
              <AuthField autoComplete="name" error={fieldErrors.name} label="Your name" name="name" onChange={setName} placeholder="Ada Lovelace" value={name} />
            </div>
          )}
          <AuthField autoComplete="email" error={fieldErrors.email} label="Email address" name="email" onChange={setEmail} placeholder="you@company.com" type="email" value={email} />
          <div>
            <label className="block" htmlFor="auth-password">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Password</span>
            </label>
            <div className="relative mt-2">
              <input
                aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
                aria-invalid={Boolean(fieldErrors.password)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                className={inputClassName(Boolean(fieldErrors.password), "pr-24")}
                id="auth-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isRegister ? "At least 12 characters" : "Your password"}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-1 my-1 rounded-lg px-3 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.password ? (
              <p className="mt-1.5 text-xs text-rose-300" id="auth-password-error">{fieldErrors.password}</p>
            ) : isRegister ? (
              <p className="mt-1.5 text-xs leading-5 text-slate-500">Use 12 or more characters. Your password is stored as an Argon2id hash.</p>
            ) : null}
          </div>
          {errorMessage && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3.5 py-3 text-sm leading-5 text-rose-100" id={formErrorId} role="alert">
              {errorMessage}
            </div>
          )}
          <Button className="mt-1 w-full" loading={loading} loadingText={isRegister ? "Creating account…" : "Signing in…"} size="lg" type="submit" variant="primary">
            {isRegister ? "Create account" : "Sign in securely"}
          </Button>
          <p className="text-center text-xs leading-5 text-slate-500">
            {isRegister
              ? "No session is created until your email is verified and you sign in."
              : "Your session stays in a secure HttpOnly cookie and is never exposed to page scripts."}
          </p>
        </form>
      </div>
    </section>
  );
}

function AuthContextPanel({ isRegister }: { isRegister: boolean }) {
  return (
    <div className="relative hidden overflow-hidden border-r border-white/10 bg-white/[0.025] p-8 md:flex md:flex-col md:justify-between">
      <div aria-hidden="true" className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-teal-300/25 bg-teal-300/10 text-sm font-bold text-teal-200">QR</span>
          <div><p className="font-semibold text-white">QuantRift</p><p className="text-xs text-slate-500">Research intelligence</p></div>
        </div>
        <p className="mt-10 max-w-xs text-xl font-medium leading-8 text-slate-200">
          {isRegister ? "A focused workspace for evidence-based market research." : "Return to your daily research command center."}
        </p>
      </div>
      <ul className="relative mt-10 space-y-3 text-sm text-slate-400">
        <TrustItem label="Verified email access" />
        <TrustItem label="Secure server-managed sessions" />
        <TrustItem label="No broker execution" />
      </ul>
    </div>
  );
}

function TrustItem({ label }: { label: string }) {
  return <li className="flex items-center gap-2.5"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-teal-300" />{label}</li>;
}

function AuthModeLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link aria-current={active ? "page" : undefined} className={cn("rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition duration-200 focus-visible:ring-2 focus-visible:ring-teal-300", active ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-200")} href={href}>
      {label}
    </Link>
  );
}

type AuthFieldProps = { autoComplete: string; error?: string; label: string; name: string; onChange: (value: string) => void; placeholder: string; type?: string; value: string };

function AuthField({ autoComplete, error, label, name, onChange, placeholder, type = "text", value }: AuthFieldProps) {
  const inputId = `auth-${name}`;
  const errorId = `${inputId}-error`;
  return (
    <label className="block" htmlFor={inputId}>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} autoComplete={autoComplete} className={inputClassName(Boolean(error))} id={inputId} name={name} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
      {error && <span className="mt-1.5 block text-xs text-rose-300" id={errorId}>{error}</span>}
    </label>
  );
}

function VerificationPendingCard({ email, state, errorMessage, resending, onResend }: { email: string; state: VerificationState; errorMessage: string | null; resending: boolean; onResend: () => void }) {
  const sent = state === "sent";
  const deliveryFailed = state === "delivery_failed";
  return (
    <section className="motion-reveal motion-reveal-scale w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[#09111f]/95 p-7 text-slate-100 shadow-[0_32px_120px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-10">
      <div className={cn("grid h-12 w-12 place-items-center rounded-2xl border", deliveryFailed ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-teal-300/30 bg-teal-300/10 text-teal-200")} aria-hidden="true">{deliveryFailed ? "!" : "✓"}</div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">{sent ? "Email sent" : deliveryFailed ? "Delivery needs attention" : "Verification pending"}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{sent ? "Check your inbox again" : deliveryFailed ? "Your account is waiting" : "Check your inbox"}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {deliveryFailed ? "The account was created, but we could not deliver the verification email. No session was created." : "Open the secure link we sent to verify your address. You can sign in after verification."}
      </p>
      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-300"><span className="text-slate-500">Email</span><span className="ml-2 break-all font-medium text-white">{email}</span></div>
      {errorMessage && deliveryFailed && <p className="mt-4 text-sm leading-6 text-amber-200" role="alert">{errorMessage}</p>}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Button loading={resending} loadingText="Sending…" onClick={onResend} variant="primary">Resend verification</Button>
        <Link className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-3.5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-teal-300" href="/login">Back to sign in</Link>
      </div>
      <p className="mt-5 text-xs leading-5 text-slate-500">Links expire for your protection. If the message is missing, check spam or request a new one.</p>
    </section>
  );
}

function validateFields({ isRegister, workspaceName, name, email, password }: { isRegister: boolean; workspaceName: string; name: string; email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (isRegister && !workspaceName.trim()) errors.workspaceName = "Enter a workspace name.";
  if (isRegister && !name.trim()) errors.name = "Enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  else if (isRegister && password.length < 12) errors.password = "Use at least 12 characters.";
  return errors;
}

function inputClassName(hasError: boolean, extra?: string): string {
  return cn("mt-2 min-h-11 w-full rounded-xl border bg-white/[0.045] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:ring-4", hasError ? "border-rose-400/60 focus:border-rose-300 focus:ring-rose-300/10" : "border-white/10 focus:border-teal-300/60 focus:ring-teal-300/10", extra);
}

function safeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/command-center";
  return value;
}
