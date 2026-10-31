import { clearMfaCookie } from "../mfa/cookie";
import { getServerApiProxyEnv } from "@/config/serverEnv";
import { isTrustedMutationRequest, untrustedOriginResponse } from "../origin";
import { clearAuthSessionCookie, getAuthSessionToken } from "../session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isTrustedMutationRequest(request)) {
    return untrustedOriginResponse();
  }
  await clearMfaCookie();
  const env = getServerApiProxyEnv();
  const token = await getAuthSessionToken();
  if (token) {
    try {
      await fetch(`${env.apiBaseUrl}/auth/logout`, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      await clearAuthSessionCookie();
      return Response.json({ ok: true });
    }
  }
  await clearAuthSessionCookie();
  return Response.json({ ok: true });
}
