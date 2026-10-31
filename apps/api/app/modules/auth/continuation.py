from urllib.parse import unquote, urlsplit


def safe_continuation(value: str | None) -> str:
    if not value or not value.startswith("/") or value.startswith("//"):
        return "/command-center"
    parsed = urlsplit(value)
    decoded = unquote(parsed.path)
    if parsed.netloc or parsed.scheme or decoded.startswith("//") or "\\" in value or any(
        ord(char) < 32 or ord(char) == 127 for char in value
    ) or decoded.startswith("/api/") or decoded.rstrip("/") in {
        "/api", "/login", "/register", "/signup", "/verify-email", "/mfa",
    }:
        return "/command-center"
    return parsed.path + (f"?{parsed.query}" if parsed.query else "")
