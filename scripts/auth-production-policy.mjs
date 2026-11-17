export function auditAuth(config, expectedOrigin) {
  const failures = [];
  const origin = new URL(expectedOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  )
    throw new Error("Informe a origem HTTPS publicada.");
  if (config.site_url !== origin.origin) failures.push("site_url");
  const redirects =
    typeof config.uri_allow_list === "string"
      ? config.uri_allow_list.split(",").filter(Boolean)
      : [];
  const required = [origin.origin + "/auth", origin.origin + "/reset-password"];
  if (
    !required.every((value) => redirects.includes(value)) ||
    redirects.some((value) => !required.includes(value))
  )
    failures.push("redirects");
  if (config.mailer_autoconfirm !== false) failures.push("email_confirmation");
  if (config.security_update_password_require_reauthentication !== true)
    failures.push("password_reauthentication");
  if (config.password_min_length < 12 || !Number.isInteger(config.password_min_length))
    failures.push("password_length");
  // Management API uses colon-separated character sets, not the CLI enum.
  // An escaped colon belongs to its character set (Supabase Auth decoding).
  const groups =
    typeof config.password_required_characters === "string"
      ? config.password_required_characters.split(/(?<!\\):/).map((s) => s.replaceAll("\\:", ":"))
      : [];
  if (
    ![/^[a-z]+$/, /^[A-Z]+$/, /^[0-9]+$/, /^[^a-zA-Z0-9\s]+$/].every((pattern) =>
      groups.some((group) => pattern.test(group)),
    )
  )
    failures.push("password_complexity");
  if (config.password_hibp_enabled !== true) failures.push("leaked_password_protection");
  if (config.external_anonymous_users_enabled !== false) failures.push("anonymous_signin");
  if (!Number.isInteger(config.jwt_exp) || config.jwt_exp > 3600 || config.jwt_exp < 300)
    failures.push("session_expiry");
  return { passed: failures.length === 0, failures };
}
