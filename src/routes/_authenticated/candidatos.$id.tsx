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
import { processingLabel } from "./index";

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
  const { companyId, canEdit, canAdmin } = useCompany();
  const { id } = Route.useParams();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const archive = useServerFn(archiveCandidate);
  const {
    data: candidate,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["candidate", companyId, id],
    refetchInterval: 5000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", id)
        .abortSignal(signal)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const remove = useMutation({
    mutationFn: async () => archive({ data: { companyId, candidateId: id } }),
    onSuccess: async () => {
      await refreshCompanyLists(cache, companyId);
      toast.success("Currículo arquivado.");
      navigate({ to: "/" });
    },
    onError: () => toast.error("Não foi possível arquivar o currículo."),
  });
  if (error) return <p role="alert">Candidato indisponível ou acesso não autorizado.</p>;
  if (isLoading || !candidate) return <p>Carregando candidato…</p>;
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
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!canAdmin || remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  Arquivar currículo
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
