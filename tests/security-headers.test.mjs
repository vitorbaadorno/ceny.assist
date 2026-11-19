import test from "node:test";
import assert from "node:assert/strict";
import { securityHeaders, secureResponse } from "../src/lib/security-headers.ts";
test("production CSP uses nonce, exact backend and denies embedding on successes and failures", () => {
  const nonce = "a".repeat(32);
  const h = securityHeaders(
    new Request("https://app.example.invalid/auth"),
    nonce,
    "https://backend.example.invalid",
  );
  const csp = h.get("Content-Security-Policy");
  assert.ok(csp.includes(`script-src 'self' 'nonce-${nonce}'`));
  assert.ok(!csp.includes("unsafe-eval"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("connect-src 'self' https://backend.example.invalid"));
  assert.equal(h.get("Strict-Transport-Security"), "max-age=31536000");
  for (const status of [200, 401, 403, 500]) {
    const r = secureResponse(new Response("synthetic", { status }), h);
    assert.equal(r.status, status);
    assert.equal(r.headers.get("Cache-Control"), "private, no-store");
    assert.equal(r.headers.get("X-Content-Type-Options"), "nosniff");
  }
  assert.equal(
    securityHeaders(new Request("http://localhost:8080"), nonce).has("Strict-Transport-Security"),
    false,
  );
  assert.throws(() => securityHeaders(new Request("https://app.example.invalid"), "injected"));
});
