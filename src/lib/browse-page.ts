import { z } from "zod";
const text = z.string().nullish();
const strings = z
  .array(z.string())
  .nullish()
  .transform((value) => value ?? []);
const candidate = z.looseObject({
  id: z.string(),
  nome: text,
  email: text,
  telefone: text,
  localizacao: text,
  arquivo_nome: text,
  skills: strings,
  status: z.string(),
  processing_status: text,
  review_status: text,
  anos_experiencia: z.number().nullish(),
});
const job = z.looseObject({
  id: z.string(),
  titulo: z.string(),
  descricao: text,
  status: z.string(),
  categoria: text,
  approved_hash: text,
  requisitos_obrigatorios: strings,
});
const entry = z.looseObject({
  candidate_id: z.string(),
  snapshot: z.looseObject({
    nome: text,
    localizacao: text,
    anos_experiencia: z.number().nullish(),
  }),
});
const meta = z.object({
  total: z.number().int().nonnegative(),
  filtered: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive().max(100),
  items: z.array(z.unknown()).max(100),
});
export function decodeBrowsePage(kind: "jobs" | "candidates" | "ranking", data: unknown) {
  const page = meta.safeParse(data);
  const items = page.success
    ? z
        .array(kind === "jobs" ? job : kind === "candidates" ? candidate : entry)
        .safeParse(page.data.items)
    : null;
  if (!page.success || !items?.success)
    throw Object.assign(new Error("Dados incompatíveis na consulta."), {
      code: "INVALID_RESPONSE",
    });
  return { ...page.data, items: items.data };
}
