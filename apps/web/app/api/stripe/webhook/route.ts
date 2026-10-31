import { getServerApiProxyEnv } from "@/config/serverEnv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") || 0) > 1_048_576) return new Response(null, { status: 413 });
  const body = await request.arrayBuffer();
  if (body.byteLength > 1_048_576) return new Response(null, { status: 413 });
  try {
    const response = await fetch(`${getServerApiProxyEnv().apiBaseUrl}/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": request.headers.get("stripe-signature") || "" },
      body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
    });
    return new Response(await response.arrayBuffer(), { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "billing_backend_unavailable", message: "Billing is temporarily unavailable." } }, { status: 503 });
  }
}
