import { apiGet } from "./client";
import type { ApiResult, UUID } from "./types";

export type AuthUser = {
  id: UUID;
  workspace_id: UUID;
  email: string;
  name: string;
  role: string;
};

export type AuthWorkspace = {
  id: UUID;
  name: string;
};

export type CurrentIdentity = {
  authenticated: boolean;
  source: string | null;
  provider: string | null;
  provider_subject: string | null;
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  permissions: string[];
  scopes: string[];
  admin: boolean;
};

export type AuthSession = {
  expiresAt: string;
  identity: CurrentIdentity;
};

export type AuthVerificationResult = {
  status: "verification_pending" | "verified" | "already_verified" | "sent" | "accepted";
  email?: string;
  expiresAt?: string;
  message: string;
};

export type AuthFormResult = {
  ok: boolean;
  code?: string;
  status?: number;
  message?: string;
  session?: AuthSession;
  verification?: AuthVerificationResult;
};

export async function getCurrentIdentity(): Promise<ApiResult<CurrentIdentity>> {
  return apiGet<CurrentIdentity>("/auth/me", { timeoutMs: 5000 });
}

export async function loginWithPassword(email: string, password: string): Promise<AuthFormResult> {
  return submitAuthForm("/api/auth/login", { email, password });
}

export async function registerWithPassword(payload: {
  workspaceName: string;
  name: string;
  email: string;
  password: string;
}): Promise<AuthFormResult> {
  return submitVerificationForm("/api/auth/register", {
    workspace_name: payload.workspaceName,
    name: payload.name,
    email: payload.email,
    password: payload.password,
  });
}

export async function resendVerificationEmail(email: string): Promise<AuthFormResult> {
  return submitVerificationForm("/api/auth/resend-verification", { email });
}

export async function verifyEmailToken(token: string): Promise<AuthFormResult> {
  return submitVerificationForm("/api/auth/verify-email", { token });
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
}

async function submitAuthForm(path: string, body: Record<string, string>): Promise<AuthFormResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      return {
        ok: false,
        code: extractCode(payload),
        status: response.status,
        message: extractMessage(payload, response.statusText),
      };
    }
    if (!isAuthSession(payload)) {
      return { ok: false, message: "Authentication response was invalid" };
    }
    return { ok: true, session: payload };
  } catch {
    return { ok: false, message: "Unable to reach authentication service" };
  }
}

async function submitVerificationForm(
  path: string,
  body: Record<string, string>,
): Promise<AuthFormResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      return {
        ok: false,
        code: extractCode(payload),
        status: response.status,
        message: extractMessage(payload, response.statusText),
      };
    }
    if (!isAuthVerificationResult(payload)) {
      return { ok: false, message: "Verification response was invalid" };
    }
    return { ok: true, verification: payload };
  } catch {
    return { ok: false, message: "Unable to reach authentication service" };
  }
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.expiresAt === "string" &&
    isRecord(value.identity)
  );
}

function isAuthVerificationResult(value: unknown): value is AuthVerificationResult {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.status === "string" && typeof value.message === "string";
}

function extractCode(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }
  return typeof payload.error.code === "string" ? payload.error.code : undefined;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload)) {
    const error = payload.error;
    if (isRecord(error) && typeof error.message === "string") {
      return error.message;
    }
    if (typeof payload.message === "string") {
      return payload.message;
    }
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
  }
  return fallback || "Authentication failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
