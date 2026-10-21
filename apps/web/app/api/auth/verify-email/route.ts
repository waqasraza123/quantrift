import { getServerApiProxyEnv } from "@/config/serverEnv";
import { isTrustedMutationRequest, untrustedOriginResponse } from "../origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isTrustedMutationRequest(request)) {
    return untrustedOriginResponse();
  }
  return proxyVerificationRequest(request, "/auth/email/verify");
}

async function proxyVerificationRequest(request: Request, path: string): Promise<Response> {
  const env = getServerApiProxyEnv();
  try {
    const response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": request.headers.get("content-type") || "application/json",
      },
      body: await request.text(),
      cache: "no-store",
    });
    return Response.json(await parseJson(response), {
      status: response.status,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: { code: "auth_backend_unavailable", message: "Unable to reach auth API" } },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}
