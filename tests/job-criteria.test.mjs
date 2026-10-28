import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCriteria,
  validateJobPayload,
  suggestCriteria,
} from "../supabase/functions/_shared/job-criteria.ts";
import { scoreCandidate } from "../supabase/functions/_shared/scoring.ts";
const criterion = (text, extra = {}) => ({
  kind: "skill",
  text,
  required: false,
  weight: 5,
  min_years: null,
  source: null,
  ...extra,
});
test("duplicate accents and whitespace merge without stacking weights", () => {
  const list = normalizeCriteria([
    criterion("Comunicação"),
    criterion(" comunicação ", { required: true, weight: 9 }),
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].weight, 9);
  assert.equal(list[0].required, true);
});
test("weights change score proportionally and missing criteria award no free points", () => {
  assert.equal(
    scoreCandidate(
      { skills: ["SQL"] },
      { criteria: [criterion("SQL"), criterion("Java", { weight: 15 })] },
    ).score,
    25,
  );
  assert.equal(
    scoreCandidate(
      { skills: ["SQL"] },
      { criteria: [criterion("SQL", { weight: 15 }), criterion("Java")] },
    ).score,
    75,
  );
  assert.throws(() => scoreCandidate({}, { criteria: [] }));
});
test("unmet mandatory caps desired score and keeps explanation", () => {
  const r = scoreCandidate(
    { skills: ["SQL"] },
    {
      criteria: [
        criterion("SQL", { weight: 100 }),
        criterion("Java", { required: true, weight: 1 }),
      ],
    },
  );
  assert.equal(r.score, 49);
  assert.equal(r.details.limite_obrigatorio_aplicado, true);
  assert.deepEqual(r.details.obrigatorios_faltantes, ["Java"]);
});
test("keyword boundaries distinguish JavaScript, Java, C++ and C#", () => {
  for (const text of ["Java", "C#", "C"])
    assert.equal(
      scoreCandidate({ skills: ["JavaScript", "C++"] }, { criteria: [criterion(text)] }).score,
      0,
    );
  assert.equal(scoreCandidate({ skills: ["C++"] }, { criteria: [criterion("C++")] }).score, 100);
});
test("experience is partial and unknown location never matches", () => {
  const r = scoreCandidate(
    { anos_experiencia: 2 },
    {
      criteria: [
        criterion("Experiência", { kind: "experience", min_years: 4 }),
        criterion("São Paulo", { kind: "location" }),
      ],
    },
  );
  assert.equal(r.score, 25);
});
test("invalid weights, negative experience and incoherent scalar duplicates rejected", () => {
  for (const weight of [-1, 0, 1.5, 101, NaN])
    assert.throws(() => normalizeCriteria([criterion("SQL", { weight })]));
  assert.throws(() =>
    normalizeCriteria([criterion("Experiência", { kind: "experience", min_years: -1 })]),
  );
  assert.throws(() =>
    normalizeCriteria([
      criterion("Local", { kind: "location" }),
      criterion("Outro", { kind: "location" }),
    ]),
  );
});
test("approval requires sufficient criteria and source still present", () => {
  const p = {
    titulo: "Analista",
    descricao: "Atendimento e análise de sistemas SQL.",
    categoria: "regular",
    criteria: [criterion("SQL", { source: "SQL" })],
  };
  assert.doesNotThrow(() => validateJobPayload(p, true));
  assert.throws(() =>
    validateJobPayload({ ...p, descricao: "Atendimento sem a competência anterior." }, true),
  );
  assert.throws(() =>
    validateJobPayload({ ...p, criteria: [criterion("Cidade", { kind: "location" })] }, true),
  );
});
test("description suggestions preserve exact evidence and required vs desired", () => {
  const s = suggestCriteria(
    "Sobre a empresa\nRequisitos:\n- SQL\nDiferenciais:\n- Power BI\nBenefícios:\n- Saúde",
  );
  assert.equal(s.length, 2);
  assert.equal(s[0].required, true);
  assert.equal(s[1].required, false);
  assert.equal(s[0].source, "- SQL");
});
