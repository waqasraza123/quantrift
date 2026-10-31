const defaultDestination = "/command-center";
const localOrigin = "https://quantrift.invalid";
const authRoutes = new Set(["/login", "/register", "/signup", "/verify-email", "/mfa"]);

export function safeAuthDestination(value?: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return defaultDestination;
  try {
    const destination = new URL(value, localOrigin);
    const decodedPath = decodeURIComponent(destination.pathname).replace(/\/+$/, "") || "/";
    if (destination.origin !== localOrigin || decodedPath.startsWith("//") || decodedPath.includes("\\") || authRoutes.has(decodedPath) || decodedPath === "/api" || decodedPath.startsWith("/api/")) return defaultDestination;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return defaultDestination;
  }
}

export function authModeHref(mode: "login" | "register", nextPath?: string): string {
  const path = `/${mode}`;
  if (!nextPath) return path;
  return `${path}?${new URLSearchParams({ next: safeAuthDestination(nextPath) })}`;
}
