import test from "node:test";
import assert from "node:assert/strict";
import { minimizeResumeText } from "../supabase/functions/_shared/ai-privacy.ts";
import { extractResume } from "../supabase/functions/_shared/resumes.ts";
import { pdfFixture, pngFixture } from "./resume-fixtures.mjs";

test("professional context survives protected-word homonyms and missing section headings", () => {
  for (const line of [
    "Profissional de saúde com experiência em gestão hospitalar",
    "Analista de gênero textual e linguagem",
    "Desenvolvi ações de saúde e educação de rua",
    "Engenheira de qualidade de sistemas",
  ])
    assert.equal(minimizeResumeText(line), line);
  const lines =
    "Nome: Pessoa Sintética\nExperiência\nEstudo sobre idade de equipamentos\nGênero: exemplo\nCPF 123.456.789-00";
  const result = minimizeResumeText(lines);
  assert.equal(result.split("\n").length, 5);
  assert.ok(result.includes("idade de equipamentos"));
  assert.ok(!result.includes("Pessoa Sintética"));
  assert.ok(!result.includes("Gênero: exemplo"));
  assert.ok(!result.includes("123.456"));
});

test("binary originals remain blocked even with synthetic paid/review test configuration", async (t) => {
  const previous = globalThis.Deno;
  globalThis.Deno = {
    env: {
      get: (key) =>
        ({
          CENY_GEMINI_DATA_TIER: "paid",
          CENY_GEMINI_PRIVACY_REVIEW_REFERENCE: "synthetic-test-only",
        })[key],
    },
  };
  t.after(() => {
    globalThis.Deno = previous;
  });
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw Error("unexpected network");
  });
  for (const [name, bytes] of [
    ["synthetic.pdf", await pdfFixture()],
    ["synthetic.png", pngFixture()],
  ]) {
    await assert.rejects(extractResume(bytes, name, AbortSignal.timeout(5000)), {
      name: "AiPrivacyPending",
    });
  }
  assert.equal(network.mock.callCount(), 0);
});
