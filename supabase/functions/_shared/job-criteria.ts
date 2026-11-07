export type JobCriterion = {
  kind: "skill" | "experience" | "education" | "location";
  text: string;
  min_years: number | null;
  required: boolean;
  weight: number;
  source: string | null;
};
export type JobPayload = {
  titulo: string;
  descricao: string;
  categoria: "regular" | "jovem_aprendiz";
  criteria: JobCriterion[];
};
export const criterionKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
export const criterionLabels = {
  skill: "Competência ou requisito",
  experience: "Experiência mínima",
  education: "Formação",
  location: "Localização",
};

export function normalizeCriteria(value: unknown): JobCriterion[] {
  if (!Array.isArray(value) || value.length > 60 || JSON.stringify(value).length > 60000)
    throw new Error("Use até 60 critérios.");
  const result: JobCriterion[] = [];
  for (const raw of value) {
    if (
      !raw ||
      typeof raw !== "object" ||
      Object.keys(raw).sort().join() !== "kind,min_years,required,source,text,weight" ||
      !Object.hasOwn(criterionLabels, raw.kind) ||
      typeof raw.text !== "string" ||
      !raw.text.trim() ||
      raw.text.trim().length > 200 ||
      typeof raw.required !== "boolean" ||
      !Number.isInteger(raw.weight) ||
      raw.weight < 1 ||
      raw.weight > 100 ||
      (raw.kind === "experience"
        ? typeof raw.min_years !== "number" ||
          !Number.isFinite(raw.min_years) ||
          raw.min_years < 0 ||
          raw.min_years > 100
        : raw.min_years !== null) ||
      (raw.source !== null &&
        (typeof raw.source !== "string" || raw.source.length < 1 || raw.source.length > 2000))
    ) {
      throw new Error(
        "Confira o critério: texto obrigatório, peso inteiro de 1 a 100 e experiência de 0 a 100 anos.",
      );
    }
    const item = { ...raw, text: raw.text.trim() } as JobCriterion;
    const previous = result.find(
      (c) =>
        c.kind === item.kind &&
        (item.kind !== "skill" || criterionKey(c.text) === criterionKey(item.text)),
    );
    if (!previous) result.push(item);
    else {
      if (
        item.kind !== "skill" &&
        (criterionKey(previous.text) !== criterionKey(item.text) ||
          previous.min_years !== item.min_years)
      )
        throw new Error(
          "Defina um único critério coerente de experiência, formação ou localização.",
        );
      previous.required ||= item.required;
      previous.weight = Math.max(previous.weight, item.weight);
    }
  }
  return result;
}
export function validateJobPayload(value: JobPayload, approve = false): JobPayload {
  if (
    typeof value.titulo !== "string" ||
    value.titulo.trim().length < 3 ||
    value.titulo.trim().length > 160 ||
    typeof value.descricao !== "string" ||
    value.descricao.length > 20000 ||
    !["regular", "jovem_aprendiz"].includes(value.categoria)
  )
    throw new Error(
      "Informe um título de 3 a 160 caracteres e uma descrição com até 20.000 caracteres.",
    );
  const payload = {
    ...value,
    titulo: value.titulo.trim(),
    descricao: value.descricao.trim(),
    criteria: normalizeCriteria(value.criteria),
  };
  if (approve) {
    if (
      payload.descricao.length < 20 ||
      !payload.criteria.some(
        (c) =>
          c.kind === "skill" ||
          c.kind === "education" ||
          (c.kind === "experience" && c.min_years! > 0),
      )
    )
      throw new Error(
        "Descreva a vaga e inclua ao menos uma competência, formação ou experiência positiva antes de aprovar.",
      );
    if (
      payload.criteria.some(
        (c) =>
          c.source !== null && !criterionKey(payload.descricao).includes(criterionKey(c.source)),
      )
    )
      throw new Error(
        "Um trecho da descrição mudou. Confira o critério e confirme sua origem manualmente.",
      );
  }
  return payload;
}

// Deliberately conservative, local suggestions. Nothing is approved automatically.
export function suggestCriteria(description: string): JobCriterion[] {
  let section: boolean | null = null;
  const suggestions: JobCriterion[] = [];
  for (const original of description.split(/\r?\n/)) {
    let line = original.trim().replace(/^(?:[-*•]\s*|\d+[.)]\s+)/, "");
    if (!line) continue;
    const heading = criterionKey(line);
    if (/^(desejaveis|diferenciais|desejavel|diferencial)\b/.test(heading)) section = false;
    else if (/^(requisitos|obrigatorios|obrigatorio|exigencias)\b/.test(heading)) section = true;
    else if (/^(beneficios|responsabilidades|atividades|sobre|salario)\b/.test(heading)) {
      section = null;
      continue;
    }
    if (section === null) continue;
    line = line.replace(
      /^(requisitos(?: obrigatórios)?|obrigatórios?|exigências|desejáveis|desejável|diferenciais|diferencial)\s*:?\s*/i,
      "",
    );
    if (!line || line.length > 200 || original.trim().length > 2000) continue;
    const years = line.match(/(\d+(?:[.,]\d+)?)\s+anos?\b/i);
    const kind =
      years && /experi[eê]ncia/i.test(line)
        ? "experience"
        : /forma[cç][aã]o|gradua[cç][aã]o|ensino|bacharel|tecn[oó]logo/i.test(line)
          ? "education"
          : "skill";
    suggestions.push({
      kind,
      text: line,
      min_years: kind === "experience" ? Number(years![1]!.replace(",", ".")) : null,
      required: section,
      weight: section ? 5 : 3,
      source: original.trim(),
    });
    if (suggestions.length === 60) break;
  }
  return suggestions;
}

// Preserve the stored snapshot. Editors and views can flag incompatible legacy data.
export function readCriteria(value: unknown): JobCriterion[] | null {
  try {
    if (!Array.isArray(value) || value.length > 60) return null;
    return value.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row))
        throw new Error("Critério inválido.");
      // Early revisions omitted source. Keep order and duplicate entries in the historical snapshot.
      return normalizeCriteria([{ source: null, ...row }])[0]!;
    });
  } catch {
    return null;
  }
}
