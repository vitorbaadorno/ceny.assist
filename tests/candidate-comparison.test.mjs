import test from "node:test";
import assert from "node:assert/strict";
import { comparisonState, comparisonCriterion } from "../src/lib/candidate-comparison.ts";
const criterion = { kind: "skill", text: "Excel", required: true, weight: 5, min_years: null };
const current = {
  id: "person",
  nome: "Ana",
  localizacao: null,
  anos_experiencia: null,
  skills: [],
  review_status: "completed",
  processing_status: "concluido",
  review_version: 2,
  data_version: 3,
  active_document_id: "doc",
};
const entry = {
  snapshot: { ...current },
  reason: null,
  score: 80,
  details: {
    criterios: [{ ...criterion, estado: "atendido", motivo: "Evidência", evidencias: [] }],
  },
};
const data = {
  job: { version: 1 },
  run: { stale: false, formula: "evidence-v3", job_snapshot: { version: 1 } },
  candidates: [],
};
test("comparison preserves unknown data and true zero without manufacturing scores", () => {
  const p = { current, entry: null };
  const state = comparisonState({ ...data, run: null }, p);
  assert.equal(state.display.anos_experiencia, null);
  assert.match(state.reason, /não calculado/);
  assert.equal(
    comparisonState(data, { current: { ...current, anos_experiencia: 0 }, entry: null }).display
      .anos_experiencia,
    0,
  );
});
test("all comparison cells refer to the saved snapshot, with current correction flagged", () => {
  const s = comparisonState(data, {
    current: { ...current, localizacao: "Nova cidade", data_version: 4 },
    entry,
  });
  assert.equal(s.display.localizacao, null);
  assert.equal(s.stale, true);
  assert.equal(comparisonState(data, { current, entry }).stale, false);
});
test("job, review, original, model version and explicit stale flag mark comparison outdated", () => {
  for (const changed of [
    { ...data, job: { version: 2 } },
    { ...data, run: { ...data.run, formula: "older" } },
    { ...data, run: { ...data.run, stale: true } },
  ])
    assert.equal(comparisonState(changed, { current, entry }).stale, true);
  for (const change of [{ review_version: 3 }, { active_document_id: "newdoc" }])
    assert.equal(comparisonState(data, { current: { ...current, ...change }, entry }).stale, true);
});
test("pending and unassessed candidates stay distinct from final evaluations", () => {
  assert.equal(
    comparisonState(data, { current: { ...current, processing_status: "erro" }, entry }).pending,
    true,
  );
  assert.equal(
    comparisonState(data, { current, entry: null }).reason,
    "Candidato não incluído nesta avaliação.",
  );
  assert.equal(
    comparisonState(data, { current, entry: { ...entry, score: null, reason: "Revisão pendente" } })
      .reason,
    "Revisão pendente",
  );
  assert.equal(comparisonCriterion(criterion, { ...entry, score: null }), null);
});
test("comparison never aligns a different weight, requirement, kind or minimum experience", () => {
  assert.equal(comparisonCriterion(criterion, entry).estado, "atendido");
  for (const change of [
    { weight: 2 },
    { required: false },
    { kind: "education" },
    { text: "Java" },
    { min_years: 3 },
  ])
    assert.equal(comparisonCriterion({ ...criterion, ...change }, entry), null);
  assert.equal(comparisonCriterion(criterion, { ...entry, details: {} }), null);
});
