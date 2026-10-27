import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { classifyFailure } from "../supabase/functions/_shared/queue-policy.ts";
import { FileRejected, FILE_LIMITS } from "../supabase/functions/_shared/file-policy.ts";

test("failure classification separates retry, HR intervention, revoked access and configuration", () => {
  for (const status of [408, 409, 425, 429, 500, 502, 503])
    assert.equal(classifyFailure({ status }).kind, "transient");
  for (const status of [400, 404, 413, 422])
    assert.equal(classifyFailure({ status }).kind, "permanent");
  for (const status of [401, 402, 403])
    assert.equal(classifyFailure({ status }).kind, "configuration");
  assert.equal(classifyFailure(new FileRejected("Arquivo vazio.")).kind, "permanent");
  assert.equal(classifyFailure({ name: "AuthorizationError" }).kind, "authorization");
  assert.equal(classifyFailure({ name: "ZodError" }).kind, "permanent");
  assert.equal(classifyFailure(null).kind, "transient");
  assert.ok(
    !classifyFailure({ status: 500, message: "SECRET PROVIDER BODY" }).message.includes("SECRET"),
  );
});

function worker({ extract, configured = true, timeout = false } = {}) {
  const code = stripTypeScriptTypes(fs.readFileSync("supabase/functions/_shared/queue.ts", "utf8"))
    .replace(/^import .*?;?\r?\n/gm, "")
    .replaceAll("export ", "");
  class AiGatewayError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  const deps = {
    extractResume:
      extract ?? (async () => ({ status: "concluido", extraction: { nome_completo: "Fixture" } })),
    AiGatewayError,
    FileRejected,
    FILE_LIMITS,
    classifyFailure,
    Deno: { env: { get: () => (configured ? "test-key" : undefined) } },
    setTimeout: (fn, ms) => {
      assert.equal(ms, 120000);
      return setTimeout(fn, timeout ? 5 : ms);
    },
  };
  return new Function(...Object.keys(deps), code + "; return runResumeJob;")(
    ...Object.values(deps),
  );
}
const job = {
  id: "job",
  lease_token: "lease",
  company_id: "company",
  candidate_id: "candidate",
  document_id: "document",
};
function fakeDb({ authorized = true, downloadPending = false } = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: name === "advance_resume_job" ? authorized : true, error: null };
    },
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      single: async () => ({ data: { filename: "fixture.pdf", byte_size: 1 }, error: null }),
    }),
    storage: {
      from: () => ({
        download: async (path) => {
          calls.push({ download: path });
          return downloadPending
            ? await new Promise(() => {})
            : { data: new Blob([new Uint8Array([1])]), error: null };
        },
      }),
    },
  };
}
test("queue worker saves validated result with lease token and scoped original", async () => {
  const db = fakeDb();
  await worker()(db, job);
  assert.equal(db.calls.find((c) => c.download).download, "company/candidate/original");
  const saved = db.calls.find((c) => c.name === "settle_resume_job");
  assert.equal(saved.args.p_token, "lease");
  assert.equal(saved.args.p_outcome, "succeeded");
});
test("stale or revoked lease prevents download and AI", async () => {
  const db = fakeDb({ authorized: false });
  let calls = 0;
  await worker({
    extract: async () => {
      calls++;
    },
  })(db, job);
  assert.equal(calls, 0);
  assert.ok(!db.calls.some((c) => c.download));
  assert.equal(db.calls.at(-1).args.p_kind, "authorization");
});
test("attempt timeout releases pending I/O to retry policy", async () => {
  const db = fakeDb({ downloadPending: true });
  await worker({ timeout: true })(db, job);
  assert.equal(db.calls.at(-1).args.p_kind, "transient");
  assert.match(db.calls.at(-1).args.p_message, /tempo máximo/);
});
test("missing configuration blocks without downloading or invoking AI", async () => {
  const db = fakeDb();
  await worker({ configured: false })(db, job);
  assert.equal(db.calls.at(-1).args.p_kind, "configuration");
  assert.ok(!db.calls.some((c) => c.download));
});
test("permanent file rejection requests HR intervention instead of transient retry", async () => {
  const db = fakeDb();
  await worker({
    extract: async () => {
      throw new FileRejected("Documento corrompido.");
    },
  })(db, job);
  assert.equal(db.calls.at(-1).args.p_kind, "permanent");
});
