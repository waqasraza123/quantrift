import "server-only";

import { cookies } from "next/headers";
import { isMfaChallenge, isRecord } from "@/lib/auth/mfa";
import type { MfaChallenge } from "@/lib/auth/mfa";

const secure = process.env.NODE_ENV === "production";
const cookieName = secure ? "__Host-quantrift-mfa" : "quantrift_mfa";

export type BackendMfaChallenge = MfaChallenge & { challengeToken: string };

export function isBackendMfaChallenge(value: unknown): value is BackendMfaChallenge {
  return isMfaChallenge(value) && isRecord(value) && typeof value.challengeToken === "string"
    && /^[A-Za-z0-9_-]{43}$/.test(value.challengeToken) && Date.parse(value.expiresAt) > Date.now();
}

export async function setMfaCookie(challenge: BackendMfaChallenge): Promise<void> {
  const store = await cookies();
  store.set(cookieName, challenge.challengeToken, {
    httpOnly: true, secure, sameSite: "strict", path: "/", priority: "high",
    maxAge: Math.min(600, Math.max(1, Math.floor((Date.parse(challenge.expiresAt) - Date.now()) / 1000))),
  });
}

export async function getMfaToken(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export async function clearMfaCookie(): Promise<void> {
  const store = await cookies();
  store.set(cookieName, "", { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 0, expires: new Date(0) });
}
