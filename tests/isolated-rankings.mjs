// HTTP integration against disposable localhost Supabase only. Never calls AI.
import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const config = JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"));
assert.ok(["127.0.0.1", "localhost"].includes(new URL(config.API_URL).hostname));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const users = [],
  results = [];
async function account() {
  const email = `ranking-${randomUUID()}@test.invalid`,
    password = `Test!${randomUUID()}Aa1`;
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(r.error);
  users.push(r.data.user.id);
  const client = createClient(config.API_URL, config.ANON_KEY, options);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  return { id: r.data.user.id, client };
}
async function check(name, fn) {
  await fn();
  results.push({ name, passed: true });
  console.log("PASS", name);
}
try {
  const a = await account();
  const company = await a.client.rpc("create_company", {
    p_name: "Ranking test",
    p_responsible: "Synthetic owner",
  });
  assert.ifError(company.error);
  const j = await a.client.rpc("save_job", {
    p_company: company.data,
    p_job: null,
    p_expected_version: 0,
    p_approve: true,
    p_payload: {
      titulo: "Analista SQL",
      descricao: "Análise de sistemas com SQL.",
      categoria: "regular",
      criteria: [
        { kind: "skill", text: "SQL", required: true, weight: 5, min_years: null, source: null },
      ],
    },
  });
  assert.ifError(j.error);
  const base = {
    company_id: company.data,
    created_by: a.id,
    processing_status: "concluido",
    review_status: "completed",
    dados_extraidos: { nome_completo: "Fixture", skills: ["SQL"] },
  };
  const candidates = Array.from({ length: 1201 }, () => ({ ...base, id: randomUUID() }));
  for (let i = 0; i < candidates.length; i += 200)
    assert.ifError((await admin.from("candidates").insert(candidates.slice(i, i + 200))).error);
  assert.ifError(
    (
      await admin.from("candidates").insert([
        { ...base, review_status: "pending" },
        { ...base, processing_status: "erro", review_status: "pending" },
      ])
    ).error,
  );
  const args = { p_actor: a.id, p_company: company.data, p_job: j.data.id };
  const invoke = (requestId) =>
    a.client.functions.invoke("ceny-worker", {
      body: { action: "rank", requestId, companyId: company.data, jobId: j.data.id },
    });
  await check("simultaneous different requests acquire only one active run", async () => {
    const calls = await Promise.all([
      admin.rpc("begin_ranking", { ...args, p_request: randomUUID() }),
      admin.rpc("begin_ranking", { ...args, p_request: randomUUID() }),
    ]);
    assert.equal(calls.filter((r) => !r.error).length, 1);
    assert.equal(calls.filter((r) => r.error?.code === "55000").length, 1);
    assert.ifError(
      (
        await admin.rpc("fail_ranking", {
          p_actor: a.id,
          p_run: calls.find((r) => !r.error).data.id,
        })
      ).error,
    );
  });
  const requestId = randomUUID();
  let published;
  await check(
    "concurrent identical HTTP requests produce one full 1201-candidate ranking",
    async () => {
      const calls = await Promise.all([invoke(requestId), invoke(requestId)]);
      for (const r of calls) {
        assert.ifError(r.error);
        assert.equal(r.data.count, 1201);
        assert.equal(r.data.pending, 2);
      }
      assert.equal(calls[0].data.runId, calls[1].data.runId);
      published = calls[0].data.runId;
      const count = await a.client
        .from("candidate_scores")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.data)
        .eq("job_id", j.data.id);
      assert.ifError(count.error);
      assert.equal(count.count, 1201);
      const pending = await a.client
        .from("ranking_entries")
        .select("reason,score")
        .eq("run_id", published)
        .not("reason", "is", null);
      assert.ifError(pending.error);
      assert.equal(pending.data.length, 2);
      assert.ok(pending.data.every((e) => e.reason && e.score === null));
    },
  );
  await check("repeating a completed HTTP request creates no duplicate history", async () => {
    const again = await invoke(requestId);
    assert.ifError(again.error);
    assert.equal(again.data.runId, published);
    const runs = await a.client
      .from("ranking_runs")
      .select("id")
      .eq("company_id", company.data)
      .eq("request_id", requestId);
    assert.ifError(runs.error);
    assert.equal(runs.data.length, 1);
  });
  await check(
    "new run snapshots remain stable and review conflict preserves old publication",
    async () => {
      const started = await admin.rpc("begin_ranking", { ...args, p_request: randomUUID() });
      assert.ifError(started.error);
      const reviewed = await a.client.rpc("save_candidate_review", {
        p_company: company.data,
        p_candidate: candidates[0].id,
        p_expected_version: 0,
        p_patch: { skills: ["Java"] },
        p_complete: true,
        p_confirmed: true,
      });
      // Parameter names mirror the actual public review RPC (verified below by integration).
      assert.ifError(reviewed.error);
      const failed = await admin.rpc("finish_ranking", { p_actor: a.id, p_run: started.data.id });
      assert.equal(failed.error?.code, "40001");
      const latest = await a.client
        .from("candidate_scores")
        .select("run_id,stale")
        .eq("job_id", j.data.id)
        .limit(1);
      assert.ifError(latest.error);
      assert.equal(latest.data[0].run_id, published);
      assert.equal(latest.data[0].stale, true);
      const old = await a.client
        .from("ranking_entries")
        .select("snapshot")
        .eq("run_id", published)
        .eq("candidate_id", candidates[0].id)
        .single();
      assert.ifError(old.error);
      assert.deepEqual(old.data.snapshot.dados_efetivos.skills, ["SQL"]);
    },
  );
} finally {
  fs.writeFileSync("artifacts/ranking-results.json", JSON.stringify(results, null, 2));
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
