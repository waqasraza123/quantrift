import { isTrustedMutationRequest, untrustedOriginResponse } from "../origin";
import { clearAuthSessionCookie, isBackendAuthSession, setAuthSessionCookie } from "../session";
import { authErrorResponse, authResponseHeaders, requestAuthBackend } from "../backend";
import { clearMfaCookie, isBackendMfaChallenge, setMfaCookie } from "../mfa/cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isTrustedMutationRequest(request)) return untrustedOriginResponse();
  try {
    const { response, payload } = await requestAuthBackend("login", { method: "POST", body: await request.text() });
    if (!response.ok) return authErrorResponse(payload, response.status);
    if (isBackendMfaChallenge(payload)) {
      await clearAuthSessionCookie();
      await setMfaCookie(payload);
      return Response.json({ mfaRequired: true, nextAction: payload.nextAction, expiresAt: payload.expiresAt }, { headers: authResponseHeaders });
    }
    if (!isBackendAuthSession(payload)) return authErrorResponse(null, 502);
    await setAuthSessionCookie(payload.accessToken, payload.expiresAt);
    await clearMfaCookie();
    return Response.json({ expiresAt: payload.expiresAt, identity: payload.identity }, { headers: authResponseHeaders });
  } catch {
    return authErrorResponse(null, 502);
  }
}
