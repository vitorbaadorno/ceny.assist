import { criterionKey, type JobCriterion } from "./job-criteria.ts";
export type MatchState = "atendido" | "parcial" | "sem_informacao" | "nao_atendido";
export type Evidence = {
  campo: string;
  trecho: string;
  pagina: number | null;
  origem: "trecho_conferido" | "extracao" | "correcao_rh";
};
type Fact = {
  text: string;
  path: string;
  context: "skill" | "work" | "education" | "location";
  period?: string;
  end?: string;
};
type RecordData = Record<string, unknown>;
const object = (v: unknown): RecordData =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as RecordData) : {};
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 2000) : "");
// Small, versioned dictionary: equivalence, never broad fuzzy similarity.
export const EQUIVALENCES = [
  ["javascript", "js", "ecmascript"],
  ["typescript", "ts"],
  ["excel", "microsoft excel", "ms excel"],
  ["power bi", "powerbi", "microsoft power bi"],
  ["postgresql", "postgres"],
  ["recursos humanos", "rh"],
  ["gestao de projetos", "gerenciamento de projetos", "project management"],
  ["ingles", "english"],
  ["administracao", "administration"],
];
const boundary = (term: string) =>
  new RegExp(
    `(?:^|[^\\p{L}\\p{N}_+#])(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^\\p{L}\\p{N}_+#])`,
    "u",
  );
function canonical(text: string) {
  let s = criterionKey(text);
  for (const group of EQUIVALENCES)
    for (const alias of [...group].sort((a, b) => b.length - a.length))
      s = s.replace(
        new RegExp(
          `(^|[^\\p{L}\\p{N}_+#])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}_+#])`,
          "gu",
        ),
        `$1${group[0]}`,
      );
  return s;
}
const level = (s: string) =>
  /\b(avancado|fluente|advanced|fluent)\b/.test(s)
    ? 3
    : /\b(intermediario|intermediate)\b/.test(s)
      ? 2
      : /\b(basico|iniciante|basic|beginner)\b/.test(s)
        ? 1
        : 0;
const cleanRequirement = (s: string) =>
  s
    .replace(
      /\b(nivel|avancado|fluente|advanced|fluent|intermediario|intermediate|basico|iniciante|basic|beginner|experiencia|comprovada|conhecimento|dominio|em|com|de|formacao|graduacao|concluida|concluido|completo|completa|cursando|andamento)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
const negative = (s: string) =>
  /\b(nao|sem|nunca|not|no|never|without)\b/.test(s) && !/\bnao (apenas|somente|so)\b/.test(s);
const uncertainty = (s: string) =>
  /\b(aprendendo|estudando|interesse|pretendo|desejo|learning|wish|interested)\b/.test(s);

export function evaluateCriterion(
  c: JobCriterion,
  candidate: {
    skills?: string[] | null;
    localizacao?: string | null;
    anos_experiencia?: number | null;
    dados_extraidos?: unknown;
    correcoes_rh?: unknown;
  },
) {
  const data = object(candidate.dados_extraidos),
    corrections = object(candidate.correcoes_rh),
    facts: Fact[] = [];
  const add = (
    text: unknown,
    path: string,
    context: Fact["context"],
    extra: Partial<Fact> = {},
  ) => {
    if (str(text).trim()) facts.push({ text: str(text), path, context, ...extra });
  };
  array(candidate.skills).forEach((s, i) => add(s, `skills.${i}`, "skill"));
  for (const key of ["idiomas", "certificacoes"])
    array(data[key]).forEach((s, i) => add(s, `${key}.${i}`, "skill"));
  array(data["experiencias"]).forEach((v, i) => {
    const e = object(v);
    for (const key of ["cargo", "descricao"]) add(e[key], `experiencias.${i}.${key}`, "work");
  });
  array(data["projetos"]).forEach((v, i) => {
    const e = object(v);
    add(e["descricao"], `projetos.${i}.descricao`, "work");
    array(e["tecnologias"]).forEach((s, j) => add(s, `projetos.${i}.tecnologias.${j}`, "work"));
  });
  array(data["formacao_academica"]).forEach((v, i) => {
    const e = object(v);
    for (const key of ["curso", "nivel"])
      add(e[key], `formacao_academica.${i}.${key}`, "education", {
        period: str(e["periodo"]),
        end: str(e["fim"]),
      });
  });
  add(candidate.localizacao, "localizacao", "location");
  const evidence = (f: Fact): Evidence => {
    if (Object.hasOwn(corrections, f.path.split(".")[0]!))
      return { campo: f.path, trecho: f.text, pagina: null, origem: "correcao_rh" };
    const e = array(data["evidencias"])
      .map(object)
      .find(
        (e) =>
          e["campo"] === f.path &&
          e["tipo"] === "encontrado" &&
          e["verificacao"] === "trecho_conferido" &&
          criterionKey(str(e["trecho"])).includes(criterionKey(f.text)),
      );
    return {
      campo: f.path,
      trecho: e ? str(e["trecho"]) : f.text,
      pagina: e && typeof e["pagina"] === "number" ? e["pagina"] : null,
      origem: e ? "trecho_conferido" : "extracao",
    };
  };
  const result = (estado: MatchState, proporcao: number, motivo: string, fs: Fact[] = []) => ({
    estado,
    proporcao,
    motivo,
    evidencias: fs.slice(0, 4).map(evidence),
  });
  if (c.kind === "experience") {
    const years = candidate.anos_experiencia;
    if (typeof years !== "number" || !Number.isFinite(years) || years < 0)
      return result(
        "sem_informacao",
        0,
        "Tempo de experiência não informado; não equivale a zero anos comprovados.",
      );
    const fraction = c.min_years === 0 ? 1 : Math.min(years / c.min_years!, 1);
    return result(
      fraction === 1 ? "atendido" : fraction > 0 ? "parcial" : "nao_atendido",
      fraction,
      `${years} ano(s) registrados; exigência de ${c.min_years} ano(s).`,
      [{ text: String(years), path: "anos_experiencia_total", context: "work" }],
    );
  }
  const requirement = canonical(c.text),
    term = c.kind === "location" ? requirement : cleanRequirement(requirement),
    wantedLevel = level(requirement);
  if (!term)
    return result(
      "sem_informacao",
      0,
      "O requisito é genérico; o RH precisa especificar a competência ou formação.",
    );
  const suitable = facts.filter((f) =>
    c.kind === "education"
      ? f.context === "education"
      : c.kind === "location"
        ? f.context === "location"
        : f.context !== "location" && f.context !== "education",
  );
  const hits: Array<{ fact: Fact; fraction: number; state: MatchState; reason: string }> = [];
  for (const f of suitable) {
    // Clause boundaries prevent a negation about Excel from negating SQL in another clause.
    const source = evidence(f);
    const contextual = source.origem === "trecho_conferido" ? source.trecho : f.text;
    for (const clause of canonical(contextual.replace(/[\w.+-]+@[\w.-]+\.[a-z]+/gi, "")).split(
      /[;.!?\n]|\bmas\b|\bbut\b/,
    )) {
      if (!boundary(term).test(c.kind === "location" ? clause : cleanRequirement(clause))) continue;
      if (negative(clause)) {
        hits.push({
          fact: f,
          fraction: 0,
          state: "nao_atendido",
          reason: "O dado contém uma negação explícita deste requisito.",
        });
        continue;
      }
      if (c.kind === "education") {
        const status = canonical(`${f.period} ${f.text}`);
        if (/\b(incomplet|interrompid|trancad|abandonad|incomplete|dropped)/.test(status))
          hits.push({
            fact: f,
            fraction: 0,
            state: "nao_atendido",
            reason: "A formação correspondente está indicada como incompleta ou interrompida.",
          });
        else if (/\b(cursando|andamento|previst|ongoing|progress)/.test(status))
          hits.push({
            fact: f,
            fraction: /cursando|andamento/.test(requirement) ? 1 : 0.5,
            state: /cursando|andamento/.test(requirement) ? "atendido" : "parcial",
            reason: "A formação correspondente está em andamento.",
          });
        else if (/\b(concluid|complet|graduated)/.test(status))
          hits.push({
            fact: f,
            fraction: 1,
            state: "atendido",
            reason: "A formação correspondente está explicitamente indicada como concluída.",
          });
        else
          hits.push({
            fact: f,
            fraction: 0.5,
            state: "parcial",
            reason:
              "O curso foi identificado, mas a conclusão não está informada; uma data isolada não comprova conclusão.",
          });
      } else if (uncertainty(clause))
        hits.push({
          fact: f,
          fraction: 0.5,
          state: "parcial",
          reason: "Há aprendizado ou interesse declarado; isso não comprova domínio profissional.",
        });
      else if (wantedLevel && level(clause) < wantedLevel)
        hits.push({
          fact: f,
          fraction: 0.5,
          state: "parcial",
          reason: level(clause)
            ? "O nível declarado é inferior ao exigido."
            : "A competência foi identificada, mas o nível exigido não está informado.",
        });
      else if (/\bexperiencia\b/.test(requirement) && f.context !== "work")
        hits.push({
          fact: f,
          fraction: 0.5,
          state: "parcial",
          reason: "A competência está declarada, mas não está vinculada a experiência ou projeto.",
        });
      else
        hits.push({
          fact: f,
          fraction: 1,
          state: "atendido",
          reason:
            "Correspondência literal ou equivalência cadastrada em um campo profissional pertinente.",
        });
    }
  }
  if (!hits.length)
    return result(
      "sem_informacao",
      0,
      "Não há informação profissional suficiente para confirmar este requisito.",
    );
  if (hits.some((h) => h.state === "nao_atendido") && hits.some((h) => h.fraction > 0))
    return result(
      "sem_informacao",
      0,
      "Há informações contraditórias; o RH deve conferir antes de concluir.",
      hits.map((h) => h.fact),
    );
  hits.sort((a, b) => b.fraction - a.fraction);
  const best = hits[0]!;
  return result(
    best.state,
    best.fraction,
    best.reason,
    hits.filter((h) => h.fraction === best.fraction).map((h) => h.fact),
  );
}
