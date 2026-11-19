import { allowSyntheticRegistration } from "./local-pilot-registration.mjs";
// Real concurrent requests against the disposable local Supabase. No AI calls.
import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const config = JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"));
assert.ok(["127.0.0.1", "localhost"].includes(new URL(config.API_URL).hostname));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, passed: true });
  console.log("PASS", name);
}
async function account() {
  const email = `review-${randomUUID()}@test.invalid`,
    password = `Test!${randomUUID()}Aa1`;
  allowSyntheticRegistration(config, email);
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  const client = createClient(config.API_URL, config.ANON_KEY, options);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  return { client, id: created.data.user.id };
}
const a = await account(),
  b = await account();
try {
  const company = await a.client.rpc("create_company", {
    p_name: "Review concurrency",
    p_responsible: "Synthetic reviewer",
  });
  assert.ifError(company.error);
  assert.ifError(
    (
      await admin
        .from("company_members")
        .insert({ company_id: company.data, user_id: b.id, role: "recruiter" })
    ).error,
  );
  const created = await admin
    .from("candidates")
    .insert({
      company_id: company.data,
      created_by: a.id,
      processing_status: "concluido",
      dados_extraidos: { nome_completo: "Ana synthetic", skills: ["SQL"] },
    })
    .select()
    .single();
  assert.ifError(created.error);
  const candidate = created.data;
  const args = {
    p_company: company.data,
    p_candidate: candidate.id,
    p_expected_version: candidate.review_version,
    p_complete: false,
    p_confirmed: false,
  };
  await check(
    "simultaneous reviewers produce one save and one explicit version conflict",
    async () => {
      const responses = await Promise.all([
        a.client.rpc("save_candidate_review", { ...args, p_patch: { localizacao: "Cidade A" } }),
        b.client.rpc("save_candidate_review", { ...args, p_patch: { localizacao: "Cidade B" } }),
      ]);
      assert.equal(responses.filter((r) => !r.error).length, 1);
      assert.equal(responses.filter((r) => r.error?.code === "40001").length, 1);
      const rows = await a.client
        .from("candidate_revisions")
        .select()
        .eq("candidate_id", candidate.id);
      assert.ifError(rows.error);
      assert.equal(rows.data.length, 1);
      assert.ok([a.id, b.id].includes(rows.data[0].actor_id));
    },
  );
  await check(
    "review completion freezes confirmed nulls and all fields across AI rereading",
    async () => {
      const current = await a.client.from("candidates").select().eq("id", candidate.id).single();
      assert.ifError(current.error);
      const saved = await a.client.rpc("save_candidate_review", {
        ...args,
        p_expected_version: current.data.review_version,
        p_patch: { nome_completo: "Nome confirmado", email: null },
        p_complete: true,
        p_confirmed: true,
      });
      assert.ifError(saved.error);
      const extracted = await admin.rpc("save_candidate_extraction", {
        p_actor: a.id,
        p_company: company.data,
        p_id: candidate.id,
        p_extraction: {
          nome_completo: "Outro nome da IA",
          email: "new@example.test",
          skills: ["Rust"],
        },
        p_status: "concluido",
      });
      assert.ifError(extracted.error);
      const next = await a.client.from("candidates").select().eq("id", candidate.id).single();
      assert.ifError(next.error);
      assert.equal(next.data.nome, "Nome confirmado");
      assert.equal(next.data.email, null);
      assert.deepEqual(next.data.skills, ["SQL"]);
      assert.equal(next.data.dados_extraidos.nome_completo, "Outro nome da IA");
    },
  );
  await check(
    "removed reviewer cannot save or consult revision history with existing session",
    async () => {
      assert.ifError(
        (
          await admin
            .from("company_members")
            .delete()
            .eq("company_id", company.data)
            .eq("user_id", b.id)
        ).error,
      );
      const denied = await b.client.rpc("save_candidate_review", {
        ...args,
        p_patch: { nome_completo: "Attack" },
      });
      assert.equal(denied.error?.code, "42501");
      const hidden = await b.client
        .from("candidate_revisions")
        .select()
        .eq("candidate_id", candidate.id);
      assert.ifError(hidden.error);
      assert.equal(hidden.data.length, 0);
    },
  );
} finally {
  await Promise.all([a.client.auth.signOut(), b.client.auth.signOut()]);
  fs.writeFileSync(
    "artifacts/review-results.json",
    JSON.stringify({ passed: results.length, tests: results }, null, 2),
  );
  // The workflow discards the entire database, even if an assertion fails.
}
