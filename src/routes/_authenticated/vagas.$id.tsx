import { readVacancy } from "@/data/recruitment-records";
import { readCriteria } from "../../../supabase/functions/_shared/job-criteria";
import { vacancyStates } from "@/lib/workflow-states";
import { QueryError, LoadingState } from "@/components/query-feedback";
import { errorFeedback } from "@/lib/ui-feedback";
import { refreshCompanyLists } from "@/lib/company-browse";
import { RankingHistory } from "@/components/ranking-history";
import { VacancyReports } from "@/components/vacancy-reports";
import { JobTalentPool } from "@/components/candidate-job-links";
import { useCompany } from "@/hooks/useCompany";
import { JobEditor, JobHistory, JOB_RULE, jobError } from "@/components/job-editor";
import {
  criterionLabels,
  type JobCriterion,
} from "../../../supabase/functions/_shared/job-criteria";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rankJobCandidates } from "@/lib/scoring.functions";
import { archiveJob } from "@/lib/records.functions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/vagas/$id")({
  head: () => ({
    meta: [
      { title: "Ranking da vaga | Triagem de Currículos" },
      {
        name: "description",
        content:
          "Candidatos ordenados por aderência à vaga, com requisitos atendidos, faltantes e filtros por local e experiência.",
      },
      { property: "og:title", content: "Ranking da vaga | Triagem de Currículos" },
      {
        property: "og:description",
        content: "Candidatos ordenados por pontuação de aderência aos requisitos da vaga.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { companyId } = useCompany();
  const { id } = Route.useParams();
  return <JobDetailContent key={companyId + ":" + id} />;
}
function JobDetailContent() {
  const { companyId, canEdit, canAdmin } = useCompany();
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rank = useServerFn(rankJobCandidates);
  const archive = useServerFn(archiveJob);
  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: ["job", companyId, id],
    queryFn: ({ signal }) => readVacancy(companyId, id, signal),
  });

  const job = query.data;
  const recalc = useMutation({
    mutationFn: async (requestId: string) => rank({ data: { companyId, jobId: id, requestId } }),
    onSuccess: async (result) => {
      await refreshCompanyLists(queryClient, companyId);
      toast.success(
        result.count
          ? `${result.count} candidato(s) avaliados. ${result.pending} com pendências.`
          : `Cálculo concluído sem classificação final: ${result.pending} candidato(s) com pendências.`,
      );
    },
    onError: (error: Error) => toast.error(errorFeedback(error).message),
  });

  const changeStatus = useMutation({
    mutationFn: async () => {
      if (!job) throw new Error("Vaga indisponível.");
      const { data, error } = await supabase.rpc("set_job_status", {
        p_company: companyId,
        p_job: id,
        p_expected_version: job.version,
        p_status: job.status === "aberta" ? "encerrada" : "aberta",
      });
      if (error) throw error;
      const saved = data as { id?: string; company_id?: string } | null;
      if (saved?.id !== id || saved.company_id !== companyId)
        throw new Error("Alteração não confirmada. Confira a versão atual antes de repetir.");
    },
    onSuccess: async () => {
      await refreshCompanyLists(queryClient, companyId);
      toast.success("Situação da vaga atualizada. Os candidatos foram mantidos.");
    },
    onError: (error) => toast.error(jobError(error)),
  });

  const removeJob = useMutation({
    mutationFn: async () => {
      const result = await archive({ data: { companyId, jobId: id } });
      if (!result?.ok) throw new Error("Arquivamento não confirmado.");
      return result;
    },
    onSuccess: async () => {
      await refreshCompanyLists(queryClient, companyId);
      toast.success("Vaga arquivada.");
      navigate({ to: "/vagas" });
    },
    onError: (error: Error) =>
      toast.error(errorFeedback(error, "Não foi possível confirmar o arquivamento.").message),
  });

  if (query.isError && (!job || !errorFeedback(query.error).retryable))
    return <QueryError error={query.error} retry={() => query.refetch()} busy={query.isFetching} />;
  if (query.isPending) return <LoadingState>Carregando vaga…</LoadingState>;
  if (!job)
    return (
      <>
        <QueryError error={{ code: "PGRST116" }} />
        <Link to="/vagas">Voltar para vagas</Link>
      </>
    );
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/vagas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Voltar para vagas
      </Link>

      {query.isError && (
        <QueryError
          error={query.error}
          retry={() => query.refetch()}
          busy={query.isFetching}
          fallback="Não foi possível atualizar. Os dados exibidos são da última consulta."
        />
      )}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{job?.titulo ?? "Vaga"}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{job?.descricao}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              recalc.mutate(
                recalc.isError && recalc.variables ? recalc.variables : crypto.randomUUID(),
              )
            }
            disabled={
              !canEdit ||
              recalc.isPending ||
              job?.status !== "aberta" ||
              !job?.approved_hash ||
              editing
            }
          >
            <Sparkles className="size-4" />
            {recalc.isPending
              ? "Calculando..."
              : recalc.isError
                ? "Repetir tentativa"
                : "Calcular aderência"}
          </Button>
          {recalc.isError && (
            <Button
              variant="outline"
              disabled={!canEdit || job?.status !== "aberta" || !job?.approved_hash || editing}
              onClick={() => recalc.mutate(crypto.randomUUID())}
            >
              Iniciar novo cálculo
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!canEdit || !job}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Fechar edição" : "Editar vaga"}
          </Button>
          <Button
            variant="outline"
            disabled={!canEdit || !job || changeStatus.isPending || editing}
            onClick={() => changeStatus.mutate()}
          >
            {changeStatus.isPending
              ? "Salvando…"
              : job?.status === "aberta"
                ? "Encerrar vaga"
                : "Reabrir vaga"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!canAdmin} variant="destructive">
                <Trash2 className="size-4" /> Arquivar vaga
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar vaga?</AlertDialogTitle>
                <AlertDialogDescription>
                  A vaga será arquivada e sairá do acesso da equipe. Os candidatos serão mantidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {removeJob.isError && (
                <QueryError
                  error={removeJob.error}
                  fallback="Não foi possível confirmar o arquivamento. Tente novamente pelo botão abaixo."
                />
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(event) => {
                    event.preventDefault();
                    removeJob.mutate();
                  }}
                  disabled={!canAdmin || removeJob.isPending}
                >
                  Arquivar vaga
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {editing && canEdit && job && (
        <JobEditor
          key={`${companyId}:${id}`}
          companyId={companyId}
          job={job}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requisitos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Categoria:</span>{" "}
            {job?.categoria === "jovem_aprendiz"
              ? "Jovem Aprendiz — conferência jurídica pendente"
              : "Vaga regular"}
          </p>
          <p>
            <Badge variant="outline">{vacancyStates[job.status] ?? "Situação a conferir"}</Badge>{" "}
            <Badge variant={job?.approved_hash ? "secondary" : "outline"}>
              {job?.approved_hash ? "Critérios aprovados" : "Aguardando aprovação do RH"}
            </Badge>
          </p>
          <p>
            {job?.status === "encerrada"
              ? "Os candidatos foram mantidos. Reabra a vaga para voltar a avaliar."
              : !job?.approved_hash
                ? "Confira a descrição e aprove os critérios na edição antes de gerar o ranking."
                : "Descrição e critérios conferidos pelo RH."}
          </p>
          <p>{JOB_RULE}</p>
          {readCriteria(job?.criteria) === null && (
            <p role="alert">
              Critérios incompatíveis. Confira o histórico antes de substituir os critérios.
            </p>
          )}
          {(readCriteria(job?.criteria) ?? []).map((c, i) => (
            <p key={i}>
              <strong>{c.required ? "Obrigatório" : "Diferencial desejável"}</strong> ·{" "}
              {criterionLabels[c.kind]}: {c.text}
              {c.kind === "experience" ? ` (${c.min_years} anos)` : ""} · peso {c.weight}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            Versão {job?.version ?? 0}
            {job?.approved_at
              ? ` · Aprovação em ${new Date(job.approved_at).toLocaleString("pt-BR")}`
              : ""}
            . Consulte os responsáveis no histórico abaixo.
          </p>
        </CardContent>
      </Card>

      {job && (
        <JobTalentPool
          companyId={companyId}
          jobId={id}
          canEdit={canEdit}
          open={job.status === "aberta"}
        />
      )}
      {job && (
        <RankingHistory
          key={`${companyId}:${id}`}
          companyId={companyId}
          job={job}
          canAdmin={canAdmin}
          canEdit={canEdit}
        />
      )}
      {job && (
        <VacancyReports
          key={`${companyId}:${id}`}
          companyId={companyId}
          jobId={id}
          canEdit={canEdit}
        />
      )}
      <JobHistory key={`${companyId}:${id}`} companyId={companyId} jobId={id} />
    </div>
  );
}
