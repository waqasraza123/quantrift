import { getServerApiProxyEnv } from "@/config/serverEnv";
import { isTrustedMutationRequest, untrustedOriginResponse } from "../origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isTrustedMutationRequest(request)) {
    return untrustedOriginResponse();
  }
  const env = getServerApiProxyEnv();
  const body = await request.text();
  try {
    const response = await fetch(`${env.apiBaseUrl}/auth/register`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": request.headers.get("content-type") || "application/json",
      },
      body,
      cache: "no-store",
    });
    const payload = await parseJson(response);
    return Response.json(payload, {
      status: response.status,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: { code: "auth_backend_unavailable", message: "Unable to reach auth API" } },
      { status: 502 },
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
