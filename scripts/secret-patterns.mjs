export function secretFindings(text, { browser = false } = {}) {
  const findings = [];
  const patterns = {
    google_key: /AIza[0-9A-Za-z_-]{35}/,
    private_key: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    github_token: /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})/,
    supabase_secret: /sb_secret_[A-Za-z0-9_-]{20,}/,
    credential_url:
      /(?:postgres(?:ql)?|https?):\/\/[^\s/:]+:[^\s/@]+@(?!127\.0\.0\.1|localhost)[^\s/]+/,
  };
  for (const [kind, pattern] of Object.entries(patterns))
    if (pattern.test(text)) findings.push(kind);
  for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(match[1], "base64url")).role === "service_role")
        findings.push("service_role_jwt");
    } catch {
      /* not a JWT */
    }
  }
  if (
    browser &&
    /GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|CENY_RECOVERY_SIGNING_KEY|LOVABLE_API_KEY|GOOGLE_MAPS_API_KEY/.test(
      text,
    )
  )
    findings.push("privileged_browser_reference");
  return [...new Set(findings)];
}
