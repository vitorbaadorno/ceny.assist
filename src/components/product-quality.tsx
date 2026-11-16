import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QueryError } from "./query-feedback";
type Metrics = {
  selected_files: number;
  received_files: number;
  rejected_files: number;
  abandoned_files: number;
  pending_files: number;
  upload_failure_rate: number | null;
  analysis_p50_ms: number | null;
  analysis_p95_ms: number | null;
  analysis_failed: number;
  analysis_blocked: number;
  human_reviews_recorded: number;
  formats: { format: string; total: number; rejected: number }[];
};
const seconds = (value: number | null) =>
  value === null
    ? "Sem medição"
    : `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
export function ProductQuality({ companyId }: { companyId: string }) {
  const query = useQuery({
    queryKey: ["product-quality", companyId],
    queryFn: async () => {
      const result = await supabase.rpc("product_quality_metrics", {
        p_company: companyId,
        p_since: new Date(Date.now() - 30 * 86400000).toISOString(),
      });
      if (result.error) throw result.error;
      return result.data as unknown as Metrics;
    },
    refetchInterval: 60000,
  });
  if (query.isError)
    return (
      <QueryError
        error={query.error}
        retry={() => query.refetch()}
        busy={query.isFetching}
        fallback="Métricas de qualidade indisponíveis."
      />
    );
  if (!query.data) return <p role="status">Consultando qualidade…</p>;
  const m = query.data;
  return (
    <section className="space-y-3 rounded border p-4" aria-labelledby="product-quality-title">
      <h2 id="product-quality-title" className="font-semibold">
        Qualidade do produto — últimos 30 dias
      </h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {[
          [
            "Falhas de upload",
            m.upload_failure_rate === null
              ? "Sem medição"
              : `${(m.upload_failure_rate * 100).toFixed(1)}%`,
          ],
          ["Arquivos cancelados ou não recebidos", m.abandoned_files],
          ["Arquivos ainda pendentes", m.pending_files],
          ["Tempo até análise — mediana", seconds(m.analysis_p50_ms)],
          ["Tempo até análise — percentil 95", seconds(m.analysis_p95_ms)],
          ["Análises com falha / bloqueadas", `${m.analysis_failed} / ${m.analysis_blocked}`],
          ["Revisões humanas registradas", m.human_reviews_recorded],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="text-left">Envios por formato</caption>
          <thead>
            <tr>
              <th scope="col">Formato</th>
              <th scope="col">Selecionados</th>
              <th scope="col">Recusados</th>
            </tr>
          </thead>
          <tbody>
            {m.formats.map((row) => (
              <tr key={row.format}>
                <th scope="row">{row.format}</th>
                <td>{row.total}</td>
                <td>{row.rejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Contagens da empresa, sem conteúdo dos currículos. O tempo inclui espera e tentativas
        concluídas. Revisões refletem o histórico ainda conservado. Arquivos pendentes não são
        classificados como abandono.
      </p>
    </section>
  );
}
