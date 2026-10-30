import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  comparisonState,
  comparisonCriterion,
  type ComparisonData,
} from "@/lib/candidate-comparison";
import type { Tables } from "@/integrations/supabase/types";
import type { JobCriterion } from "../../supabase/functions/_shared/job-criteria";
import { Button } from "./ui/button";
export function CandidateComparison({
  companyId,
  jobId,
  ids,
  onRemove,
}: {
  companyId: string;
  jobId: string;
  ids: string[];
  onRemove: (id: string) => void;
}) {
  const result = useQuery({
    queryKey: ["candidate-comparison", companyId, jobId, ids],
    enabled: ids.length >= 2,
    refetchInterval: 5000,
    queryFn: async ({ signal }) => {
      const r = await supabase
        .rpc("compare_job_candidates", { p_company: companyId, p_job: jobId, p_candidates: ids })
        .abortSignal(signal);
      if (r.error) throw r.error;
      return r.data as unknown as ComparisonData;
    },
  });
  const data = result.data;
  const criteria = ((data?.run?.job_snapshot as unknown as Tables<"jobs"> | null)?.criteria ??
    data?.job.criteria ??
    []) as unknown as JobCriterion[];
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">Comparar candidatos lado a lado ({ids.length}/4)</h3>
      <p className="text-sm">
        Marque de 2 a 4 pessoas nas listas abaixo. Todas as colunas usam os critérios e os
        resultados de uma mesma avaliação salva. A decisão final é do RH.
      </p>
      {ids.length > 0 && (
        <Button variant="outline" onClick={() => ids.forEach(onRemove)}>
          Limpar comparação
        </Button>
      )}
      {ids.length < 2 ? (
        <p className="text-sm">Selecione pelo menos duas pessoas.</p>
      ) : result.isError ? (
        <p role="alert">
          Não foi possível comparar os candidatos. Confira o acesso e se os cadastros continuam
          disponíveis.{" "}
          <Button variant="outline" onClick={() => result.refetch()}>
            Tentar novamente
          </Button>
        </p>
      ) : !data ? (
        <p>Carregando comparação…</p>
      ) : (
        <>
          <p className="text-sm">
            {data.run
              ? `Avaliação de ${new Date(data.run.completed_at!).toLocaleString("pt-BR")} · critérios da versão ${(data.run.job_snapshot as unknown as Tables<"jobs">).version}`
              : "Sem avaliação publicada; os dados atuais são exibidos sem pontuação."}
          </p>
          {data.run?.stale && (
            <p role="status" className="rounded border border-amber-500 p-3">
              Avaliação desatualizada. Recalcule antes de utilizar as notas.
            </p>
          )}
          <div className="overflow-x-auto">
            <table
              style={{ minWidth: 192 + data.candidates.length * 240 }}
              className="w-full table-fixed border-collapse text-left text-sm"
            >
              <caption className="sr-only">Comparação segundo os mesmos critérios da vaga</caption>
              <thead>
                <tr>
                  <th className="w-48 border p-3">Critério / informação</th>
                  {data.candidates.map((p) => (
                    <th key={p.current.id} className="min-w-56 border p-3">
                      <Link
                        to="/candidatos/$id"
                        params={{ id: p.current.id }}
                        className="underline"
                      >
                        {p.current.nome || "Nome não informado"}
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Retirar ${p.current.nome || "candidato"} da comparação`}
                        onClick={() => onRemove(p.current.id)}
                      >
                        Retirar
                      </Button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="border p-3">Condição da avaliação</th>
                  {data.candidates.map((p) => {
                    const s = comparisonState(data, p);
                    return (
                      <td key={p.current.id} className="space-y-2 border p-3 align-top">
                        {s.stale && (
                          <p className="font-semibold text-amber-700">Análise desatualizada</p>
                        )}
                        {s.pending && <p>Cadastro atual com processamento ou revisão pendente.</p>}
                        {s.reason ? (
                          <p>{s.reason}</p>
                        ) : (
                          <p>
                            {p.entry?.score}% de aderência{" "}
                            {s.stale ? "(histórica)" : "aos critérios"}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {p.entry
                            ? "Dados do currículo na data desta avaliação."
                            : "Dados atuais; sem avaliação nesta versão."}
                        </p>
                      </td>
                    );
                  })}
                </tr>
                {(
                  [
                    ["localizacao", "Localização"],
                    ["anos_experiencia", "Experiência (anos)"],
                    ["skills", "Competências"],
                  ] as const
                ).map(([key, label]) => (
                  <tr key={key}>
                    <th className="border p-3">{label}</th>
                    {data.candidates.map((p) => {
                      const v = comparisonState(data, p).display[key];
                      return (
                        <td key={p.current.id} className="break-words border p-3 align-top">
                          {v === null ||
                          v === undefined ||
                          v === "" ||
                          (Array.isArray(v) && v.length === 0)
                            ? "Não informado"
                            : Array.isArray(v)
                              ? v.join(", ")
                              : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {criteria.map((c, i) => (
                  <tr key={i}>
                    <th className="border p-3 align-top">
                      {c.text}
                      <p className="font-normal">
                        {c.required ? "Obrigatório" : "Desejável"} · peso {c.weight}
                        {c.kind === "experience" ? ` · ${c.min_years} anos` : ""}
                      </p>
                    </th>
                    {data.candidates.map((p) => {
                      const m = comparisonCriterion(c, p.entry);
                      return (
                        <td
                          key={p.current.id}
                          className="space-y-2 break-words border p-3 align-top"
                        >
                          {m ? (
                            <>
                              <strong>
                                {{
                                  atendido: "Atendido",
                                  parcial: "Parcialmente comprovado",
                                  sem_informacao: "Informação insuficiente",
                                  nao_atendido: "Não atendido",
                                }[m.estado] ?? "Informação insuficiente"}
                              </strong>
                              <p>{m.motivo}</p>
                              {m.evidencias?.length ? (
                                <details>
                                  <summary className="cursor-pointer">Evidências</summary>
                                  {m.evidencias.map((e, n) => (
                                    <blockquote key={n} className="my-2 border-l-2 pl-2">
                                      {e.trecho}
                                      {e.pagina ? ` · página ${e.pagina}` : ""}
                                    </blockquote>
                                  ))}
                                </details>
                              ) : (
                                <p className="text-xs">Sem trecho de evidência disponível.</p>
                              )}
                            </>
                          ) : (
                            "Sem avaliação deste critério."
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!criteria.length && <p>Critérios não informados. Nenhuma pontuação é presumida.</p>}
        </>
      )}
    </section>
  );
}
