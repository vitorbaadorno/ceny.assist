import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const config = JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"));
assert.ok(["127.0.0.1", "localhost"].includes(new URL(config.API_URL).hostname));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const user = createClient(config.API_URL, config.ANON_KEY, options);
async function checked(promise) {
  const { data, error } = await promise;
  assert.ifError(error);
  return data;
}
const email = "ops-" + randomUUID() + "@test.invalid",
  password = "Test!" + randomUUID();
const { user: owner } = await checked(
  admin.auth.admin.createUser({ email, password, email_confirm: true }),
);
await checked(user.auth.signInWithPassword({ email, password }));
const company = await checked(
  user.rpc("create_company", { p_name: "Limits fixture", p_responsible: "Synthetic owner" }),
);
await checked(
  user.rpc("ops_configure", {
    p_company: company,
    p_version: 0,
    p_upload: 1,
    p_analysis: 1,
    p_warn: 80,
    p_activity_days: 90,
    p_error_days: 30,
  }),
);
const batches = await Promise.all(
  [1, 2].map(() =>
    checked(user.rpc("begin_resume_batch", { p_company: company, p_source: "email", p_count: 1 })),
  ),
);
const args = (batch, index) => ({
  p_actor: owner.id,
  p_company: company,
  p_batch: batch,
  p_slot: 0,
  p_sha: String(index + 1).repeat(64),
  p_filename: "test.pdf",
  p_mime: "application/pdf",
  p_size: 100,
  p_pages: 1,
  p_candidate: null,
});
const reservations = await Promise.all(
  batches.map((batch, i) => admin.rpc("reserve_resume_version", args(batch, i))),
);
const winner = reservations.findIndex((result) => !result.error);
assert.notEqual(winner, -1);
assert.equal(reservations[1 - winner].error?.code, "P5401");
const first = reservations[winner].data;
await checked(admin.rpc("reserve_resume_version", args(batches[winner], winner)));
await checked(
  admin.rpc("finish_resume_upload", {
    p_actor: owner.id,
    p_company: company,
    p_document: first.documentId,
    p_token: first.token,
  }),
);
const keys = [randomUUID(), randomUUID()];
const request = (key) =>
  checked(
    user.rpc("request_document_analysis", {
      p_company: company,
      p_document: first.documentId,
      p_request: key,
    }),
  );
const ids = await Promise.all(keys.map(request));
assert.equal(ids[0], ids[1]);
await checked(
  user.rpc("control_resume_job", { p_company: company, p_job: ids[0], p_action: "cancel" }),
);
assert.equal(await request(keys[1]), ids[0]);
const extra = await user.rpc("request_document_analysis", {
  p_company: company,
  p_document: first.documentId,
  p_request: randomUUID(),
});
assert.equal(extra.error?.code, "P5402");
const q = await checked(user.rpc("ops_quota_status", { p_company: company }));
assert.equal(q.uploads_used, 1);
assert.equal(q.analyses_used, 1);
console.log(
  "PASS concurrent last-slot admission, duplicate upload, coalesced analysis, replay and reprocessing cap",
);
await user.auth.signOut();
