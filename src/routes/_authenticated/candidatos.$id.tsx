import { readCandidate } from "@/data/recruitment-records";
import { QueryError, LoadingState } from "@/components/query-feedback";
import { errorFeedback } from "@/lib/ui-feedback";
import { CandidateNotes, CandidateFavorite } from "@/components/candidate-collaboration";
import { refreshCompanyLists } from "@/lib/company-browse";
import { useCompany } from "@/hooks/useCompany";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CandidateQueue } from "@/components/resume-queue";
import { CandidateAnalysis } from "@/components/candidate-analysis";
import { CandidateReview } from "@/components/candidate-review";
import { CandidateDocuments } from "@/components/candidate-documents";
import { CandidateDuplicates } from "@/components/candidate-duplicates";
import { CandidateJobLinks } from "@/components/candidate-job-links";
import { archiveCandidate } from "@/lib/records.functions";
import { EraseCandidate } from "@/components/privacy-center";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2 } from "lucide-react";
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
import { processingLabel } from "@/lib/ui-feedback";

export const Route = createFileRoute("/_authenticated/candidatos/$id")({
  head: () => ({
    meta: [
      { title: "Revisão do candidato | Ceny" },
      {
        name: "description",
        content:
          "Confira o currículo original, revise os dados e acompanhe o histórico de correções.",
      },
    ],
  }),
  component: CandidateDetail,
});
function CandidateDetail() {
  const { companyId } = useCompany();
  const { id } = Route.useParams();
  return <CandidateDetailContent key={companyId + ":" + id} />;
}
function CandidateDetailContent() {
  const { companyId, canEdit, canAdmin } = useCompany();
  const { id } = Route.useParams();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const archive = useServerFn(archiveCandidate);
  const query = useQuery({
    queryKey: ["candidate", companyId, id],
    queryFn: ({ signal }) => readCandidate(companyId, id, signal),
    refetchInterval: (q) => (q.state.data?.processing_status === "processando" ? 5000 : false),
  });
  const remove = useMutation({
    mutationFn: async () => {
      const result = await archive({ data: { companyId, candidateId: id } });
      if (!result?.ok) throw new Error("Arquivamento não confirmado.");
      return result;
    },
    onSuccess: async () => {
      await refreshCompanyLists(cache, companyId);
      toast.success("Currículo arquivado.");
      navigate({ to: "/" });
    },
    onError: (error) =>
      toast.error(errorFeedback(error, "Não foi possível confirmar o arquivamento.").message),
  });
  const candidate = query.data;
  if (query.isError && (!candidate || !errorFeedback(query.error).retryable))
    return <QueryError error={query.error} retry={() => query.refetch()} busy={query.isFetching} />;
  if (query.isPending) return <LoadingState>Carregando candidato…</LoadingState>;
  if (!candidate)
    return (
      <>
        <QueryError error={{ code: "PGRST116" }} />
        <Link to="/">Voltar para candidatos</Link>
      </>
    );
  const processing = processingLabel(candidate.processing_status);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Voltar para candidatos
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
          <h1 className="text-2xl font-semibold">{candidate.nome ?? "Currículo sem nome"}</h1>
          <p className="text-sm text-muted-foreground">
            {[candidate.email, candidate.telefone, candidate.localizacao]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={processing.variant}>{processing.label}</Badge>
          <Badge variant="outline">
            {candidate.review_status === "completed" ? "Revisado pelo RH" : "Revisão pendente"}
          </Badge>
          <CandidateFavorite companyId={companyId} candidateId={id} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!canAdmin} variant="destructive" size="sm">
                <Trash2 className="size-4" />
                Arquivar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar currículo?</AlertDialogTitle>
                <AlertDialogDescription>
                  O candidato e o original sairão do acesso da equipe. Os dados serão mantidos para
                  revisão administrativa. Arquivar não elimina dados pessoais. Pontuações atuais e
                  relatórios legados são invalidados; históricos e versões são mantidos. Para
                  remover os dados ativos definitivamente, use “Eliminar dados”.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {remove.isError && (
                <QueryError
                  error={remove.error}
                  fallback="Não foi possível confirmar o arquivamento. Tente novamente pelo botão abaixo."
                />
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!canAdmin || remove.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    remove.mutate();
                  }}
                >
                  {remove.isPending ? "Arquivando…" : "Arquivar currículo"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>
      {canAdmin && (
        <EraseCandidate
          companyId={companyId}
          candidateId={id}
          onRequested={() => navigate({ to: "/" })}
        />
      )}
      <CandidateDocuments candidate={candidate} canEdit={canEdit} />
      {candidate.active_document_id && (
        <CandidateQueue
          companyId={companyId}
          candidateId={id}
          documentId={candidate.active_document_id}
          canEdit={canEdit}
        />
      )}
      <CandidateDuplicates candidate={candidate} canAdmin={canAdmin} />
      <CandidateNotes
        companyId={companyId}
        candidateId={id}
        canEdit={canEdit}
        legacy={candidate.observacoes}
      />
      <CandidateJobLinks companyId={companyId} candidateId={id} canEdit={canEdit} />
      {candidate.processing_error && (
        <p role="status" className="rounded border p-3 text-sm">
          {candidate.processing_error}
        </p>
      )}
      <CandidateReview key={companyId + ":" + id} candidate={candidate} canEdit={canEdit} />
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-semibold">
          Relatório da última leitura da IA (antes das correções do RH)
        </summary>
        <div className="mt-4">
          <CandidateAnalysis value={candidate.dados_extraidos} />
        </div>
      </details>
    </div>
  );
}
