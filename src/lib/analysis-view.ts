import { z } from "zod";
const text = z.string().nullish();
const strings = z.array(z.string()).optional().default([]);
export const analysisView = z.object({
  schema_version: z.literal("2"),
  resumo_profissional: z
    .object({ titulo: text, sintese: text, areas: strings, senioridade: text })
    .nullish(),
  projetos: z
    .array(
      z.object({ nome: text, descricao: text, tecnologias: strings, url: text, periodo: text }),
    )
    .optional(),
  evidencias: z
    .array(
      z.object({
        campo: z.string(),
        trecho: z.string(),
        pagina: z.number().nullish(),
        paragrafo: z.number().nullish(),
        tipo: z.string(),
        confianca: z.number().optional(),
        verificacao: text,
      }),
    )
    .optional(),
  experiencia_calculada: z
    .object({ meses_confirmados: z.number().nullable(), completa: z.boolean(), referencia: text })
    .nullish(),
  controle_qualidade: z
    .object({ cobertura_evidencias: z.number(), motivos_revisao: strings })
    .nullish(),
});
