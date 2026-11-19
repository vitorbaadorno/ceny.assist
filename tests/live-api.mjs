// Requires explicit temporary accounts created in the authorized project.
// Never creates users or sends emails. Fixture credentials stay in ignored artifacts/.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const f = JSON.parse(fs.readFileSync("artifacts/live-fixtures.json", "utf8"));
const url = process.env.VITE_SUPABASE_URL,
  key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname, "wikerxujjvmoksrmjywo.supabase.co");
const clients = [];
for (const user of f.users) {
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({
    email: user + "@security-test.invalid",
    password: f.password,
  });
  assert.ifError(error);
  clients.push(c);
}
const [a, b] = clients;
const passed = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  passed.push(name);
};
if (process.argv.includes("--cleanup")) {
  for (let i = 0; i < clients.length; i++) {
    if (f.candidates?.[i]) {
      const { error } = await clients[i].storage
        .from("resumes")
        .remove([f.candidates[i].arquivo_original_path]);
      assert.ifError(error);
    }
    await clients[i].auth.signOut();
  }
  console.log("Temporary storage removed and sessions signed out.");
  process.exit(0);
}
if (!f.candidates) {
  f.candidates = [];
  f.jobs = [];
  for (let i = 0; i < clients.length; i++) {
    const { data: c, error } = await clients[i]
      .from("candidates")
      .insert({
        company_id: f.companies[i],
        nome: "Candidato de teste " + i,
        arquivo_nome: "teste.pdf",
      })
      .select()
      .single();
    assert.ifError(error);
    f.candidates.push(c);
    fs.writeFileSync("artifacts/live-fixtures.json", JSON.stringify(f));
    const upload = await clients[i].storage
      .from("resumes")
      .upload(
        c.arquivo_original_path,
        new Blob(["%PDF-1.4\nSynthetic security fixture\n%%EOF"], { type: "application/pdf" }),
      );
    assert.ifError(upload.error);
    const job = await clients[i]
      .from("jobs")
      .insert({ company_id: f.companies[i], titulo: "Vaga de teste " + i })
      .select()
      .single();
    assert.ifError(job.error);
    f.jobs.push(job.data);
    fs.writeFileSync("artifacts/live-fixtures.json", JSON.stringify(f));
  }
}
const all = await a.from("candidates").select("id,company_id");
assert.ifError(all.error);
check(
  "REST returns only own company",
  all.data.length === 1 && all.data.every((r) => r.company_id === f.companies[0]),
);
const foreign = await a.from("candidates").select("id").eq("id", f.candidates[1].id);
assert.ifError(foreign.error);
check("REST hides guessed foreign UUID", foreign.data.length === 0);
const tamper = await a
  .from("candidates")
  .update({ dados_extraidos: { forged: true } })
  .eq("id", f.candidates[0].id);
check("REST blocks AI output tampering", !!tamper.error);
const scores = await a.from("candidate_scores").insert({
  company_id: f.companies[0],
  candidate_id: f.candidates[0].id,
  job_id: f.jobs[0].id,
  score: 100,
});
check("REST blocks direct score insertion", !!scores.error);
const own = await a.storage.from("resumes").download(f.candidates[0].arquivo_original_path);
assert.ifError(own.error);
check("Storage downloads own original", !!own.data);
const download = await a.storage.from("resumes").download(f.candidates[1].arquivo_original_path);
check("Storage blocks foreign download", !!download.error);
const signed = await a.storage
  .from("resumes")
  .createSignedUrl(f.candidates[1].arquivo_original_path, 60);
check("Storage blocks foreign signed URL", !!signed.error);
const ownSigned = await a.storage
  .from("resumes")
  .createSignedUrl(f.candidates[0].arquivo_original_path, 60);
assert.ifError(ownSigned.error);
check("Storage signs authorized original", !!ownSigned.data.signedUrl);
const replace = await a.storage
  .from("resumes")
  .update(
    f.candidates[0].arquivo_original_path,
    new Blob(["changed"], { type: "application/pdf" }),
  );
check("Storage prevents original replacement", !!replace.error);
const remove = await a.storage.from("resumes").remove([f.candidates[1].arquivo_original_path]);
const remains = await b.storage.from("resumes").download(f.candidates[1].arquivo_original_path);
check("Storage prevents cross-company deletion", !!remains.data && !remains.error);
const archive = await a.rpc("archive_candidate", {
  p_company: f.companies[1],
  p_id: f.candidates[1].id,
});
check("RPC rejects cross-company archive", !!archive.error);
const forged = await a.functions.invoke("ceny-worker", {
  body: { action: "rank", companyId: f.companies[1], jobId: f.jobs[1].id },
});
check("Deployed worker rejects foreign company", !!forged.error);
const override = await a.functions.invoke("ceny-worker", {
  body: {
    action: "rank",
    companyId: f.companies[0],
    jobId: f.jobs[0].id,
    userId: f.users[1],
    score: 100,
  },
});
check("Deployed worker rejects forged actor and score input", !!override.error);
const rank = await a.functions.invoke("ceny-worker", {
  body: { action: "rank", companyId: f.companies[0], jobId: f.jobs[0].id },
});
assert.ifError(rank.error);
check("Deployed worker ranks authorized company", typeof rank.data.count === "number");
const anonymous = await fetch(url + "/functions/v1/ceny-worker", {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ action: "rank", companyId: f.companies[0], jobId: f.jobs[0].id }),
});
check("Deployed worker rejects anonymous request", anonymous.status === 401);
const evidence = {
  project: "wikerxujjvmoksrmjywo",
  at: new Date().toISOString(),
  passed: passed.length,
  tests: passed,
  ranked: rank.data.count,
};
fs.writeFileSync("artifacts/live-api-results.json", JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
