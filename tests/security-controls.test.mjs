import test from "node:test";
import assert from "node:assert/strict";
import { auditAuth } from "../scripts/auth-production-policy.mjs";
import { secretFindings } from "../scripts/secret-patterns.mjs";
test("hosted Auth audit rejects wildcards, unconfirmed accounts and unsupported protections", () => {
  const config = {
    site_url: "https://ceny.example",
    uri_allow_list: "https://ceny.example/auth,https://ceny.example/reset-password",
    mailer_autoconfirm: false,
    security_update_password_require_reauthentication: true,
    password_min_length: 12,
    password_required_characters: "lower_upper_letters_digits_symbols",
    password_hibp_enabled: true,
    external_anonymous_users_enabled: false,
    jwt_exp: 3600,
  };
  assert.equal(auditAuth(config, config.site_url).passed, true);
  assert.ok(
    auditAuth({ ...config, uri_allow_list: "https://**" }, config.site_url).failures.includes(
      "redirects",
    ),
  );
  assert.equal(auditAuth({}, config.site_url).passed, false);
  assert.throws(() => auditAuth(config, "http://localhost"));
});
test("secret scan catches private keys and privileged bundles without returning values", () => {
  const token =
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") +
    ".synthetic";
  assert.deepEqual(secretFindings(token), ["service_role_jwt"]);
  assert.ok(secretFindings("AIza" + "x".repeat(35)).includes("google_key"));
  assert.ok(
    secretFindings("GEMINI_API_KEY", { browser: true }).includes("privileged_browser_reference"),
  );
  assert.deepEqual(secretFindings("sb_publishable_example"), []);
  assert.deepEqual(secretFindings('key.startsWith("sb_secret_")', { browser: true }), []);
  assert.ok(
    secretFindings("sb_secret_" + "x".repeat(24), { browser: true }).includes("supabase_secret"),
  );
  assert.ok(!JSON.stringify(secretFindings(token)).includes(token));
});
