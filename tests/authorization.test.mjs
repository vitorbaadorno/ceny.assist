import { errorFeedback } from "../src/lib/ui-feedback.ts";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { z } from "zod";
import { validateJobPayload } from "../supabase/functions/_shared/job-criteria.ts";
import { scoreCandidate, prepareAssessment } from "../supabase/functions/_shared/scoring.ts";
import { assessApprenticeAge, ageReferenceDate } from "../supabase/functions/_shared/age.ts";
import { FileRejected, FILE_LIMITS } from "../supabase/functions/_shared/file-policy.ts";
import { extractionFixture } from "./extraction-fixture.mjs";
import {
  prepareProfessionalText,
  requireAiPrivacyReview,
} from "../supabase/functions/_shared/ai-privacy.ts";
import {
  validateExtraction,
  extractionSchema,
} from "../supabase/functions/_shared/extraction-quality.ts";
import {
  EXTRACTION_INSTRUCTIONS,
  EXTRACTION_REQUEST,
} from "../supabase/functions/_shared/extraction-prompt.ts";

// Evaluate the actual handlers with instrumented database/network boundaries.
function load(file, names, dependencies = {}) {
  let code = stripTypeScriptTypes(fs.readFileSync(file, "utf8"));
  code = code.replace(/^import\b[\s\S]*?;\s*/gm, "").replaceAll("export ", "");
  return new Function(...Object.keys(dependencies), code + `\nreturn { ${names.join(",")} };`)(
    ...Object.values(dependencies),
  );
}
const { requireCompanyRole } = load("src/lib/company-access.ts", ["requireCompanyRole"], {
  errorFeedback,
});
const createServerFn = () => {
  let validate;
  return {
    middleware() {
      return this;
    },
    inputValidator(fn) {
      validate = fn;
      return this;
    },
    handler(fn) {
      return async ({ data, context }) => fn({ data: validate(data), context });
    },
  };
};
function db(fixtures = {}, rpcError = null) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const query = {
        select() {
          return this;
        },
        eq(key, value) {
          call.filters.push([key, value]);
          return this;
        },
        in(key, value) {
          call.filters.push([key, value]);
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        is(key, value) {
          call.filters.push([key, value]);
          return this;
        },
        gt(key, value) {
          call.cursor = value;
          return this;
        },
        range() {
          return this;
        },
        single() {
          return Promise.resolve(
            fixtures[table] ?? { data: null, error: new Error("unavailable") },
          );
        },
        then(resolve, reject) {
          return Promise.resolve(
            call.cursor
              ? { data: [], error: null }
              : (fixtures[table] ?? { data: [], error: null }),
          ).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      return {
        error: rpcError,
        data:
          name === "claim_resume_extraction"
            ? { owned: true, token: "test-token", state: "reading" }
            : name === "begin_ranking"
              ? {
                  id: jobId,
                  status: "processing",
                  total: 1,
                  eligible: 1,
                  job_snapshot: approvedJob,
                }
              : null,
      };
    },
    storage: {
      from(bucket) {
        return {
          async download(path) {
            calls.push({ download: path, bucket });
            return {
              data: new Blob(["synthetic resume"], { type: "application/pdf" }),
              error: null,
            };
          },
          async createSignedUrl(path, ttl) {
            calls.push({ bucket, path, ttl });
            return { data: { signedUrl: "https://signed.invalid/resume" }, error: null };
          },
        };
      },
    },
  };
}
const companyId = "11111111-1111-4111-8111-111111111111";
const candidateId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";
const approvedJob = {
  id: jobId,
  titulo: "Analista",
  descricao: "Atendimento profissional de sistemas",
  categoria: "regular",
  status: "aberta",
  approved_hash: "hash",
  version: 2,
  criteria: [
    { kind: "skill", text: "SQL", min_years: null, required: true, weight: 5, source: null },
  ],
};
const member = (role) => ({ data: { role }, error: null });
const { getResumeUrl } = load("src/lib/resumes.functions.ts", ["getResumeUrl"], {
  createServerFn,
  z,
  requireSupabaseAuth: {},
  requireCompanyRole,
  errorFeedback,
});
const { archiveCandidate } = load("src/lib/records.functions.ts", ["archiveCandidate"], {
  errorFeedback,
  createServerFn,
  z,
  requireSupabaseAuth: {},
  requireCompanyRole,
});
const { rankCandidates } = load("supabase/functions/_shared/ranking.ts", ["rankCandidates"], {
  requireCompanyRole,
  prepareAssessment,
  validateJobPayload,
  assessApprenticeAge,
  ageReferenceDate,
});

test("membership authorization fails closed on database errors", async () => {
  await assert.rejects(requireCompanyRole(db(), userId, companyId), /verificar seu acesso/);
});
test("resume signing rejects missing membership without accessing storage", async () => {
  const supabase = db();
  await assert.rejects(
    getResumeUrl({ data: { companyId, candidateId }, context: { supabase, userId } }),
  );
  assert.deepEqual(
    supabase.calls.map((c) => c.table),
    ["company_members"],
  );
});
test("resume signing rejects another company candidate and does not sign", async () => {
  const supabase = db({
    company_members: member("owner"),
    candidates: { data: null, error: { code: "PGRST116" } },
  });
  await assert.rejects(
    getResumeUrl({ data: { companyId, candidateId }, context: { supabase, userId } }),
    /indisponível/,
  );
  assert.ok(!supabase.calls.some((c) => c.bucket));
  assert.ok(
    supabase.calls
      .find((c) => c.table === "candidates")
      .filters.some(([k, v]) => k === "company_id" && v === companyId),
  );
});
test("resume signing uses database path, ignoring a forged caller path", async () => {
  const supabase = db({
    company_members: member("viewer"),
    candidates: { data: { arquivo_original_path: "authorized/original" }, error: null },
  });
  await getResumeUrl({
    data: { companyId, candidateId, path: "other-company/secret" },
    context: { supabase, userId },
  });
  assert.deepEqual(
    supabase.calls.find((c) => c.bucket),
    { bucket: "resumes", path: "authorized/original", ttl: 60 },
  );
});
test("archive rejects recruiter before any mutation", async () => {
  const supabase = db({ company_members: member("recruiter") });
  await assert.rejects(
    archiveCandidate({ data: { companyId, candidateId }, context: { supabase, userId } }),
  );
  assert.ok(!supabase.calls.some((c) => c.rpc));
});
test("version signing requires the exact company, person and received document", async () => {
  const fixtures = {
    company_members: member("viewer"),
    candidates: {
      data: { arquivo_original_path: "legacy/original", active_document_id: jobId },
      error: null,
    },
  };
  for (const document of [null, { object_path: "private/version", stored_at: null }]) {
    const supabase = db({ ...fixtures, resume_documents: { data: document, error: null } });
    await assert.rejects(
      getResumeUrl({
        data: { companyId, candidateId, documentId: jobId },
        context: { supabase, userId },
      }),
      /indisponível/,
    );
    assert.ok(!supabase.calls.some((c) => c.bucket));
  }
  const supabase = db({
    ...fixtures,
    resume_documents: {
      data: { object_path: "private/version", filename: "v2.pdf", stored_at: "2026-10-29" },
      error: null,
    },
  });
  await getResumeUrl({ data: { companyId, candidateId }, context: { supabase, userId } });
  assert.deepEqual(supabase.calls.find((c) => c.table === "resume_documents").filters, [
    ["id", jobId],
    ["company_id", companyId],
    ["candidate_id", candidateId],
  ]);
  assert.equal(supabase.calls.find((c) => c.bucket).path, "private/version");
});
test("archive passes both company and record IDs to atomic database authorization", async () => {
  const supabase = db({ company_members: member("admin") });
  await archiveCandidate({ data: { companyId, candidateId }, context: { supabase, userId } });
  assert.deepEqual(
    supabase.calls.find((c) => c.rpc),
    { rpc: "archive_candidate", args: { p_company: companyId, p_id: candidateId } },
  );
});
test("viewer cannot trigger ranking or use privileged persistence", async () => {
  const supabase = db({ company_members: member("viewer") }),
    admin = db();
  await assert.rejects(rankCandidates({ companyId, jobId }, { supabase, admin, userId }));
  assert.equal(admin.calls.length, 0);
});
test("ranking uses scoped RLS reads and server-derived scores, with verified actor", async () => {
  const supabase = db({
      company_members: member("recruiter"),
      ranking_entries: {
        data: [{ candidate_id: candidateId, snapshot: { skills: [], dados_efetivos: {} } }],
        error: null,
      },
    }),
    admin = db();
  const result = await rankCandidates(
    { companyId, jobId, score: 100, userId: "forged" },
    { supabase, admin, userId },
  );
  assert.equal(result.count, 1);
  for (const c of supabase.calls.filter((c) => ["ranking_entries"].includes(c.table)))
    assert.ok(c.filters.some(([k, v]) => k === "company_id" && v === companyId));
  const write = admin.calls.find((c) => c.rpc === "stage_ranking");
  assert.equal(write.rpc, "stage_ranking");
  assert.equal(write.args.p_actor, userId);
  assert.equal(write.args.p_run, jobId);
  assert.equal(write.args.p_rows[0].candidate_id, candidateId);
  assert.equal(
    write.args.p_rows[0].score,
    scoreCandidate({ skills: [], dados_extraidos: {} }, approvedJob).score,
  );
});
test("backend refuses success if final database check detects revocation", async () => {
  const supabase = db({
      company_members: member("admin"),
      jobs: { data: approvedJob, error: null },
      candidates: { data: [], error: null },
    }),
    admin = db({}, new Error("Acesso revogado"));
  await assert.rejects(
    rankCandidates({ companyId, jobId }, { supabase, admin, userId }),
    /Não foi possível iniciar/,
  );
});
test("invalid IDs are rejected before database access", async () => {
  const supabase = db();
  await assert.rejects(
    getResumeUrl({ data: { companyId: "bad", candidateId }, context: { supabase, userId } }),
  );
  assert.equal(supabase.calls.length, 0);
});

const extraction = {
  nome_completo: "Fixture",
  email: null,
  telefone: "000",
  data_nascimento: null,
  localizacao: null,
  formacao_academica: [],
  experiencias: [],
  skills: [],
  idiomas: [],
  certificacoes: [],
  anos_experiencia_total: 0,
  confianca: 0.9,
  campos_incertos: [],
};
const loadExtraction = (callAiJson) =>
  load("supabase/functions/_shared/resumes.ts", ["processResume", "extractResume"], {
    requireCompanyRole,
    z,
    callAiJson,
    prepareProfessionalText,
    requireAiPrivacyReview,
    Deno: { env: { get: () => "synthetic-privacy-review" } },
    validateFile: async () => ({
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pages: 1,
      text: "Ana Teste\nExperiência\nTypeScript",
    }),
    FileRejected,
    FILE_LIMITS,
    validateExtraction,
    extractionSchema,
    EXTRACTION_INSTRUCTIONS,
    EXTRACTION_REQUEST,
  });
test("extraction endpoint enqueues without downloading or calling AI", async () => {
  const supabase = db({ company_members: member("recruiter") });
  let calls = 0;
  const result = await loadExtraction(async () => {
    calls++;
    return extractionFixture();
  }).processResume({ companyId, candidateId }, { supabase, admin: db(), userId });
  assert.equal(result.status, "queued");
  assert.equal(calls, 0);
  assert.ok(!supabase.calls.some((c) => c.download));
  const enqueue = supabase.calls.find((c) => c.rpc === "request_resume_job");
  assert.equal(enqueue.args.p_company, companyId);
  assert.equal(enqueue.args.p_candidate, candidateId);
  assert.equal(enqueue.args.p_mode, "normal");
});
test("viewer cannot enqueue privileged AI processing", async () => {
  const supabase = db({ company_members: member("viewer") });
  await assert.rejects(
    loadExtraction(() => {
      throw Error("must not call");
    }).processResume({ companyId, candidateId }, { supabase, admin: db(), userId }),
  );
  assert.ok(!supabase.calls.some((c) => c.rpc || c.download));
});
test("extraction validates AI output and propagates cancellation", async () => {
  const signal = new AbortController().signal;
  const result = await loadExtraction(async (options) => {
    assert.equal(options.signal, signal);
    assert.equal(options.parts.length, 1);
    assert.equal(options.parts[0].type, "input_text");
    assert.ok(!options.parts[0].text.includes("Ana Teste"));
    const fixture = extractionFixture();
    return {
      ...fixture,
      nome_completo: null,
      email: null,
      evidencias: fixture.evidencias.filter((e) => e.campo === "skills.0"),
    };
  }).extractResume(new Uint8Array([1]), "fixture.pdf", signal);
  assert.equal(result.status, "revisao_manual"); // Identification was intentionally omitted.
  assert.equal(result.extraction.nome_completo, null);
  assert.equal(result.extraction.schema_version, "2");
});
test("invalid provider output never becomes an AI result", async () => {
  await assert.rejects(
    loadExtraction(async () => ({ ...extraction, confianca: 10 })).extractResume(
      new Uint8Array([1]),
      "fixture.pdf",
      new AbortController().signal,
    ),
  );
});

test("membership network failure is not reported as missing permission", async () => {
  const supabase = db({ company_members: { data: null, error: new TypeError("Failed to fetch") } });
  await assert.rejects(requireCompanyRole(supabase, userId, companyId), /Falha de conexão/);
});
test("resume query network failure never signs or pretends the document is missing", async () => {
  const supabase = db({
    company_members: member("owner"),
    candidates: { data: null, error: new TypeError("Failed to fetch") },
  });
  await assert.rejects(
    getResumeUrl({ data: { companyId, candidateId }, context: { supabase, userId } }),
    /Falha de conexão/,
  );
  assert.ok(!supabase.calls.some((c) => c.bucket));
});
