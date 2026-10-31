import "server-only";

import { getServerApiProxyEnv } from "@/config/serverEnv";
import { isRecord } from "@/lib/auth/mfa";

export const authResponseHeaders = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

export async function requestAuthBackend(path: string, options: { method: "GET" | "POST"; body?: string; token?: string }) {
  const env = getServerApiProxyEnv();
  const response = await fetch(`${env.apiBaseUrl}/auth/${path}`, {
    method: options.method,
    headers: {
      accept: "application/json", "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  const payload: unknown = response.status === 204 ? null : await response.json();
  return { response, payload };
}

export function authErrorResponse(payload: unknown, status: number): Response {
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
  return Response.json({ error: {
    code: error && typeof error.code === "string" ? error.code : "auth_backend_unavailable",
    message: error && typeof error.message === "string" ? error.message : "Unable to complete authentication. Please try again.",
  } }, { status: status >= 400 && status <= 599 ? status : 502, headers: authResponseHeaders });
}
