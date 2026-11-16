// Run from protected external infrastructure, with encrypted immutable destination storage.
import { createClient } from "@supabase/supabase-js";
import { signLedger, verifyLedger } from "./privacy-ledger.mjs";
import { recoveryKey, encryptRecovery, decryptRecovery } from "./recovery-crypto.mjs";
import { assertLedgerFresh, assertLedgerContinuity } from "./ledger-continuity.mjs";
import fs from "node:fs/promises";
import path from "node:path";

try {
  const directory = path.resolve(process.env.CENY_EXTERNAL_LEDGER_DIRECTORY ?? "");
  const relative = path.relative(process.cwd(), directory);
  if (!process.env.CENY_EXTERNAL_LEDGER_DIRECTORY || (!relative.startsWith("..") && !path.isAbsolute(relative))) throw new Error();
  const key = recoveryKey(process.env.CENY_BACKUP_ENCRYPTION_KEY);
  const signing = process.env.CENY_RECOVERY_SIGNING_KEY;
  const source = process.env.CENY_RECOVERY_SOURCE_PROJECT;
  const url = new URL(process.env.SUPABASE_URL);
  if (url.protocol !== "https:" || url.hostname !== `${source}.supabase.co`) throw new Error();
  const admin = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(30000) }) },
  });
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  // A lock prevents overlapping exporters from accepting divergent snapshots.
  const lock = await fs.open(path.join(directory, ".ledger-lock"), "wx", 0o600);
  try {
    const priorFiles = (await fs.readdir(directory)).filter(f => /^ledger-\d{13}\.enc$/.test(f)).sort();
    const { data, error } = await admin.rpc("export_privacy_ledger");
    if (error || !data) throw new Error();
    const envelope = signLedger({ ...data, project: source }, signing);
    const ledger = verifyLedger(envelope, signing, source);
    assertLedgerFresh(ledger);
    if (priorFiles.length) {
      const previous = verifyLedger(JSON.parse(decryptRecovery(await fs.readFile(path.join(directory, priorFiles.at(-1))), key)), signing, source);
      assertLedgerContinuity(previous, ledger);
    }
    const file = path.join(directory, `ledger-${Date.now()}.enc`);
    await fs.writeFile(file, encryptRecovery(Buffer.from(JSON.stringify(envelope)), key), { flag: "wx", mode: 0o600 });
    const check = verifyLedger(JSON.parse(decryptRecovery(await fs.readFile(file), key)), signing, source);
    assertLedgerFresh(check);
    console.log(JSON.stringify({ verified: true, exported_at: check.exported_at }));
  } finally {
    await lock.close();
    await fs.unlink(path.join(directory, ".ledger-lock"));
  }
} catch {
  console.error("Replicação não confirmada. Preserve os manifestos anteriores e acione o responsável.");
  process.exitCode = 1;
}
