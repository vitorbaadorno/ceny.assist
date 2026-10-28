import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCriterion } from "../supabase/functions/_shared/criterion-evidence.ts";
import { scoreCandidate } from "../supabase/functions/_shared/scoring.ts";
const skill = (text, kind = "skill") => ({
  kind,
  text,
  weight: 5,
  required: true,
  min_years: kind === "experience" ? 3 : null,
  source: null,
});
const cases = [
  ["Java", ["JavaScript"], "sem_informacao"],
  ["Java", ["Java"], "atendido"],
  ["JavaScript", ["JS"], "atendido"],
  ["JS", ["Java"], "sem_informacao"],
  ["Excel", ["Microsoft Excel"], "atendido"],
  ["Power BI", ["PowerBI"], "atendido"],
  ["PostgreSQL", ["Postgres"], "atendido"],
  ["Recursos humanos", ["RH"], "atendido"],
  ["Gestão de projetos", ["Project management"], "atendido"],
  ["Excel", ["Não possui experiência com Excel"], "nao_atendido"],
  ["Excel", ["Sem Excel"], "nao_atendido"],
  ["Excel", ["Nunca utilizei Excel"], "nao_atendido"],
  ["Excel", ["No experience with Excel"], "nao_atendido"],
  ["SQL", ["Não uso Excel; SQL"], "atendido"],
  ["Excel", ["Aprendendo Excel"], "parcial"],
  ["Excel avançado", ["Excel básico"], "parcial"],
  ["Excel avançado", ["Excel"], "parcial"],
  ["Excel avançado", ["Excel avançado"], "atendido"],
  ["Experiência com Excel", ["Excel"], "parcial"],
  ["SQL", [], "sem_informacao"],
  ["C#", ["C++"], "sem_informacao"],
  ["C", ["C++"], "sem_informacao"],
  ["Excel", ["Excel", "Não conheço Excel"], "sem_informacao"],
  ["SQL", ["sql@example.test"], "sem_informacao"],
  ["SQL", ["internal_SQL_field"], "sem_informacao"],
];
for (const [requirement, skills, state] of cases)
  test(`reference: ${requirement} / ${skills.join("; ")} => ${state}`, () =>
    assert.equal(evaluateCriterion(skill(requirement), { skills }).estado, state));
test("education separates completion, ongoing, incomplete and unknown", () => {
  for (const [period, state] of [
    ["Concluído", "atendido"],
    ["Em andamento", "parcial"],
    ["Incompleto", "nao_atendido"],
    ["Trancado", "nao_atendido"],
    ["2018–2022", "parcial"],
  ]) {
    const result = evaluateCriterion(skill("Administração concluída", "education"), {
      dados_extraidos: {
        formacao_academica: [{ curso: "Administração", periodo: period, fim: "2022" }],
      },
    });
    assert.equal(result.estado, state);
  }
});
test("unknown experience and empty city are insufficient, never compatible", () => {
  assert.equal(evaluateCriterion(skill("Experiência", "experience"), {}).estado, "sem_informacao");
  assert.equal(
    evaluateCriterion(skill("São Paulo", "location"), { localizacao: "" }).estado,
    "sem_informacao",
  );
  assert.equal(
    evaluateCriterion(skill("Experiência", "experience"), { anos_experiencia: 0 }).estado,
    "nao_atendido",
  );
});
test("personal data, internal keys and inferred text never add points", () => {
  const job = { criteria: [skill("Java")] };
  const a = scoreCandidate({}, job);
  const b = scoreCandidate(
    {
      dados_extraidos: {
        nome_completo: "Java",
        email: "java@a.test",
        sexo: "Java",
        religiao: "Java",
        Java: true,
        resumo_profissional: { sintese: "Java" },
        evidencias: [{ trecho: "Java" }],
      },
      data_nascimento: "1990-01-01",
    },
    job,
  );
  assert.equal(a.score, 0);
  assert.deepEqual(a, b);
});
test("professional context and evidence provenance are explicit", () => {
  const data = {
    experiencias: [{ descricao: "Utilizei Excel avançado na produção de relatórios" }],
    evidencias: [
      {
        campo: "experiencias.0.descricao",
        trecho: "Utilizei Excel avançado na produção de relatórios",
        pagina: 2,
        tipo: "encontrado",
        verificacao: "trecho_conferido",
      },
    ],
  };
  const r = evaluateCriterion(skill("Experiência com Excel avançado"), { dados_extraidos: data });
  assert.equal(r.estado, "atendido");
  assert.equal(r.evidencias[0].pagina, 2);
  const human = evaluateCriterion(skill("Excel"), {
    skills: ["Excel"],
    dados_extraidos: {
      evidencias: [
        {
          campo: "skills.0",
          trecho: "Não possui Excel",
          pagina: 1,
          tipo: "encontrado",
          verificacao: "trecho_conferido",
        },
      ],
    },
    correcoes_rh: { skills: ["Excel"] },
  });
  assert.equal(human.estado, "atendido");
  assert.equal(human.evidencias[0].origem, "correcao_rh");
});
test("verified negative quote overrides an oversimplified extraction", () => {
  const r = evaluateCriterion(skill("Excel"), {
    skills: ["Excel"],
    dados_extraidos: {
      evidencias: [
        {
          campo: "skills.0",
          trecho: "Não possui Excel",
          pagina: 1,
          tipo: "encontrado",
          verificacao: "trecho_conferido",
        },
      ],
    },
  });
  assert.equal(r.estado, "nao_atendido");
});
test("missing criterion categories award no points and empty jobs cannot rank", () => {
  assert.equal(scoreCandidate({}, { criteria: [skill("SQL")] }).score, 0);
  assert.throws(() => scoreCandidate({}, { criteria: [] }));
});
