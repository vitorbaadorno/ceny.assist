// Real HTTP requests against disposable local Supabase only. No AI calls.
import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const config = JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"));
assert.ok(["127.0.0.1", "localhost"].includes(new URL(config.API_URL).hostname));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const users = [];
const results = [];
async function account() {
  const email = `job-${randomUUID()}@test.invalid`,
    password = `Test!${randomUUID()}Aa1`;
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(r.error);
  users.push(r.data.user.id);
  const client = createClient(config.API_URL, config.ANON_KEY, options);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  return { client, id: r.data.user.id };
}
async function check(name, fn) {
  await fn();
  results.push({ name, passed: true });
  console.log("PASS", name);
}
const criterion = (text, weight, required = false) => ({
  kind: "skill",
  text,
  weight,
  required,
  min_years: null,
  source: null,
});
try {
  const a = await account(),
    b = await account();
  const company = await a.client.rpc("create_company", {
    p_name: "Job integration",
    p_responsible: "Synthetic owner",
  });
  assert.ifError(company.error);
  assert.ifError(
    (
      await admin
        .from("company_members")
        .insert({ company_id: company.data, user_id: b.id, role: "recruiter" })
    ).error,
  );
  const payload = {
    titulo: "Analista",
    descricao: "Atendimento profissional com SQL e Java.",
    categoria: "regular",
    criteria: [criterion("SQL", 15), criterion("Java", 5)],
  };
  const saved = await a.client.rpc("save_job", {
    p_company: company.data,
    p_job: null,
    p_expected_version: 0,
    p_payload: payload,
    p_approve: true,
  });
  assert.ifError(saved.error);
  let job = saved.data;
  const c = await admin
    .from("candidates")
    .insert({
      company_id: company.data,
      created_by: a.id,
      processing_status: "concluido",
      review_status: "completed",
      dados_extraidos: { nome_completo: "Synthetic candidate", skills: ["SQL"] },
    })
    .select()
    .single();
  assert.ifError(c.error);
  await check("worker uses approved weighted criteria and stamps version", async () => {
    const r = await a.client.functions.invoke("ceny-worker", {
      body: { action: "rank", requestId: randomUUID(), companyId: company.data, jobId: job.id },
    });
    assert.ifError(r.error);
    assert.equal(r.data.count, 1);
    const scores = await a.client.from("candidate_scores").select().eq("job_id", job.id);
    assert.ifError(scores.error);
    assert.equal(scores.data[0].score, 75);
    assert.equal(scores.data[0].job_version, job.version);
    assert.equal(scores.data[0].criteria_hash, job.approved_hash);
  });
  await check("two editors produce one save and one conflict", async () => {
    const args = {
      p_company: company.data,
      p_job: job.id,
      p_expected_version: job.version,
      p_approve: false,
    };
    const responses = await Promise.all([
      a.client.rpc("save_job", { ...args, p_payload: { ...payload, titulo: "Analista A" } }),
      b.client.rpc("save_job", { ...args, p_payload: { ...payload, titulo: "Analista B" } }),
    ]);
    assert.equal(responses.filter((r) => !r.error).length, 1);
    assert.equal(responses.filter((r) => r.error?.code === "40001").length, 1);
    job = responses.find((r) => !r.error).data;
    assert.equal(job.approved_hash, null);
    const scores = await a.client.from("candidate_scores").select().eq("job_id", job.id);
    assert.equal(scores.data[0].stale, true);
  });
  await check("draft and closed jobs cannot be ranked; closing preserves candidates", async () => {
    const invoke = () =>
      a.client.functions.invoke("ceny-worker", {
        body: { action: "rank", requestId: randomUUID(), companyId: company.data, jobId: job.id },
      });
    assert.ok((await invoke()).error);
    const approved = await a.client.rpc("save_job", {
      p_company: company.data,
      p_job: job.id,
      p_expected_version: job.version,
      p_payload: payload,
      p_approve: true,
    });
    assert.ifError(approved.error);
    job = approved.data;
    const closed = await a.client.rpc("set_job_status", {
      p_company: company.data,
      p_job: job.id,
      p_expected_version: job.version,
      p_status: "encerrada",
    });
    assert.ifError(closed.error);
    job = closed.data;
    assert.ok((await invoke()).error);
    const candidates = await a.client.from("candidates").select("id").eq("id", c.data.id);
    assert.equal(candidates.data.length, 1);
    const reopened = await a.client.rpc("set_job_status", {
      p_company: company.data,
      p_job: job.id,
      p_expected_version: job.version,
      p_status: "aberta",
    });
    assert.ifError(reopened.error);
    assert.ifError((await invoke()).error);
  });
} finally {
  fs.writeFileSync("artifacts/job-results.json", JSON.stringify(results, null, 2));
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
