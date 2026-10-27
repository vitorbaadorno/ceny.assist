import { experienceMonths } from "../../supabase/functions/_shared/experience.ts";

export type ReviewEntry = {
  inicio?: string | null;
  fim?: string | null;
  atual?: boolean;
  [key: string]: string | boolean | null | undefined;
};
export type ReviewData = {
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  localizacao: string | null;
  data_nascimento: string | null;
  formacao_academica: ReviewEntry[];
  experiencias: ReviewEntry[];
  skills: string[];
  idiomas: string[];
  certificacoes: string[];
  anos_experiencia_total: number | null;
  status: string;
  observacoes: string | null;
};
export const reviewLabels: Record<string, string> = {
  nome_completo: "Nome",
  email: "E-mail",
  telefone: "Telefone",
  localizacao: "Cidade / localização",
  data_nascimento: "Data de nascimento",
  formacao_academica: "Formação",
  experiencias: "Experiências",
  skills: "Competências",
  idiomas: "Idiomas",
  certificacoes: "Certificações",
  anos_experiencia_total: "Tempo de experiência (anos)",
  status: "Status no funil",
  observacoes: "Observações",
  empresa: "Empresa",
  cargo: "Cargo",
  periodo: "Período descrito",
  descricao: "Descrição",
  inicio: "Início (AAAA ou AAAA-MM)",
  fim: "Fim (AAAA ou AAAA-MM)",
  atual: "Trabalho atual",
  curso: "Curso",
  instituicao: "Instituição",
  nivel: "Nível",
};
export function reviewData(candidate: {
  dados_efetivos: unknown;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  localizacao: string | null;
  data_nascimento: string | null;
  skills: string[];
  anos_experiencia: number | null;
  status: string;
  observacoes: string | null;
}): ReviewData {
  const d = (candidate.dados_efetivos ?? {}) as Partial<ReviewData>;
  return {
    nome_completo: candidate.nome,
    email: candidate.email,
    telefone: candidate.telefone,
    localizacao: candidate.localizacao,
    data_nascimento: candidate.data_nascimento,
    formacao_academica: d.formacao_academica ?? [],
    experiencias: d.experiencias ?? [],
    skills: candidate.skills ?? [],
    idiomas: d.idiomas ?? [],
    certificacoes: d.certificacoes ?? [],
    anos_experiencia_total: candidate.anos_experiencia,
    status: candidate.status,
    observacoes: candidate.observacoes,
  };
}
export function reviewPatch(base: ReviewData, draft: ReviewData): Partial<ReviewData> {
  return Object.fromEntries(
    Object.entries(draft).filter(
      ([k, v]) => JSON.stringify(v) !== JSON.stringify(base[k as keyof ReviewData]),
    ),
  );
}
export function yearsFromPeriods(entries: ReviewEntry[], today = new Date()) {
  const result = experienceMonths(
    entries.map((e) => ({
      inicio: typeof e.inicio === "string" ? e.inicio : null,
      fim: typeof e.fim === "string" ? e.fim : null,
      atual: e.atual === true,
    })),
    today,
  );
  return result.complete && result.months !== null
    ? Math.round((result.months / 12) * 100) / 100
    : null;
}
export function reviewError(error: { code?: string; message?: string }) {
  if (error.code === "40001")
    return "Outra pessoa ou uma nova leitura alterou este currículo. Confira a versão atual antes de salvar novamente.";
  if (error.code === "42501")
    return "Seu acesso foi retirado ou você não tem permissão para revisar este candidato.";
  if (["22023", "22007", "22008"].includes(error.code ?? ""))
    return "Confira os campos: e-mail, telefone, datas, períodos e limites de texto devem ser válidos.";
  return "Não foi possível confirmar o salvamento. Seu rascunho continua nesta tela; confira a versão atual antes de tentar novamente.";
}
export function reviewFieldName(path: string) {
  return path
    .split(".")
    .map(
      (p) =>
        reviewLabels[p] ?? (/^\d+$/.test(p) ? `item ${Number(p) + 1}` : p.replaceAll("_", " ")),
    )
    .join(" · ");
}
