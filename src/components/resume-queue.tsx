import { useRef } from "react";
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

type Job = Tables<"resume_jobs">;
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
export const jobLabels: Record<string, string> = {
  queued: "Na fila",
  running: "Em leitura",
  retry_wait: "Aguardando nova tentativa",
  succeeded: "ConcluÃ­do",
  review: "RevisÃ£o do RH necessÃ¡ria",
  failed: "Tentativas esgotadas",
  blocked: "ConfiguraÃ§Ã£o necessÃ¡ria",
  cancelled: "Cancelado",
};
const phaseLabels: Record<string, string> = {
  downloading: "Obtendo original",
  validating: "Conferindo documento",
  reading: "Extraindo informaÃ§Ãµes",
  saving: "Salvando resultado",
};
export const isActiveJob = (job?: Job | null) =>
  !!job && ["queued", "running", "retry_wait"].includes(job.state);

export function JobProgress({ job }: { job: Job }) {
  return (
    <div className="space-y-1 text-sm" role="status">
      <p className="font-medium">
        {jobLabels[job.state] ?? "SituaÃ§Ã£o da leitura nÃ£o confirmada"}
        {job.state === "running" ? ` Â· ${phaseLabels[job.phase] ?? "Processando"}` : ""}
      </p>
      <p>
        Leitura {job.generation} Â· Tentativa {job.attempts} de 3
      </p>
      {job.state === "retry_wait" && (
        <p>Nova tentativa a partir de {displayDate(job.available_at)}.</p>
      )}
      {job.message && <p>{job.message}</p>}
      {job.state === "blocked" && (
        <p>O administrador precisa corrigir a configuraÃ§Ã£o antes de repetir.</p>
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
    queryFn: async () => {
      let q = supabase
        .from("resume_jobs")
        .select("*,resume_job_attempts(*)")
        .eq("company_id", companyId)
        .eq("candidate_id", candidateId)
        .order("generation", { ascending: false })
        .limit(showHistory ? 100 : 1);
      if (documentId) q = q.eq("document_id", documentId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
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
      toast.info(mode === "cancel" ? "Leitura cancelada." : "Leitura adicionada Ã  fila.");
    },
    onError: (error) =>
      toast.error(
        errorFeedback(
          error,
          "NÃ£o foi possÃ­vel confirmar a alteraÃ§Ã£o. Confira a fila antes de repetir.",
        ).message,
      ),
  });
  if (query.isError)
    return (
      <QueryError
        error={query.error}
        retry={() => query.refetch()}
        busy={query.isFetching}
        fallback="NÃ£o foi possÃ­vel consultar a fila de leitura."
      />
    );
  if (!job) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leitura do currÃ­culo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <JobProgress job={job} />
        <p className="text-xs text-muted-foreground">
          A leitura continua ao sair desta pÃ¡gina. AtÃ© 2 documentos simultÃ¢neos por empresa e 2
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
                Reprocessar currÃ­culo
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
                    Tentativa {a.attempt} Â· {displayDate(a.started_at)} Â·{" "}
                    {jobLabels[a.outcome] ??
                      (a.outcome === "interrupted" ? "Interrompida pelo sistema" : a.outcome)}
                    {a.message ? ` Â· ${a.message}` : ""}
                  </p>
                  <p>
                    Modelo: {a.model_reported ?? a.model_requested ?? "NÃ£o registrado"} Â·
                    DuraÃ§Ã£o:{" "}
                    {a.duration_ms === null
                      ? "NÃ£o informada"
                      : `${(a.duration_ms / 1000).toFixed(1)} s`}
                  </p>
                  <p>
                    Consumo informado pelo provedor: {a.input_tokens ?? "NÃ£o informado"} tokens de
                    entrada Â· {a.output_tokens ?? "NÃ£o informado"} de saÃ­da Â·{" "}
                    {a.total_tokens ?? "NÃ£o informado"} no total.
                  </p>
                  {a.prompt_version && (
                    <details>
                      <summary className="cursor-pointer">
                        InstruÃ§Ãµes usadas: {a.prompt_version}
                      </summary>
                      <p className="break-all">Identificador: {a.prompt_hash}</p>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words">
                        {a.prompt_snapshot}
                      </pre>
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
                      Tentativa {a.attempt} Â·{" "}
                      {a.model_reported ?? a.model_requested ?? "Modelo nÃ£o registrado"} Â·{" "}
                      {a.prompt_version ?? "InstruÃ§Ãµes nÃ£o registradas"}
                    </summary>
                    <p>
                      DuraÃ§Ã£o: {a.duration_ms ?? "NÃ£o informada"} ms Â· Consumo:{" "}
                      {a.total_tokens ?? "NÃ£o informado"} tokens
                    </p>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(a.extraction, null, 2)}
                    </pre>
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
    queryFn: async () => {
      const batches = await supabase
        .from("resume_batches")
        .select("*,resume_batch_entries(*),resume_batch_items(*)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (batches.error) throw batches.error;
      const ids = [
        ...new Set(batches.data.flatMap((b) => b.resume_batch_items.map((i) => i.document_id))),
      ];
      const jobs = ids.length
        ? await supabase
            .from("resume_jobs")
            .select("*")
            .eq("company_id", companyId)
            .in("document_id", ids)
            .order("generation", { ascending: false })
        : { data: [], error: null };
      if (jobs.error) throw jobs.error;
      return batches.data.map((b) => ({
        ...b,
        entries: b.resume_batch_entries
          .sort((a, c) => a.slot - c.slot)
          .map((entry) => {
            const doc = b.resume_batch_items.find((i) => i.slot === entry.slot);
            return { ...entry, job: jobs.data?.find((j) => j.document_id === doc?.document_id) };
          }),
      }));
    },
    refetchInterval: 5000,
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
      toast.error(
        errorFeedback(error, "NÃ£o foi possÃ­vel confirmar a alteraÃ§Ã£o do lote.").message,
      ),
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
        <CardTitle>HistÃ³rico de lotes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Ãšltimos 20 lotes. AtualizaÃ§Ã£o a cada 5 segundos. Falhas de leitura podem ser repetidas
          sem enviar o arquivo novamente; arquivos nÃ£o recebidos precisam ser selecionados
          novamente.
        </p>
        {query.isError && (
          <QueryError
            error={query.error}
            retry={() => query.refetch()}
            busy={query.isFetching}
            fallback="NÃ£o foi possÃ­vel consultar os lotes."
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
                {displayDate(batch.created_at)} Â· {batch.file_count} arquivo(s)
              </p>
              <p className="text-sm">
                {counts.completed} concluÃ­do(s), {counts.failed} com falha, {counts.review} para
                revisÃ£o, {counts.cancelled} cancelado(s) e {counts.pending} pendente(s).
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
                    Lote anterior ao histÃ³rico detalhado. Consulte os documentos abaixo.
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
                        {entryLabels[entry.state] ?? "SituaÃ§Ã£o do recebimento nÃ£o confirmada"}
                        {entry.message ? ` Â· ${entry.message}` : ""}
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
