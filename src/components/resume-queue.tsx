import { readCandidateQueue } from "@/data/resume-queue";
import { readBatchHistory } from "@/data/resume-queue";
import { jobLabels, phaseLabels, isActiveJob } from "@/lib/workflow-states";
import { useRef, useState } from "react";
import { QueryError } from "@/components/query-feedback";
import { errorFeedback, displayDate, requireSavedId } from "@/lib/ui-feedback";
import { refreshCompanyLists } from "@/lib/company-browse";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Job = Pick<
  Tables<"resume_jobs">,
  "state" | "phase" | "generation" | "attempts" | "available_at" | "message"
>;
// A retry after an uncertain network response carries the same command identifier.
function useQueueCommand() {
  const keys = useRef(new Map<string, string>());
  return {
    start(scope: string) {
      const key = keys.current.get(scope) ?? crypto.randomUUID();
      keys.current.set(scope, key);
      return key;
    },
    finish(scope: string) {
      keys.current.delete(scope);
    },
  };
}
export function JobProgress({ job }: { job: Job }) {
  return (
    <div className="space-y-1 text-sm" role="status">
      <p className="font-medium">
        {jobLabels[job.state] ?? "Situação da leitura não confirmada"}
        {job.state === "running" ? ` · ${phaseLabels[job.phase] ?? "Processando"}` : ""}
      </p>
      <p>
        Leitura {job.generation} · Tentativa {job.attempts} de 3
      </p>
      {job.state === "retry_wait" && (
        <p>Nova tentativa a partir de {displayDate(job.available_at)}.</p>
      )}
      {job.message && <p>{job.message}</p>}
      {job.state === "blocked" && (
        <p>O administrador precisa corrigir a configuração antes de repetir.</p>
      )}
      {job.state === "review" && (
        <p>Confira e corrija os dados do candidato antes de solicitar outra leitura.</p>
      )}
    </div>
  );
}

export function CandidateQueue({
  companyId,
  candidateId,
  canEdit,
  documentId,
  showHistory = false,
}: {
  companyId: string;
  candidateId: string;
  canEdit: boolean;
  documentId?: string | null;
  showHistory?: boolean;
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["candidate-queue", companyId, candidateId, documentId, showHistory],
    queryFn: ({ signal }) =>
      readCandidateQueue(companyId, candidateId, documentId, showHistory, signal),
    refetchInterval: (q) => (q.state.data?.some(isActiveJob) ? 5000 : false),
  });
  const job = query.data?.[0];
  const command = useQueueCommand();
  const action = useMutation({
    mutationFn: async (mode: "retry" | "cancel" | "reprocess") => {
      const document = documentId ?? job!.document_id;
      const scope = [companyId, mode, mode === "reprocess" ? document : job!.id].join("/");
      const request = command.start(scope);
      const response =
        mode === "reprocess"
          ? await supabase.rpc("request_document_analysis", {
              p_company: companyId,
              p_document: documentId ?? job!.document_id,
              p_request: request,
            })
          : await supabase.rpc("ops_control_queue", {
              p_request: request,
              p_batch: null,
              p_company: companyId,
              p_job: job!.id,
              p_action: mode,
            });
      if (response.error) throw response.error;
      requireSavedId(response.data);
      command.finish(scope);
      return mode;
    },
    onSuccess: async (mode) => {
      await refreshCompanyLists(client, companyId);
      toast.info(mode === "cancel" ? "Leitura cancelada." : "Leitura adicionada à fila.");
    },
    onError: (error) =>
      toast.error(
        errorFeedback(
          error,
          "Não foi possível confirmar a alteração. Confira a fila antes de repetir.",
        ).message,
      ),
  });
  if (query.isError)
    return (
      <QueryError
        error={query.error}
        retry={() => query.refetch()}
        busy={query.isFetching}
        fallback="Não foi possível consultar a fila de leitura."
      />
    );
  if (!job) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leitura do currículo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <JobProgress job={job} />
        <p className="text-xs text-muted-foreground">
          A leitura continua ao sair desta página. Até 2 documentos simultâneos por empresa e 2
          minutos por tentativa.
        </p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {["queued", "retry_wait"].includes(job.state) && (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() => action.mutate("cancel")}
              >
                Cancelar leitura pendente
              </Button>
            )}
            {["failed", "blocked"].includes(job.state) && (
              <Button disabled={action.isPending} onClick={() => action.mutate("retry")}>
                Repetir leitura que falhou
              </Button>
            )}
            {["succeeded", "review", "cancelled"].includes(job.state) && (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() => action.mutate("reprocess")}
              >
                Reprocessar currículo
              </Button>
            )}
          </div>
        )}
        {!!job.resume_job_attempts.length && (
          <details>
            <summary className="cursor-pointer text-sm">Tentativas desta leitura</summary>
            {[...job.resume_job_attempts]
              .sort((a, b) => a.attempt - b.attempt)
              .map((a) => (
                <div className="mt-2 space-y-1 text-xs" key={a.attempt}>
                  <p>
                    Tentativa {a.attempt} · {displayDate(a.started_at)} ·{" "}
                    {jobLabels[a.outcome] ??
                      (a.outcome === "interrupted" ? "Interrompida pelo sistema" : a.outcome)}
                    {a.message ? ` · ${a.message}` : ""}
                  </p>
                  <p>
                    Modelo: {a.model_reported ?? a.model_requested ?? "Não registrado"} · Duração:{" "}
                    {a.duration_ms === null
                      ? "Não informada"
                      : `${(a.duration_ms / 1000).toFixed(1)} s`}
                  </p>
                  <p>
                    Consumo informado pelo provedor: {a.input_tokens ?? "Não informado"} tokens de
                    entrada · {a.output_tokens ?? "Não informado"} de saída ·{" "}
                    {a.total_tokens ?? "Não informado"} no total.
                  </p>
                  {a.prompt_version && (
                    <details>
                      <summary className="cursor-pointer">
                        Instruções usadas: {a.prompt_version}
                      </summary>
                      <p className="break-all">Identificador: {a.prompt_hash}</p>
                      <AttemptDetail
                        companyId={companyId}
                        jobId={job.id}
                        attempt={a.attempt}
                        field="prompt_snapshot"
                      />
                    </details>
                  )}
                </div>
              ))}
          </details>
        )}
        {showHistory && query.data && query.data.length > 1 && (
          <details className="text-sm">
            <summary>Leituras anteriores deste documento</summary>
            {query.data.slice(1).map((previous) => (
              <div className="mt-3 rounded border p-3" key={previous.id}>
                <JobProgress job={previous} />
                <p>{displayDate(previous.created_at)}</p>
                {previous.resume_job_attempts.map((a) => (
                  <details key={a.attempt}>
                    <summary>
                      Tentativa {a.attempt} ·{" "}
                      {a.model_reported ?? a.model_requested ?? "Modelo não registrado"} ·{" "}
                      {a.prompt_version ?? "Instruções não registradas"}
                    </summary>
                    <p>
                      Duração: {a.duration_ms ?? "Não informada"} ms · Consumo:{" "}
                      {a.total_tokens ?? "Não informado"} tokens
                    </p>
                    <AttemptDetail
                      companyId={companyId}
                      jobId={previous.id}
                      attempt={a.attempt}
                      field="extraction"
                    />
                  </details>
                ))}
              </div>
            ))}
            {query.data.length === 100 && (
              <p>Exibindo as 100 leituras mais recentes. As anteriores permanecem registradas.</p>
            )}
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export function BatchHistory({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["resume-batches", companyId],
    queryFn: () => readBatchHistory(companyId),
    refetchInterval: (q) =>
      q.state.data?.some((b) => b.entries.some((e) => e.state === "waiting" || isActiveJob(e.job)))
        ? 5000
        : false,
  });
  const command = useQueueCommand();
  const action = useMutation({
    mutationFn: async ({ batch, mode }: { batch: string; mode: "retry" | "cancel" }) => {
      const scope = [companyId, batch, mode].join("/");
      const { data, error } = await supabase.rpc("ops_control_queue", {
        p_request: command.start(scope),
        p_job: null,
        p_company: companyId,
        p_batch: batch,
        p_action: mode,
      });
      if (error) throw error;
      if (typeof data !== "number") throw new Error("Alteração do lote não confirmada.");
      command.finish(scope);
    },
    onSuccess: () => refreshCompanyLists(client, companyId),
    onError: (error) =>
      toast.error(errorFeedback(error, "Não foi possível confirmar a alteração do lote.").message),
  });
  const entryLabels: Record<string, string> = {
    waiting: "Aguardando recebimento",
    rejected: "Arquivo recusado",
    missing: "Envio interrompido: selecione o arquivo novamente",
    cancelled: "Envio cancelado",
    received: "Recebido",
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de lotes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Últimos 20 lotes. Atualização a cada 5 segundos. Falhas de leitura podem ser repetidas sem
          enviar o arquivo novamente; arquivos não recebidos precisam ser selecionados novamente.
        </p>
        {query.isError && (
          <QueryError
            error={query.error}
            retry={() => query.refetch()}
            busy={query.isFetching}
            fallback="Não foi possível consultar os lotes."
          />
        )}
        {!query.isError && query.data?.length === 0 && <p>Nenhum lote enviado.</p>}
        {query.data?.map((batch) => {
          const counts = { completed: 0, review: 0, failed: 0, cancelled: 0, pending: 0 };
          for (const entry of batch.entries) {
            if (entry.state === "cancelled" || entry.job?.state === "cancelled") counts.cancelled++;
            else if (entry.job?.state === "succeeded") counts.completed++;
            else if (entry.job?.state === "review") counts.review++;
            else if (
              ["rejected", "missing"].includes(entry.state) ||
              ["failed", "blocked"].includes(entry.job?.state ?? "")
            )
              counts.failed++;
            else counts.pending++;
          }
          return (
            <div className="space-y-3 border-t pt-3" key={batch.id}>
              <p className="font-medium">
                {displayDate(batch.created_at)} · {batch.file_count} arquivo(s)
              </p>
              <p className="text-sm">
                {counts.completed} concluído(s), {counts.failed} com falha, {counts.review} para
                revisão, {counts.cancelled} cancelado(s) e {counts.pending} pendente(s).
              </p>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={
                      action.isPending ||
                      !batch.entries.some((e) => ["failed", "blocked"].includes(e.job?.state ?? ""))
                    }
                    onClick={() => action.mutate({ batch: batch.id, mode: "retry" })}
                  >
                    Repetir apenas leituras que falharam
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      action.isPending ||
                      !batch.entries.some(
                        (e) =>
                          e.state === "waiting" ||
                          ["queued", "retry_wait"].includes(e.job?.state ?? ""),
                      )
                    }
                    onClick={() => action.mutate({ batch: batch.id, mode: "cancel" })}
                  >
                    Cancelar pendentes
                  </Button>
                </div>
              )}
              <details>
                <summary className="cursor-pointer text-sm">Consultar arquivos do lote</summary>
                {!batch.entries.length && (
                  <p className="text-sm">
                    Lote anterior ao histórico detalhado. Consulte os documentos abaixo.
                  </p>
                )}
                {batch.entries.map((entry) => (
                  <div className="mt-3 rounded border p-3" key={entry.slot}>
                    <p className="break-all font-medium">{entry.filename}</p>
                    {entry.job && entry.state !== "cancelled" ? (
                      <>
                        <JobProgress job={entry.job} />
                        <Link
                          className="text-sm underline"
                          to="/candidatos/$id"
                          params={{ id: entry.job.candidate_id }}
                        >
                          Ver candidato
                        </Link>
                      </>
                    ) : (
                      <p className="text-sm">
                        {entryLabels[entry.state] ?? "Situação do recebimento não confirmada"}
                        {entry.message ? ` · ${entry.message}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </details>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AttemptDetail({
  companyId,
  jobId,
  attempt,
  field,
}: {
  companyId: string;
  jobId: string;
  attempt: number;
  field: "prompt_snapshot" | "extraction";
}) {
  const [open, setOpen] = useState(false);
  const detail = useQuery({
    queryKey: ["attempt-detail", companyId, jobId, attempt, field],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resume_job_attempts")
        .select(field)
        .eq("job_id", jobId)
        .eq("attempt", attempt)
        .single();
      if (error) throw error;
      const value = (data as Record<string, unknown>)[field];
      return typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2);
    },
  });
  return (
    <>
      {!open ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Mostrar conteúdo registrado
        </Button>
      ) : detail.error ? (
        <QueryError error={detail.error} retry={detail.refetch} />
      ) : (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words">
          {detail.data ?? "Consultando conteúdo…"}
        </pre>
      )}
    </>
  );
}
