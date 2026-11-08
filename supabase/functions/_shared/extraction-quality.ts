import { z } from "zod";
import { ageReferenceDate } from "./age.ts";
import { experienceMonths } from "./experience.ts";

const text = z.string().trim().min(1).max(500).nullable();
const short = z.string().trim().min(1).max(120);
const list = z.array(short).max(100);
const period = z
  .string()
  .regex(/^(19|20)\d{2}(-(0[1-9]|1[0-2]))?$/)
  .nullable();
export const extractionValidator = z
  .object({
    nome_completo: text,
    email: z.string().email().max(254).nullable(),
    telefone: z
      .string()
      .regex(/^\+?(?=(?:\D*\d){7,15}\D*$)[\d\s().-]{7,30}$/)
      .nullable(),
    data_nascimento: z.string().date().nullable(),
    localizacao: text,
    formacao_academica: z
      .array(
        z
          .object({
            curso: text,
            instituicao: text,
            nivel: text,
            periodo: text,
            inicio: period,
            fim: period,
          })
          .strict(),
      )
      .max(30),
    experiencias: z
      .array(
        z
          .object({
            empresa: text,
            cargo: text,
            periodo: text,
            descricao: text,
            inicio: period,
            fim: period,
            atual: z.boolean(),
          })
          .strict(),
      )
      .max(60),
    skills: list,
    idiomas: list,
    certificacoes: list,
    resumo_profissional: z
      .object({ titulo: text, sintese: text, areas: list, senioridade: text })
      .strict(),
    projetos: z
      .array(
        z
          .object({
            nome: text,
            descricao: text,
            tecnologias: list,
            url: z.string().url().max(1000).nullable(),
            periodo: text,
          })
          .strict(),
      )
      .max(30),
    evidencias: z
      .array(
        z
          .object({
            campo: z.string().min(1).max(150),
            trecho: z.string().trim().min(1).max(600),
            pagina: z.number().int().min(1).max(20).nullable(),
            paragrafo: z.number().int().min(1).max(5000).nullable(),
            tipo: z.enum(["encontrado", "interpretacao"]),
            confianca: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(400),
    qualidade: z
      .object({
        idiomas_documento: list,
        problemas: z
          .array(
            z.enum([
              "baixa_resolucao",
              "colunas_ambiguas",
              "tabela_ambigua",
              "ilegivel",
              "instrucoes_suspeitas",
              "datas_ambiguas",
            ]),
          )
          .max(6),
      })
      .strict(),
    pontos_esclarecer: z.array(z.string().min(1).max(500)).max(12).default([]),
    perguntas_entrevista: z.array(z.string().min(1).max(500)).max(12).default([]),
    confianca: z.number().min(0).max(1),
    campos_incertos: z.array(z.string().min(1).max(150)).max(200),
  })
  .strict();
export type ResumeExtraction = z.infer<typeof extractionValidator>;

// Generate the transport schema from the same pinned Zod schema used to validate.
export const extractionSchema = z.toJSONSchema(extractionValidator, {
  target: "draft-7",
  io: "input",
});
const normalized = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const unique = (values: string[]) => [
  ...new Map(values.map((s) => [normalized(s), s.trim()])).values(),
];

export function validateExtraction(
  raw: unknown,
  source: { pages: number; text?: string; warnings?: string[] },
  today = new Date(),
) {
  const data = extractionValidator.parse(raw),
    reasons = new Set<string>();
  if (
    !data.nome_completo &&
    !data.email &&
    !data.telefone &&
    !data.experiencias.length &&
    !data.formacao_academica.length &&
    !data.skills.length
  ) {
    const error = new Error(
      "A leitura não encontrou informações verificáveis. Confira a legibilidade do original.",
    );
    error.name = "ExtractionRejected";
    throw error;
  }
  if (
    data.data_nascimento &&
    (data.data_nascimento > ageReferenceDate(today) || data.data_nascimento < "1900-01-01")
  ) {
    data.data_nascimento = null;
    reasons.add("data_nascimento");
  }
  data.skills = unique(data.skills);
  data.idiomas = unique(data.idiomas);
  data.certificacoes = unique(data.certificacoes);
  for (const project of data.projetos) {
    project.tecnologias = unique(project.tecnologias);
    if (project.url && !/^https?:\/\//i.test(project.url)) {
      project.url = null;
      reasons.add("projetos");
    }
  }
  const facts: Record<string, string> = {};
  const collect = (value: unknown, path: string) => {
    if (typeof value === "string" && value) facts[path] = value;
    else if (Array.isArray(value)) value.forEach((v, i) => collect(v, `${path}.${i}`));
    else if (value && typeof value === "object")
      Object.entries(value).forEach(([key, v]) => collect(v, `${path}.${key}`));
  };
  for (const key of [
    "nome_completo",
    "email",
    "telefone",
    "data_nascimento",
    "localizacao",
    "skills",
    "idiomas",
    "certificacoes",
    "experiencias",
    "formacao_academica",
    "projetos",
  ] as const)
    collect(data[key], key);
  const checked = data.evidencias.map((e) => {
    const exists = Object.hasOwn(facts, e.campo) || e.campo.startsWith("resumo_profissional.");
    const location = source.text
      ? e.paragrafo !== null && e.paragrafo <= source.text.split("\n").length
      : e.pagina !== null && e.pagina <= source.pages;
    const quote = source.text
      ? normalized(source.text.split("\n")[Math.max(0, (e.paragrafo ?? 0) - 1)] ?? "").includes(
          normalized(e.trecho),
        )
      : true;
    const directField = /^(nome_completo|email|skills\.\d+)$/.test(e.campo);
    const supportsValue =
      !directField || normalized(e.trecho).includes(normalized(facts[e.campo] ?? ""));
    const valid = exists && location && quote && supportsValue;
    if (
      !valid ||
      e.confianca < 0.85 ||
      (e.tipo !== "encontrado" && !e.campo.startsWith("resumo_profissional."))
    )
      reasons.add(e.campo);
    return {
      ...e,
      verificacao: !valid ? "inconsistente" : source.text ? "trecho_conferido" : "indicada_pela_ia",
    };
  });
  for (const field of Object.keys(facts))
    if (
      !checked.some(
        (e) =>
          e.campo === field &&
          e.tipo === "encontrado" &&
          e.verificacao !== "inconsistente" &&
          e.confianca >= 0.85,
      )
    )
      reasons.add(field);
  if (!data.nome_completo) reasons.add("nome_completo");
  if (!data.email && !data.telefone) reasons.add("contato");
  data.campos_incertos.forEach((field) => reasons.add(field));
  if (data.confianca < 0.6) reasons.add("baixa_confianca");
  data.qualidade.problemas.forEach((problem) => reasons.add(problem));
  source.warnings?.forEach((problem) => reasons.add(problem));
  if (
    source.text &&
    /ignore\s+(all|previous|todas|as|instru)|system\s*prompt|pontua[cç][aã]o\s*(m[aá]xima|100)|rank\s*(me|first)/i.test(
      source.text,
    )
  )
    reasons.add("instrucoes_suspeitas");
  const duration = experienceMonths(data.experiencias, today);
  duration.uncertain.forEach((index) => reasons.add(`experiencias.${index}.periodo`));
  data.formacao_academica.forEach((f, i) => {
    if (f.inicio && f.fim && f.inicio > f.fim) reasons.add(`formacao_academica.${i}.periodo`);
  });
  const coverage = Object.keys(facts).length
    ? Object.keys(facts).filter((field) =>
        checked.some(
          (e) => e.campo === field && e.verificacao !== "inconsistente" && e.tipo === "encontrado",
        ),
      ).length / Object.keys(facts).length
    : 0;
  return {
    extraction: {
      ...data,
      evidencias: checked,
      campos_incertos: [...reasons],
      schema_version: "2",
      anos_experiencia_total:
        duration.complete && duration.months !== null
          ? Math.round((duration.months / 12) * 100) / 100
          : null,
      experiencia_calculada: {
        meses_confirmados: duration.months,
        completa: duration.complete,
        metodo: "uniao_meses_inclusivos",
        referencia: today.toISOString().slice(0, 10),
      },
      controle_qualidade: {
        cobertura_evidencias: coverage,
        precisao_medida: null,
        motivos_revisao: [...reasons],
      },
    },
    status: reasons.size ? "revisao_manual" : "concluido",
  };
}
