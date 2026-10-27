// Real Edge Function + Storage integration; localhost only, synthetic fixtures.
import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { docxFixture, pdfFixture, pngFixture, jpegFixture } from "./resume-fixtures.mjs";
const config = JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"));
assert.ok(["127.0.0.1", "localhost"].includes(new URL(config.API_URL).hostname));
assert.ok(["127.0.0.1", "localhost"].includes(new URL(config.DB_URL).hostname));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options),
  user = createClient(config.API_URL, config.ANON_KEY, options);
const email = `uploads-${randomUUID()}@test.invalid`,
  password = `Test!${randomUUID()}Aa1`;
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
assert.ifError(createError);
const { data: auth, error: authError } = await user.auth.signInWithPassword({ email, password });
assert.ifError(authError);
const { data: company, error: companyError } = await user.rpc("create_company", {
  p_name: "Upload test",
  p_responsible: "Synthetic fixture",
});
assert.ifError(companyError);
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, passed: true });
  console.log("PASS", name);
}
async function batch(count = 5) {
  const { data, error } = await user.rpc("begin_resume_batch", {
    p_company: company,
    p_count: count,
    p_source: "email",
  });
  assert.ifError(error);
  return data;
}
async function send(name, bytes, batchId, slot = 0) {
  const params = new URLSearchParams({
    action: "upload",
    companyId: company,
    batchId,
    slot: String(slot),
    filename: name,
  });
  const response = await fetch(`${config.API_URL}/functions/v1/ceny-worker?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.session.access_token}`,
      apikey: config.ANON_KEY,
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
  });
  return { status: response.status, body: await response.json() };
}
async function action(body) {
  const response = await fetch(`${config.API_URL}/functions/v1/ceny-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.session.access_token}`,
      apikey: config.ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ companyId: company, ...body }),
  });
  return { status: response.status, body: await response.json() };
}
try {
  const b = await batch(),
    fixtures = [
      ["resume.pdf", await pdfFixture()],
      ["resume.docx", docxFixture()],
      ["resume.png", pngFixture()],
      ["resume.jpg", jpegFixture()],
    ];
  const accepted = [];
  await check("Edge validates and stores PDF DOCX PNG JPEG with document links", async () => {
    for (let i = 0; i < fixtures.length; i++) {
      const r = await send(...fixtures[i], b, i);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.state, "uploaded");
      accepted.push(r.body);
    }
    const { data: docs, error } = await user
      .from("resume_documents")
      .select("*")
      .eq("company_id", company);
    assert.ifError(error);
    assert.equal(docs.length, 4);
    assert.ok(
      docs.every((d) => d.uploaded_by === created.user.id && d.source === "email" && d.stored_at),
    );
  });
  await check(
    "simultaneous duplicate uploads return same candidate without new object",
    async () => {
      const b2 = await batch();
      const responses = await Promise.all([
        send(...fixtures[0], b2, 0),
        send("renamed.pdf", fixtures[0][1], b2, 1),
      ]);
      for (const r of responses) {
        assert.equal(r.status, 200);
        assert.equal(r.body.candidateId, accepted[0].candidateId);
        assert.equal(r.body.duplicate, true);
      }
      const { count } = await user
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company);
      assert.equal(count, 4);
    },
  );
  await check("corrupted data rejected before candidate or storage creation", async () => {
    const r = await send("fake.pdf", fixtures[2][1], b, 4);
    assert.equal(r.status, 422);
    assert.match(r.body.error, /conteúdo real/);
    const { count } = await user
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company);
    assert.equal(count, 4);
  });
  await check("direct Storage upload bypass is denied", async () => {
    const { error } = await user.storage
      .from("resumes")
      .upload(`${company}/${randomUUID()}/original`, fixtures[0][1], {
        contentType: "application/pdf",
      });
    assert.ok(error);
  });
  await check("oversized request and oversized batch refused by server", async () => {
    const r = await send("large.pdf", new Uint8Array(10485761), b, 4);
    assert.equal(r.status, 422);
    const { error } = await user.rpc("begin_resume_batch", {
      p_company: company,
      p_count: 6,
      p_source: "email",
    });
    assert.ok(error);
  });
  await check(
    "compatibility extraction endpoint only enqueues and never waits for AI",
    async () => {
      const r = await action({ action: "extract", candidateId: accepted[1].candidateId });
      assert.equal(r.status, 200);
      assert.equal(r.body.status, "queued");
      const { data } = await user
        .from("resume_documents")
        .select("state,ai_started_at")
        .eq("id", accepted[1].documentId)
        .single();
      assert.equal(data.state, "uploaded");
      assert.equal(data.ai_started_at, null);
    },
  );
  await check("reconciliation deletes stale unlinked object through Storage API", async () => {
    const path = `${company}/${randomUUID()}/original`;
    const { error } = await admin.storage
      .from("resumes")
      .upload(path, fixtures[0][1], { contentType: "application/pdf" });
    assert.ifError(error);
    execFileSync(
      "psql",
      [
        config.DB_URL,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `update storage.objects set created_at=now()-interval '2 hours' where bucket_id='resumes' and name='${path}';`,
      ],
      { stdio: "pipe" },
    );
    const r = await action({ action: "cleanup" });
    assert.equal(r.status, 200);
    assert.equal(r.body.removed, 1);
    assert.equal(r.body.failed, 0);
    const { error: downloadError } = await admin.storage.from("resumes").download(path);
    assert.ok(downloadError);
    const { error: keptError } = await user.storage
      .from("resumes")
      .download(`${company}/${accepted[0].candidateId}/original`);
    assert.ifError(keptError);
  });
  await check("concurrent dispatchers reserve at most two documents per company", async () => {
    const responses = await Promise.all([
      admin.rpc("claim_resume_jobs"),
      admin.rpc("claim_resume_jobs"),
      admin.rpc("claim_resume_jobs"),
    ]);
    responses.forEach((r) => assert.ifError(r.error));
    const claimed = responses.flatMap((r) => r.data);
    assert.equal(claimed.length, 2);
    assert.equal(new Set(claimed.map((j) => j.document_id)).size, 2);
    for (const job of claimed) {
      const { error } = await admin.rpc("settle_resume_job", {
        p_job: job.id,
        p_token: job.lease_token,
        p_outcome: "error",
        p_kind: "configuration",
        p_message: "Synthetic missing configuration",
      });
      assert.ifError(error);
    }
  });
  await check("scheduler rejects callers without its private credential", async () => {
    for (const token of ["", "a".repeat(64)]) {
      const response = await fetch(`${config.API_URL}/functions/v1/ceny-queue`, {
        method: "POST",
        headers: { "x-ceny-queue-token": token, apikey: config.ANON_KEY },
      });
      assert.equal(response.status, 401);
    }
  });
  await check("cron processes stored work after the user logs out", async () => {
    await user.auth.signOut();
    execFileSync(
      "psql",
      [
        config.DB_URL,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "select private.configure_resume_dispatch('http://kong:8000/functions/v1/ceny-queue');",
      ],
      { stdio: "pipe" },
    );
    const deadline = Date.now() + 150000;
    let jobs;
    do {
      const response = await admin.from("resume_jobs").select("*").eq("company_id", company);
      assert.ifError(response.error);
      jobs = response.data;
      if (jobs.length === 4 && jobs.every((j) => j.state === "blocked")) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } while (Date.now() < deadline);
    assert.equal(jobs.length, 4);
    assert.ok(
      jobs.every((j) => j.state === "blocked" && j.attempts === 1),
      JSON.stringify(jobs.map((j) => ({ state: j.state, attempts: j.attempts }))),
    );
    assert.ok(jobs.every((j) => j.error_kind === "configuration"));
  });
} finally {
  // Entire database and Storage are discarded by the workflow, including failures.
  await user.auth.signOut();
  fs.writeFileSync(
    "artifacts/upload-results.json",
    JSON.stringify({ passed: results.length, tests: results }, null, 2),
  );
}
