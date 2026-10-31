import { isTrustedMutationRequest, untrustedOriginResponse } from "../origin";
import { clearAuthSessionCookie } from "../session";
import { clearMfaCookie } from "../mfa/cookie";

export async function POST(request: Request): Promise<Response> {
  if (!isTrustedMutationRequest(request)) return untrustedOriginResponse();
  await clearAuthSessionCookie();
  await clearMfaCookie();
  return Response.json({ ok: true });
}
