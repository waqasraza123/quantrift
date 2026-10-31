import { isMfaChallenge, isMfaSetup, isMfaStatus, isRecord, isRecoveryCodes } from "@/lib/auth/mfa";
import type { MfaChallenge, MfaSetup, MfaStatus } from "@/lib/auth/mfa";

type MfaResult<T> = { ok: true; data: T } | { ok: false; message: string; code?: string };
type VerifiedMfa = { ok: true; recoveryCodes: string[] | null };

async function requestMfa<T>(action: string, valid: (value: unknown) => value is T, method: "GET" | "POST" = "POST", body?: { code: string }): Promise<MfaResult<T>> {
  try {
    const response = await fetch(`/api/auth/mfa/${action}`, {
      method, headers: { accept: "application/json", "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(25_000),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
      return { ok: false,
        code: error && typeof error.code === "string" ? error.code : undefined,
        message: error && typeof error.message === "string" ? error.message : "We couldn’t complete verification. Try again.",
      };
    }
    return valid(payload) ? { ok: true, data: payload } : { ok: false, message: "Verification response was invalid. Sign in again to continue." };
  } catch {
    return { ok: false, message: "We couldn’t reach the verification service. Please try again." };
  }
}

function isVerified(value: unknown): value is VerifiedMfa {
  return isRecord(value) && value.ok === true && (value.recoveryCodes === null || isRecoveryCodes(value.recoveryCodes));
}

export const getMfaStatus = () => requestMfa<MfaStatus>("status", isMfaStatus, "GET");
export const getMfaSetup = () => requestMfa<MfaSetup>("setup", isMfaSetup);
export const verifyMfaCode = (code: string) => requestMfa<VerifiedMfa>("verify", isVerified, "POST", { code });
export const recoverMfa = (code: string) => requestMfa<MfaChallenge>("recover", isMfaChallenge, "POST", { code });
export const cancelMfa = () => requestMfa<{ ok: true }>("cancel", (value): value is { ok: true } => isRecord(value) && value.ok === true);
