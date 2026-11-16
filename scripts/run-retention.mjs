import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { runRetention } from "./retention-policy.mjs";

try {
  const [file, mode = "--dry-run"] = process.argv.slice(2);
  if (!file || !["--dry-run", "--execute"].includes(mode)) throw new Error();
  if (mode === "--execute" && process.env.CENY_RETENTION_EXECUTION_APPROVED !== "confirmed")
    throw new Error();
  // A current owner/admin access token, not service_role: RPC authorization stays effective.
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${process.env.CENY_ADMIN_ACCESS_TOKEN}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const policy = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(
    JSON.stringify(await runRetention(client, policy, { execute: mode === "--execute" })),
  );
} catch {
  console.error(
    "Retenção não concluída. Confira política aprovada, acesso administrativo e operações pendentes. Nenhum erro bruto foi registrado.",
  );
  process.exitCode = 1;
}
