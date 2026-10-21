export function isTrustedMutationRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return false;
  }
  if (fetchSite === "same-origin") {
    return true;
  }
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    if (originUrl.origin === requestUrl.origin) {
      return true;
    }
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0].trim();
    const requestHost = forwardedHost || request.headers.get("host");
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0].trim();
    const requestProtocol = forwardedProtocol || requestUrl.protocol.replace(":", "");
    return originUrl.host === requestHost && originUrl.protocol === `${requestProtocol}:`;
  } catch {
    return false;
  }
}

export function untrustedOriginResponse(): Response {
  return Response.json(
    { error: { code: "untrusted_origin", message: "Request origin is not allowed" } },
    { status: 403 },
  );
}
