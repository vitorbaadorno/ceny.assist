// Actual Storage API deletion and logical backup/recovery, only disposable localhost.
import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { runPrivacyQueue } from "../supabase/functions/_shared/privacy-queue.ts";
import { signLedger, verifyLedger } from "../scripts/privacy-ledger.mjs";
const config = JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"));
assert.ok(["localhost", "127.0.0.1"].includes(new URL(config.API_URL).hostname));
assert.ok(["localhost", "127.0.0.1"].includes(new URL(config.DB_URL).hostname));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options),
  user = createClient(config.API_URL, config.ANON_KEY, options);
const email = `privacy-${randomUUID()}@test.invalid`,
  password = `Test!${randomUUID()}Aa1`;
let r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
assert.ifError(r.error);
r = await user.auth.signInWithPassword({ email, password });
assert.ifError(r.error);
r = await user.rpc("create_company", {
  p_name: "Privacy recovery synthetic",
  p_responsible: "Synthetic operator",
});
assert.ifError(r.error);
const company = r.data;
const candidate = randomUUID();
r = await admin
  .from("candidates")
  .insert({ id: candidate, company_id: company, nome: "Synthetic recovery" });
assert.ifError(r.error);
const path = `${company}/${candidate}/original`,
  bytes = Buffer.from("Synthetic original backup bytes");
r = await admin.storage.from("resumes").upload(path, bytes, { contentType: "application/pdf" });
assert.ifError(r.error);
// Real SQL logical backup of the synthetic row; no secrets or dumps uploaded as artifacts.
const backup = execFileSync(
  "psql",
  [
    config.DB_URL,
    "-At",
    "-c",
    `select row_to_json(c) from public.candidates c where id='${candidate}'`,
  ],
  { encoding: "utf8" },
).trim();
const original = await admin.storage.from("resumes").download(path);
assert.ifError(original.error);
const objectBackup = Buffer.from(await original.data.arrayBuffer());
assert.deepEqual(objectBackup, bytes);
r = await user.rpc("request_candidate_erasure", {
  p_company: company,
  p_candidate: candidate,
  p_confirmed_ids: [candidate],
  p_reason: "Synthetic subject request",
  p_request: randomUUID(),
});
assert.ifError(r.error);
const operation = r.data;
await runPrivacyQueue(admin);
r = await admin.from("privacy_erasure_operations").select("state").eq("id", operation).single();
assert.ifError(r.error);
assert.equal(r.data.state, "completed");
r = await admin.storage.from("resumes").download(path);
assert.ok(r.error);
r = await admin.rpc("export_privacy_ledger");
assert.ifError(r.error);
const signed = signLedger(
  { ...r.data, project: "synthetic-local" },
  "01234567890123456789012345678901",
);
const ledger = verifyLedger(signed, "01234567890123456789012345678901", "synthetic-local");
// Restore old data only in this isolated localhost database. No production endpoint allowed.
const restored = JSON.parse(backup);
delete restored.arquivo_original_path;
r = await admin.from("candidates").insert(restored);
assert.ifError(r.error);
r = await admin.storage
  .from("resumes")
  .upload(path, objectBackup, { contentType: "application/pdf" });
assert.ifError(r.error);
const erased = [
  ...new Set(
    ledger.erasures.filter((e) => e.company_id === company).flatMap((e) => e.candidate_ids),
  ),
];
r = await admin.rpc("reconcile_privacy_restore", { p_company: company, p_erased: erased });
assert.ifError(r.error);
r = await user.from("candidates").select("id").eq("company_id", company);
assert.ifError(r.error);
assert.deepEqual(r.data, []);
r = await user.rpc("preview_candidate_erasure", { p_company: company, p_candidate: candidate });
assert.ok(r.error);
await runPrivacyQueue(admin);
r = await admin.storage.from("resumes").download(path);
assert.ok(r.error);
r = await admin.from("candidates").select("id").eq("id", candidate);
assert.ifError(r.error);
assert.deepEqual(r.data, []);
fs.writeFileSync(
  "artifacts/privacy-recovery-results.json",
  JSON.stringify(
    {
      passed: true,
      checks: [
        "logical row and Storage bytes backed up",
        "actual API erasure completed",
        "signed external ledger verified",
        "old row and bytes restored in isolation",
        "restored membership revoked and old JWT denied",
        "restored erased row and original removed again",
      ],
      scope: "synthetic localhost only; does not certify hosted backup recovery",
    },
    null,
    2,
  ),
);
console.log("PASS privacy Storage deletion and isolated backup reconciliation");
