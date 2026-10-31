import { isMfaSetup, isMfaStatus, isRecord, isRecoveryCodes } from "@/lib/auth/mfa";
import { authErrorResponse, authResponseHeaders, requestAuthBackend } from "../../backend";
import { isTrustedMutationRequest, untrustedOriginResponse } from "../../origin";
import { isBackendAuthSession, setAuthSessionCookie } from "../../session";
import { clearMfaCookie, getMfaToken, isBackendMfaChallenge, setMfaCookie } from "../cookie";

type RouteContext = { params: Promise<{ action: string }> };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { action } = await context.params;
  if (action !== "status") return new Response(null, { status: 404 });
  return proxy(action, "GET");
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  if (!isTrustedMutationRequest(request)) return untrustedOriginResponse();
  const { action } = await context.params;
  if (!["setup", "verify", "recover", "cancel"].includes(action)) return new Response(null, { status: 404 });
  return proxy(action, "POST", action === "verify" || action === "recover" ? await request.text() : undefined);
}

async function proxy(action: string, method: "GET" | "POST", body?: string): Promise<Response> {
  const token = await getMfaToken();
  if (!token) return authErrorResponse({ error: { code: "mfa_challenge_expired", message: "This sign-in has expired. Sign in again to continue." } }, 401);
  try {
    const { response, payload } = await requestAuthBackend(`mfa/${action}`, { method, body, token });
    if (!response.ok) {
      if (isRecord(payload) && isRecord(payload.error) && (payload.error.code === "mfa_challenge_expired" || payload.error.code === "mfa_locked")) await clearMfaCookie();
      return authErrorResponse(payload, response.status);
    }
    if (action === "cancel") {
      await clearMfaCookie();
      return Response.json({ ok: true }, { headers: authResponseHeaders });
    }
    if (action === "recover" && isBackendMfaChallenge(payload)) {
      await setMfaCookie(payload);
      return Response.json({ mfaRequired: true, nextAction: payload.nextAction, expiresAt: payload.expiresAt }, { headers: authResponseHeaders });
    }
    if (action === "verify" && isBackendAuthSession(payload) && isRecord(payload) && payload.mfaVerified === true
      && (payload.recoveryCodes == null || isRecoveryCodes(payload.recoveryCodes))) {
      await setAuthSessionCookie(payload.accessToken, payload.expiresAt);
      await clearMfaCookie();
      return Response.json({ ok: true, recoveryCodes: payload.recoveryCodes ?? null }, { headers: authResponseHeaders });
    }
    if (action === "status" && isMfaStatus(payload)) {
      return Response.json({ nextAction: payload.nextAction, expiresAt: payload.expiresAt }, { headers: authResponseHeaders });
    }
    if (action === "setup" && isMfaSetup(payload)) {
      return Response.json({ secret: payload.secret, otpauthUri: payload.otpauthUri, issuer: payload.issuer }, { headers: authResponseHeaders });
    }
    return authErrorResponse(null, 502);
  } catch {
    return authErrorResponse(null, 502);
  } finally {
    if (action === "cancel") await clearMfaCookie();
  }
}
