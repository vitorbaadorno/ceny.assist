import test from "node:test";
import assert from "node:assert/strict";
import {
  reviewData,
  reviewPatch,
  yearsFromPeriods,
  reviewError,
} from "../src/lib/candidate-review.ts";
const candidate = {
  dados_efetivos: { experiencias: [], formacao_academica: [], idiomas: [], certificacoes: [] },
  nome: "Ana",
  email: null,
  telefone: null,
  localizacao: "Cidade livre",
  data_nascimento: null,
  skills: [],
  anos_experiencia: null,
  status: "novo",
  observacoes: null,
};
test("review draft uses effective human fields and preserves absent data", () => {
  const draft = reviewData(candidate);
  assert.equal(draft.localizacao, "Cidade livre");
  assert.equal(draft.email, null);
  assert.equal(draft.anos_experiencia_total, null);
  assert.deepEqual(reviewPatch(draft, { ...draft, email: "ana@example.test", skills: ["SQL"] }), {
    email: "ana@example.test",
    skills: ["SQL"],
  });
});
test("review patch includes explicit clearing of values without touching other groups", () => {
  const draft = reviewData({ ...candidate, email: "ana@example.test", skills: ["SQL"] });
  assert.deepEqual(reviewPatch(draft, { ...draft, email: null, skills: [] }), {
    email: null,
    skills: [],
  });
  assert.deepEqual(reviewPatch(draft, structuredClone(draft)), {});
});
test("human period edits use overlap-safe calculation and incomplete periods stay unknown", () => {
  const entries = [
    { inicio: "2020-01", fim: "2021-12", atual: false },
    { inicio: "2021-01", fim: "2022-12", atual: false },
  ];
  assert.equal(yearsFromPeriods(entries), 3);
  assert.equal(yearsFromPeriods([{ inicio: "2020", fim: "2021" }]), null);
  assert.equal(yearsFromPeriods([]), null);
});
test("concurrency, revocation and ambiguous network outcomes produce safe actionable messages", () => {
  assert.match(reviewError({ code: "40001" }), /Outra pessoa/);
  assert.match(reviewError({ code: "42501" }), /acesso/);
  const message = reviewError({ message: "private@example.test internal table" });
  assert.doesNotMatch(message, /private@example|internal table/);
  assert.match(message, /rascunho/);
});
