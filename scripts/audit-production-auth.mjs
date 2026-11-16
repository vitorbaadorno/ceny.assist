import { auditAuth } from "./auth-production-policy.mjs";
try {
  const ref = process.env.CENY_SUPABASE_PROJECT;
  if (!/^[a-z]{20}$/.test(ref ?? "") || !process.env.SUPABASE_ACCESS_TOKEN) throw new Error();
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error();
  const result = auditAuth(await response.json(), process.env.CENY_SITE_URL);
  console.log(JSON.stringify(result)); // Never persist the raw Auth config, which can contain SMTP secrets.
  if (!result.passed) process.exitCode = 1;
} catch {
  console.error(
    "Configuração hospedada não validada. Confira projeto, domínio e acesso à Management API.",
  );
  process.exitCode = 1;
}
