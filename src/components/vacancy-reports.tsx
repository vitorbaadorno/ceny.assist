import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useBrowse } from "@/lib/company-browse";
import { downloadVacancyReport } from "@/lib/vacancy-report.functions";
import { reportDate, reportSections, type ReportAccess } from "@/lib/vacancy-report";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const unavailable =
  "Operação indisponível. Confira suas permissões e se a vaga e os candidatos continuam disponíveis.";
export function ReportPreview({ access }: { access: ReportAccess }) {
  return (
    <div className="space-y-4" aria-label="Conteúdo do relatório">
      {reportSections(access).map((s, i) => (
        <section key={i} className="space-y-2 rounded border p-4">
          <h3 className="font-semibold">{s.title}</h3>
          {s.paragraphs.map((p, n) => (
            <p key={n} className="whitespace-pre-wrap break-words text-sm">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

function ReportBuilder({
  companyId,
  jobId,
  run,
  onGenerated,
}: {
  companyId: string;
  jobId: string;
  run: Pick<Tables<"ranking_runs">, "id" | "completed_at" | "stale">;
  onGenerated: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [names, setNames] = useState(false),
    [notes, setNotes] = useState(false);
  const [q, setQ] = useState(""),
    [page, setPage] = useState(0);
  const retry = useRef<{ fingerprint: string; id: string } | null>(null);
  const people = useBrowse<Tables<"ranking_entries">>(
    "ranking",
    companyId,
    { q, outcome: "all" },
    page,
    run.id,
    "report-candidates",
  );
  const ids = Object.keys(selected);
  const generate = useMutation({
    mutationFn: async () => {
      const fingerprint = JSON.stringify([ids, names, notes]);
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = { fingerprint, id: crypto.randomUUID() };
      const result = await supabase.rpc("generate_vacancy_report", {
        p_company: companyId,
        p_job: jobId,
        p_run: run.id,
        p_candidates: ids,
        p_names: names,
        p_notes: notes,
        p_request: retry.current!.id,
      });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (id) => {
      retry.current = null;
      onGenerated(id);
      toast.success("Relatório salvo com as versões utilizadas.");
    },
    onError: (error: { code?: string; message?: string }) =>
      toast.error(error.code === "22023" ? error.message : unavailable),
  });
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Avaliação de {reportDate(run.completed_at!)}. Escolha até 100 candidatos. A seleção é
        mantida ao mudar de página.
      </p>
      {run.stale && (
        <p role="status" className="rounded border border-amber-500 p-3 text-sm">
          Avaliação desatualizada. O relatório será identificado como histórico. Para dados atuais,
          calcule a aderência novamente.
        </p>
      )}
      <label className="block text-sm">
        Buscar candidatos nesta avaliação
        <input
          className="mt-1 w-full rounded border bg-background p-2"
          value={q}
          maxLength={200}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
      </label>
      {people.isLoading && <p role="status">Carregando candidatos…</p>}
      {people.isError && (
        <p role="alert">
          Falha ao buscar candidatos.{" "}
          <Button variant="outline" onClick={() => people.refetch()}>
            Tentar novamente
          </Button>
        </p>
      )}
      {people.data && (
        <>
          <p className="text-sm">
            {people.data.filtered} candidatos encontrados · página {people.data.page + 1}
          </p>
          {!people.data.items.length && <p>Nenhum candidato nesta busca.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {people.data.items.map((e) => {
              const name =
                (e.snapshot as unknown as { nome?: string }).nome || "Nome não informado";
              return (
                <label
                  key={e.candidate_id}
                  className="flex items-start gap-2 rounded border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!!selected[e.candidate_id]}
                    disabled={
                      generate.isPending || (!selected[e.candidate_id] && ids.length >= 100)
                    }
                    onChange={(event) =>
                      setSelected((old) => {
                        const next = { ...old };
                        if (event.target.checked) next[e.candidate_id] = name;
                        else delete next[e.candidate_id];
                        return next;
                      })
                    }
                  />
                  <span>
                    {name}
                    <span className="block text-xs text-muted-foreground">
                      {e.reason ||
                        (e.score === null ? "Sem pontuação final" : `${e.score}% de aderência`)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={people.data.page === 0}
              onClick={() => setPage(people.data!.page - 1)}
            >
              Página anterior de candidatos
            </Button>
            <Button
              variant="outline"
              disabled={(people.data.page + 1) * people.data.pageSize >= people.data.filtered}
              onClick={() => setPage(people.data!.page + 1)}
            >
              Próxima página de candidatos
            </Button>
          </div>
        </>
      )}
      <div className="rounded border p-3 text-sm">
        <p className="font-medium">Incluídos no relatório: {ids.length}/100</p>
        <div className="flex flex-wrap gap-2 pt-2">
          {ids.map((id) => (
            <Button
              key={id}
              size="sm"
              variant="outline"
              disabled={generate.isPending}
              onClick={() =>
                setSelected((old) => {
                  const next = { ...old };
                  delete next[id];
                  return next;
                })
              }
            >
              Retirar {selected[id]}
            </Button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={names}
          disabled={generate.isPending}
          onChange={(e) => setNames(e.target.checked)}
        />
        Incluir nomes dos candidatos (por padrão: Candidato 1, Candidato 2…)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={notes}
          disabled={generate.isPending}
          onChange={(e) => setNotes(e.target.checked)}
        />
        Incluir observações do RH específicas desta vaga
      </label>
      <p className="text-sm text-muted-foreground">
        Decisões e justificativas do RH são identificadas separadamente. Confira os textos livres
        antes de compartilhar. Contatos, nascimento e currículos completos ficam fora das
        exportações.
      </p>
      <Button disabled={!ids.length || generate.isPending} onClick={() => generate.mutate()}>
        {generate.isPending
          ? "Gerando relatório…"
          : generate.isError
            ? "Tentar gerar novamente"
            : "Gerar relatório dos candidatos escolhidos"}
      </Button>
    </div>
  );
}

export function VacancyReports({
  companyId,
  jobId,
  canEdit,
}: {
  companyId: string;
  jobId: string;
  canEdit: boolean;
}) {
  const cache = useQueryClient();
  const download = useServerFn(downloadVacancyReport);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // The parent is keyed by company/job and the company provider unmounts on permission changes.
  // Download completion is guarded below against a scope that was left meanwhile.
  const [runId, setRunId] = useState("");
  const [runPage, setRunPage] = useState(0),
    [page, setPage] = useState(0);
  const [reportId, setReportId] = useState<string | null>(null);
  const [eventPage, setEventPage] = useState(0);
  const runs = useQuery({
    queryKey: ["report-runs", companyId, jobId, runPage],
    enabled: canEdit,
    queryFn: async ({ signal }) => {
      const r = await supabase
        .from("ranking_runs")
        .select("id,completed_at,stale")
        .eq("company_id", companyId)
        .eq("job_id", jobId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .order("id")
        .range(runPage * 10, runPage * 10 + 10)
        .abortSignal(signal);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const run = runs.data?.slice(0, 10).find((r) => r.id === runId) ?? runs.data?.[0];
  const reports = useQuery({
    queryKey: ["vacancy-reports", companyId, jobId, page],
    queryFn: async ({ signal }) => {
      const r = await supabase
        .from("vacancy_reports")
        .select("id,created_at,actor_name,candidate_ids,include_names,include_notes")
        .eq("company_id", companyId)
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(page * 10, page * 10 + 10)
        .abortSignal(signal);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const events = useQuery({
    queryKey: ["vacancy-report-events", companyId, reportId, eventPage],
    enabled: !!reportId,
    queryFn: async ({ signal }) => {
      const r = await supabase
        .from("vacancy_report_events")
        .select("id,action,actor_name,actor_id,created_at")
        .eq("company_id", companyId)
        .eq("report_id", reportId!)
        .order("created_at", { ascending: false })
        .order("id")
        .range(eventPage * 10, eventPage * 10 + 10)
        .abortSignal(signal);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const view = useMutation({
    mutationFn: async (id: string) => {
      const r = await supabase.rpc("access_vacancy_report", {
        p_company: companyId,
        p_report: id,
        p_action: "view",
      });
      if (r.error) throw r.error;
      return r.data as unknown as ReportAccess;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["vacancy-report-events", companyId] });
    },
    onError: () => toast.error(unavailable),
  });
  const open = (id: string) => {
    setReportId(id);
    setEventPage(0);
    view.reset();
    view.mutate(id);
  };
  const exporting = useMutation({
    mutationFn: async (format: "pdf" | "csv") => {
      const id = reportId!;
      const response = await download({ data: { companyId, reportId: id, format } });
      if (!response.ok) throw new Error(unavailable);
      const blob = await response.blob();
      if (!alive.current) return;
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `ceny-relatorio-${id}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["vacancy-report-events", companyId] });
      toast.success("Arquivo disponibilizado para download.");
    },
    onError: () => toast.error(unavailable),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatórios da vaga</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm">
          Salve uma versão dos candidatos escolhidos, com qualificações, evidências e decisões do
          RH. A geração, as consultas e as solicitações de download são registradas.
        </p>
        {canEdit ? (
          <details className="space-y-3 rounded border p-4">
            <summary className="cursor-pointer font-medium">Gerar novo relatório</summary>
            {runs.isError ? (
              <p role="alert">
                Falha ao buscar avaliações.{" "}
                <Button onClick={() => runs.refetch()} variant="outline">
                  Tentar novamente
                </Button>
              </p>
            ) : runs.isLoading ? (
              <p>Carregando avaliações…</p>
            ) : !runs.data?.length ? (
              <p>Calcule a aderência da vaga para criar o primeiro relatório.</p>
            ) : (
              <>
                <label className="block text-sm">
                  Avaliação utilizada
                  <select
                    className="mt-1 block w-full rounded border bg-background p-2"
                    value={run?.id}
                    onChange={(e) => setRunId(e.target.value)}
                  >
                    {runs.data.slice(0, 10).map((r) => (
                      <option value={r.id} key={r.id}>
                        {reportDate(r.completed_at!)}
                        {r.stale ? " · histórica/desatualizada" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={!runPage}
                    onClick={() => {
                      setRunPage(runPage - 1);
                      setRunId("");
                    }}
                  >
                    Avaliações mais recentes
                  </Button>
                  <Button
                    variant="outline"
                    disabled={runs.data.length <= 10}
                    onClick={() => {
                      setRunPage(runPage + 1);
                      setRunId("");
                    }}
                  >
                    Avaliações anteriores
                  </Button>
                </div>
                {run && (
                  <ReportBuilder
                    key={run.id}
                    companyId={companyId}
                    jobId={jobId}
                    run={run}
                    onGenerated={(id) => {
                      setPage(0);
                      void cache.invalidateQueries({
                        queryKey: ["vacancy-reports", companyId, jobId],
                      });
                      open(id);
                    }}
                  />
                )}
              </>
            )}
          </details>
        ) : (
          <p className="text-sm">
            Seu perfil permite consultar relatórios. Geração e exportação exigem permissão de
            responsável, administrador ou RH.
          </p>
        )}
        <h3 className="font-medium">Relatórios salvos</h3>
        {reports.isLoading && <p>Carregando relatórios…</p>}
        {reports.isError && (
          <p role="alert">
            Falha ao consultar relatórios.{" "}
            <Button variant="outline" onClick={() => reports.refetch()}>
              Tentar novamente
            </Button>
          </p>
        )}
        {reports.data?.length === 0 && <p>Nenhum relatório disponível.</p>}
        {reports.data?.slice(0, 10).map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm"
          >
            <span>
              {reportDate(r.created_at)} · {r.actor_name || "Autor não disponível"} ·{" "}
              {r.candidate_ids.length} candidatos
              {r.include_names ? " · com nomes" : " · sem nomes nos títulos"}
              {r.include_notes ? " · com notas" : ""}
            </span>
            <Button
              variant="outline"
              disabled={view.isPending || exporting.isPending}
              onClick={() => open(r.id)}
            >
              Consultar relatório
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>
            Relatórios mais recentes
          </Button>
          <Button
            variant="outline"
            disabled={!reports.data || reports.data.length <= 10}
            onClick={() => setPage(page + 1)}
          >
            Relatórios anteriores
          </Button>
        </div>
        {reportId && (
          <section className="space-y-4" aria-label="Relatório selecionado">
            <Button
              variant="outline"
              disabled={exporting.isPending || view.isPending}
              onClick={() => {
                setReportId(null);
                view.reset();
              }}
            >
              Fechar relatório
            </Button>
            {view.isPending && <p role="status">Consultando relatório…</p>}
            {view.isError && <p role="alert">{unavailable}</p>}
            {view.data && view.data.report.id === reportId && (
              <>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={exporting.isPending} onClick={() => exporting.mutate("pdf")}>
                      Baixar PDF
                    </Button>
                    <Button
                      variant="outline"
                      disabled={exporting.isPending}
                      onClick={() => exporting.mutate("csv")}
                    >
                      Exportar planilha CSV
                    </Button>
                  </div>
                )}
                {exporting.isPending && (
                  <p role="status">Preparando arquivo e conferindo acesso…</p>
                )}
                <ReportPreview access={view.data} />
              </>
            )}
            <h3 className="font-medium">Histórico de acesso</h3>
            <p className="text-xs text-muted-foreground">
              Downloads registram a liberação solicitada ao servidor; não confirmam que o arquivo
              foi salvo no dispositivo.
            </p>
            {events.isError && <p role="alert">Não foi possível consultar o histórico.</p>}
            {events.data?.slice(0, 10).map((e) => (
              <p key={e.id} className="break-words text-sm">
                {reportDate(e.created_at)} · {e.actor_name || "Autor não disponível"} (
                {e.actor_id || "Conta removida"}) ·{" "}
                {{
                  generated: "Geração",
                  view: "Consulta",
                  pdf: "Download PDF solicitado",
                  csv: "Download CSV solicitado",
                }[e.action] ?? e.action}
              </p>
            ))}
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!eventPage}
                onClick={() => setEventPage(eventPage - 1)}
              >
                Acessos mais recentes
              </Button>
              <Button
                variant="outline"
                disabled={!events.data || events.data.length <= 10}
                onClick={() => setEventPage(eventPage + 1)}
              >
                Acessos anteriores
              </Button>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
