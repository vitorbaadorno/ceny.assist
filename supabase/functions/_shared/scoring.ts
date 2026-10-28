import { criterionKey, normalizeCriteria, type JobCriterion } from "./job-criteria.ts";

export type MatchDetails = {
  obrigatorios_atendidos: string[];
  obrigatorios_faltantes: string[];
  desejaveis_atendidos: string[];
  desejaveis_faltantes: string[];
  experiencia_ok: boolean;
  localizacao_ok: boolean;
  formacao_ok: boolean;
  formula: "weighted-v2";
  pontuacao_antes_limite: number;
  limite_obrigatorio_aplicado: boolean;
  criterios: Array<JobCriterion & { atendido: boolean; proporcao: number; pontos: number }>;
};
export type CandidateForScore = {
  skills?: string[] | null;
  localizacao?: string | null;
  anos_experiencia?: number | null;
  dados_extraidos?: unknown;
  data_nascimento?: string | null;
};
export type JobForScore = { criteria?: unknown; categoria?: string | null };

// Token boundaries distinguish Java from JavaScript and C from C++ / C#.
function phraseMatch(facts: string[], criterion: string) {
  const escaped = criterionKey(criterion).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}+#])${escaped}(?=$|[^\\p{L}\\p{N}+#])`, "u");
  return facts.some((fact) => typeof fact === "string" && pattern.test(criterionKey(fact)));
}
export function scoreCandidate(candidate: CandidateForScore, job: JobForScore) {
  const criteria = normalizeCriteria(job.criteria);
  if (
    !criteria.some(
      (c) =>
        c.kind === "skill" ||
        c.kind === "education" ||
        (c.kind === "experience" && c.min_years! > 0),
    )
  )
    throw new Error("Critérios insuficientes para avaliar candidatos.");
  const data = (candidate.dados_extraidos ?? {}) as {
    experiencias?: Array<{ cargo?: string }>;
    formacao_academica?: Array<{ curso?: string; nivel?: string }>;
    idiomas?: Array<string | { idioma?: string }>;
    certificacoes?: Array<string | { nome?: string }>;
  };
  const education = (data.formacao_academica ?? []).flatMap((item) => [
    item.curso ?? "",
    item.nivel ?? "",
  ]);
  // Only factual, effective fields: no evidence quotes, interpretations or instructions.
  const facts = [
    ...(candidate.skills ?? []),
    ...(data.experiencias ?? []).map((e) => e.cargo ?? ""),
    ...education,
    ...(data.idiomas ?? []).map((i) => (typeof i === "string" ? i : (i.idioma ?? ""))),
    ...(data.certificacoes ?? []).map((c) => (typeof c === "string" ? c : (c.nome ?? ""))),
  ];
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  const evaluated = criteria.map((c) => {
    let fraction: number;
    if (c.kind === "experience") {
      const years = candidate.anos_experiencia;
      fraction =
        typeof years !== "number" || !Number.isFinite(years) || years < 0
          ? 0
          : c.min_years === 0
            ? 1
            : Math.min(years / c.min_years!, 1);
    } else
      fraction = Number(
        phraseMatch(
          c.kind === "education"
            ? education
            : c.kind === "location"
              ? [candidate.localizacao ?? ""]
              : facts,
          c.text,
        ),
      );
    return {
      ...c,
      atendido: fraction === 1,
      proporcao: fraction,
      pontos: (100 * c.weight * fraction) / total,
    };
  });
  const matched = (required: boolean, hit: boolean) =>
    evaluated
      .filter((c) => c.required === required && c.atendido === hit)
      .map((c) => (c.kind === "experience" ? `${c.text}: ${c.min_years} anos` : c.text));
  const raw = evaluated.reduce((sum, c) => sum + c.pontos, 0);
  const cap = evaluated.some((c) => c.required && !c.atendido);
  const score = Math.round(Math.max(0, Math.min(cap ? 49 : 100, raw)));
  const details: MatchDetails = {
    obrigatorios_atendidos: matched(true, true),
    obrigatorios_faltantes: matched(true, false),
    desejaveis_atendidos: matched(false, true),
    desejaveis_faltantes: matched(false, false),
    experiencia_ok: evaluated.filter((c) => c.kind === "experience").every((c) => c.atendido),
    localizacao_ok: evaluated.filter((c) => c.kind === "location").every((c) => c.atendido),
    formacao_ok: evaluated.filter((c) => c.kind === "education").every((c) => c.atendido),
    formula: "weighted-v2",
    pontuacao_antes_limite: Math.round(raw),
    limite_obrigatorio_aplicado: cap,
    criterios: evaluated,
  };
  return { score, details };
}
