import { evaluateCriterion, type MatchState, type Evidence } from "./criterion-evidence.ts";
import { normalizeCriteria, type JobCriterion } from "./job-criteria.ts";

export type MatchDetails = {
  aprendizagem?: import("./age.ts").ApprenticeAgeAssessment;
  obrigatorios_atendidos: string[];
  obrigatorios_faltantes: string[];
  desejaveis_atendidos: string[];
  desejaveis_faltantes: string[];
  experiencia_ok: boolean;
  localizacao_ok: boolean;
  formacao_ok: boolean;
  formula: "evidence-v3";
  pontuacao_antes_limite: number;
  limite_obrigatorio_aplicado: boolean;
  criterios: Array<
    JobCriterion & {
      atendido: boolean;
      proporcao: number;
      pontos: number;
      estado: MatchState;
      motivo: string;
      evidencias: Evidence[];
    }
  >;
};
export type CandidateForScore = {
  skills?: string[] | null;
  localizacao?: string | null;
  anos_experiencia?: number | null;
  dados_extraidos?: unknown;
  correcoes_rh?: unknown;
  data_nascimento?: string | null;
};
export type JobForScore = { criteria?: unknown; categoria?: string | null };

export function prepareAssessment(job: JobForScore) {
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
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  return (candidate: CandidateForScore) => {
    const evaluated = criteria.map((c) => {
      const result = evaluateCriterion(c, candidate);
      return {
        ...c,
        ...result,
        atendido: result.estado === "atendido",
        pontos: (100 * c.weight * result.proporcao) / total,
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
      formula: "evidence-v3",
      pontuacao_antes_limite: Math.round(raw),
      limite_obrigatorio_aplicado: cap,
      criterios: evaluated,
    };
    return { score, details };
  };
}
export function scoreCandidate(candidate: CandidateForScore, job: JobForScore) {
  return prepareAssessment(job)(candidate);
}
