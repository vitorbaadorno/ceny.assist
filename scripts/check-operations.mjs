import { createClient } from "@supabase/supabase-js";
import { collectHealth, evaluateHealth } from "./operations-health.mjs";
try {
  const base = new URL(process.env.SUPABASE_URL);
  const site = new URL(process.env.CENY_SITE_URL);
  if (base.protocol !== "https:" || site.protocol !== "https:" || base.username || site.username) throw new Error();
  const admin = createClient(base.href, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) }) },
  });
  const response = await fetch(site, { redirect: "error", signal: AbortSignal.timeout(15000) });
  await response.body?.cancel();
  const last = Date.parse(process.env.CENY_LAST_VERIFIED_LEDGER_AT ?? "");
  const result = evaluateHealth({ ...await collectHealth(admin), reachable: response.ok,
    ledger_age_minutes: Number.isFinite(last) ? (Date.now() - last) / 60000 : null });
  console.log(JSON.stringify(result));
  if (!result.healthy) process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ healthy: false, alerts: ["monitor_unavailable"] }));
  process.exitCode = 1;
}
