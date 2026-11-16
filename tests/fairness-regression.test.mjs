import test from "node:test";
import assert from "node:assert/strict";
import { scoreCandidate } from "../supabase/functions/_shared/scoring.ts";
test("counterfactual protected and identifying traits never change professional scores", () => {
  const jobs = ["SQL", "Python", "Atendimento", "Excel"].map((text) => ({
    criteria: [{ kind: "skill", text, weight: 5, required: true, min_years: null, source: null }],
  }));
  const variants = [
    { nome: "Pessoa A", genero: "feminino", idade: 22, raca: "grupo A" },
    { nome: "Pessoa B", genero: "masculino", idade: 60, raca: "grupo B" },
    {
      nome: "Pessoa C",
      religiao: "sintética",
      deficiencia: "sintética",
      estado_civil: "sintético",
    },
    {
      nome: "Pessoa D",
      nacionalidade: "sintética",
      orientacao_sexual: "sintética",
      foto: "synthetic",
    },
  ];
  for (const job of jobs)
    for (const skills of [[], ["SQL"], ["Excel", "Python"], ["Atendimento"]]) {
      const base = { skills, dados_extraidos: { skills } };
      for (const variant of variants)
        assert.deepEqual(
          scoreCandidate(
            { ...base, ...variant, dados_extraidos: { ...base.dados_extraidos, ...variant } },
            job,
          ),
          scoreCandidate(base, job),
        );
    }
});
