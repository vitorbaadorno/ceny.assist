import { z } from "zod";
import type { MatchDetails } from "@/lib/scoring";
const scoreView = z.object({
  pontuacao_antes_limite: z.number(),
  criterios: z.array(
    z.object({
      text: z.string(),
      estado: z.enum(["atendido", "parcial", "sem_informacao", "nao_atendido"]),
      pontos: z.number(),
      weight: z.number(),
      motivo: z.string(),
      evidencias: z.array(
        z.object({ trecho: z.string(), origem: z.string(), pagina: z.number().nullish() }),
      ),
    }),
  ),
});
export function ScoreExplanation({
  details,
  jobVersion,
}: {
  details: MatchDetails;
  jobVersion: number | null;
}) {
  if (!scoreView.safeParse(details).success)
    return <p>Detalhamento indisponível para esta versão da avaliação.</p>;
  return (
    <>
      {details.criterios && (
        <details className="text-xs">
          <summary className="cursor-pointer">
            Como esta nota foi calculada · versão {jobVersion}
          </summary>
          <ul className="mt-2 space-y-1">
            {details.criterios.map((c, i) => (
              <li key={i}>
                {c.text}:{" "}
                {{
                  atendido: "Atendido",
                  parcial: "Parcialmente comprovado",
                  sem_informacao: "Sem informação suficiente",
                  nao_atendido: "Não atendido por evidência explícita",
                }[c.estado] ?? "Avaliação anterior"}{" "}
                · peso {c.weight} · {c.pontos.toFixed(1)} pontos
                <p className="mt-1 text-muted-foreground">{c.motivo}</p>
                {c.evidencias?.map((e, n) => (
                  <blockquote key={n} className="my-2 border-l-2 pl-3">
                    “{e.trecho}”
                    <p className="text-muted-foreground">
                      {e.origem === "correcao_rh"
                        ? "Correção do RH"
                        : e.origem === "trecho_conferido"
                          ? "Trecho conferido no documento"
                          : "Dado extraído; trecho original não conferido"}
                      {e.pagina ? ` · página ${e.pagina}` : ""}
                    </p>
                  </blockquote>
                ))}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Nota antes do limite obrigatório: {details.pontuacao_antes_limite}%.
          </p>
        </details>
      )}
    </>
  );
}
