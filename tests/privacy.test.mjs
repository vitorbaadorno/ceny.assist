import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import {
  minimizeResumeText,
  prepareProfessionalText,
  requireAiPrivacyReview,
} from "../supabase/functions/_shared/ai-privacy.ts";
import { signLedger, verifyLedger } from "../scripts/privacy-ledger.mjs";
test("professional text minimization removes header contacts sensitive lines and preserves evidence positions", () => {
  const input =
    "Pessoa Teste\npessoa@example.invalid\nExperiência\nAnalista, 2021-2025, SQL\nCPF 123.456.789-00\nEndereço: Rua Exemplo 12\nReligião: exemplo\nContato pessoa@example.invalid https://site.invalid +55 11 99999-8888\nFormação\nCiência da Computação";
  const result = minimizeResumeText(input);
  assert.equal(result.split("\n").length, input.split("\n").length);
  for (const value of [
    "Pessoa Teste",
    "pessoa@example",
    "123.456",
    "Rua Exemplo",
    "Religião:",
    "https://",
    "99999-8888",
  ])
    assert.ok(!result.includes(value));
  assert.ok(result.includes("2021-2025, SQL"));
  assert.ok(result.includes("Ciência da Computação"));
});
test("unreviewed vendor and raw originals cannot be transmitted", () => {
  assert.throws(() => requireAiPrivacyReview(undefined), /validação/);
  assert.throws(() => requireAiPrivacyReview("  "), /validação/);
  assert.doesNotThrow(() => requireAiPrivacyReview("approved-review-reference"));
  assert.throws(() => prepareProfessionalText({ mime: "application/pdf" }), /integral/);
  assert.throws(
    () => prepareProfessionalText({ text: "Nome e contatos sem seção profissional" }),
    /separar/,
  );
});
function queueHarness({
  claimError = false,
  removeError = false,
  finishError = false,
  throws = false,
} = {}) {
  const calls = [],
    operation = {
      id: "operation",
      token: "lease",
      files: [{ bucket: "resumes", path: "company/candidate/original" }],
    };
  const code = stripTypeScriptTypes(
    fs.readFileSync("supabase/functions/_shared/privacy-queue.ts", "utf8"),
  )
    .replace(/^import\b[\s\S]*?;\s*/gm, "")
    .replaceAll("export ", "");
  const run = new Function(code + ";return runPrivacyQueue;")();
  const admin = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return name === "claim_privacy_erasure"
        ? { data: operation, error: claimError ? {} : null }
        : { data: !removeError, error: finishError ? {} : null };
    },
    storage: {
      from: () => ({
        remove: async (paths) => {
          calls.push({ remove: paths });
          if (throws) throw Error("network");
          return { error: removeError ? {} : null };
        },
      }),
    },
  };
  return { calls, run: () => run(admin) };
}
test("database failure cannot delete files", async () => {
  const q = queueHarness({ claimError: true });
  await assert.rejects(q.run());
  assert.equal(q.calls.length, 1);
});
test("storage failure is acknowledged as pending instead of success", async () => {
  for (const flags of [{ removeError: true }, { throws: true }]) {
    const q = queueHarness(flags);
    await q.run();
    assert.equal(q.calls.at(-1).args.p_success, false);
  }
});
test("file success requires acknowledgment; interrupted acknowledgment throws for durable lease recovery", async () => {
  const q = queueHarness();
  await q.run();
  assert.deepEqual(
    q.calls.map((c) => c.name ?? "remove"),
    ["claim_privacy_erasure", "remove", "finish_privacy_erasure"],
  );
  assert.equal(q.calls.at(-1).args.p_success, true);
  const broken = queueHarness({ finishError: true });
  await assert.rejects(broken.run(), /retomada/);
});
test("signed external journal rejects tampering wrong origin and missing key", () => {
  const key = "01234567890123456789012345678901";
  const ledger = {
    version: 1,
    project: "source",
    companies: ["11111111-1111-1111-1111-111111111111"],
    erasures: [
      {
        company_id: "11111111-1111-1111-1111-111111111111",
        candidate_ids: ["22222222-2222-2222-2222-222222222222"],
        objects: [],
      },
    ],
  };
  const signed = signLedger(ledger, key);
  assert.deepEqual(verifyLedger(signed, key, "source"), ledger);
  assert.throws(
    () =>
      verifyLedger(
        { ...signed, payload: signed.payload.replace("22222222", "33333333") },
        key,
        "source",
      ),
    /Assinatura/,
  );
  assert.throws(() => verifyLedger(signed, key, "other"), /Origem/);
  assert.throws(() => signLedger(ledger, "short"));
});
