export function securityHeaders(
  request: Request,
  nonce: string,
  backend?: string,
  development = false,
) {
  if (!/^[a-f0-9]{32}$/.test(nonce)) throw new Error("Nonce inválido.");
  const origins = ["'self'"];
  if (backend) {
    const url = new URL(backend);
    if (
      url.protocol === "https:" ||
      (development && ["localhost", "127.0.0.1"].includes(url.hostname))
    ) {
      origins.push(url.origin);
    }
  }
  const headers = new Headers({
    "Content-Security-Policy": [
      "default-src 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src ${origins.join(" ")}${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cache-Control": "private, no-store",
  });
  if (new URL(request.url).protocol === "https:")
    headers.set("Strict-Transport-Security", "max-age=31536000");
  return headers;
}

export function secureResponse(response: Response, headers: Headers) {
  const merged = new Headers(response.headers);
  headers.forEach((value, name) => merged.set(name, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}
