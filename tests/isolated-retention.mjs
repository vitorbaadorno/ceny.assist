import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { runRetention } from "../scripts/retention-policy.mjs";
import { collectHealth } from "../scripts/operations-health.mjs";
const config = JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"));
assert.ok(["localhost", "127.0.0.1"].includes(new URL(config.API_URL).hostname));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const user = createClient(config.API_URL, config.ANON_KEY, options);
const email = `retention-${randomUUID()}@test.invalid`,
  password = `Synthetic!${randomUUID()}Aa1`;
assert.ifError((await admin.auth.admin.createUser({ email, password, email_confirm: true })).error);
assert.ifError((await user.auth.signInWithPassword({ email, password })).error);
const company = await user.rpc("create_company", {
  p_name: "Synthetic retention",
  p_responsible: "Synthetic owner",
});
assert.ifError(company.error);
const old = randomUUID(),
  held = randomUUID(),
  recent = randomUUID();
for (const id of [old, held, recent]) {
  assert.ifError(
    (
      await admin.from("candidates").insert({
        id,
        company_id: company.data,
        nome: "Synthetic",
        created_at: new Date(Date.now() - (id === recent ? 1 : 100) * 86400000).toISOString(),
        arquivo_original_path: `${company.data}/${id}/original`,
      })
    ).error,
  );
}
assert.ifError(
  (
    await user.rpc("set_privacy_hold", {
      p_company: company.data,
      p_candidate: held,
      p_reason: "Synthetic legal hold for integration",
      p_review_at: new Date(Date.now() + 86400000).toISOString(),
      p_release: null,
    })
  ).error,
);
const policy = {
  version: 1,
  company_id: company.data,
  approval_reference: "Synthetic test approval only",
  approved_by: "synthetic",
  approved_at: new Date(Date.now() - 86400000).toISOString(),
  review_at: new Date(Date.now() + 86400000).toISOString(),
  candidate_days: 30,
  basis: "candidate_created_at",
};
const dry = await runRetention(user, policy);
assert.equal(dry.eligible, 1);
assert.equal(dry.held, 1);
assert.equal(dry.queued, 0);
const executed = await runRetention(user, policy, { execute: true });
assert.equal(executed.queued, 1);
const erasures = await admin
  .from("privacy_erasure_operations")
  .select("candidate_ids")
  .eq("company_id", company.data);
assert.ifError(erasures.error);
assert.deepEqual(
  erasures.data.map((row) => row.candidate_ids),
  [[old]],
);
const health = await collectHealth(admin);
assert.ok(Object.values(health).every((value) => Number.isSafeInteger(value) && value >= 0));
console.log(
  "PASS approved retention dry-run/execution, legal hold, recent exclusion and aggregate operational monitoring",
);
await user.auth.signOut();
