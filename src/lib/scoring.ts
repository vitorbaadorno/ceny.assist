export type MatchDetails = {
  obrigatorios_atendidos: string[];
  obrigatorios_faltantes: string[];
  desejaveis_atendidos: string[];
  desejaveis_faltantes: string[];
  experiencia_ok: boolean;
  localizacao_ok: boolean;
  formacao_ok: boolean;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export type CandidateForScore = {
  skills?: string[] | null;
  localizacao?: string | null;
  anos_experiencia?: number | null;
  dados_extraidos?: unknown;
};

export type JobForScore = {
  requisitos_obrigatorios?: string[] | null;
  requisitos_desejaveis?: string[] | null;
  experiencia_minima?: number | null;
  formacao_exigida?: string | null;
  localizacao?: string | null;
};

function candidateHaystack(candidate: CandidateForScore) {
  const raw = candidate.dados_extraidos ? JSON.stringify(candidate.dados_extraidos) : "";
  return normalize(`${(candidate.skills ?? []).join(" ")} ${raw}`);
}

export function scoreCandidate(candidate: CandidateForScore, job: JobForScore) {
  const haystack = candidateHaystack(candidate);
  const required = (job.requisitos_obrigatorios ?? []).filter(Boolean);
  const desired = (job.requisitos_desejaveis ?? []).filter(Boolean);

  const hits = (list: string[]) => list.filter((item) => haystack.includes(normalize(item)));

  const obrigatorios_atendidos = hits(required);
  const desejaveis_atendidos = hits(desired);
  const anos = candidate.anos_experiencia ?? 0;
  const minimo = job.experiencia_minima ?? 0;
  const experiencia_ok = anos >= minimo;
  const localizacao_ok = job.localizacao
    ? normalize(candidate.localizacao ?? "").includes(normalize(job.localizacao)) ||
      normalize(job.localizacao).includes(normalize(candidate.localizacao ?? "\u0000"))
    : true;
  const formacao_ok = job.formacao_exigida ? haystack.includes(normalize(job.formacao_exigida)) : true;

  const requiredScore = required.length ? obrigatorios_atendidos.length / required.length : 1;
  const desiredScore = desired.length ? desejaveis_atendidos.length / desired.length : 1;

  let score =
    requiredScore * 55 +
    desiredScore * 20 +
    (experiencia_ok ? 10 : minimo > 0 ? Math.min(anos / minimo, 1) * 10 : 10) +
    (localizacao_ok ? 8 : 0) +
    (formacao_ok ? 7 : 0);

  score = Math.round(Math.max(0, Math.min(100, score)));

  const details: MatchDetails = {
    obrigatorios_atendidos,
    obrigatorios_faltantes: required.filter((item) => !obrigatorios_atendidos.includes(item)),
    desejaveis_atendidos,
    desejaveis_faltantes: desired.filter((item) => !desejaveis_atendidos.includes(item)),
    experiencia_ok,
    localizacao_ok,
    formacao_ok,
  };

  return { score, details };
}
