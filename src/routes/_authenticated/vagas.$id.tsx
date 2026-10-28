import { useCompany } from "@/hooks/useCompany";
import { JobEditor, JobHistory, JOB_RULE, jobError } from "@/components/job-editor";
import {
  criterionLabels,
  type JobCriterion,
} from "../../../supabase/functions/_shared/job-criteria";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rankJobCandidates } from "@/lib/scoring.functions";
import { archiveJob } from "@/lib/records.functions";
import type { MatchDetails } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { CityAutocomplete } from "@/components/city-autocomplete";
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
  const { companyId, canEdit, canAdmin } = useCompany();
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rank = useServerFn(rankJobCandidates);
  const archive = useServerFn(archiveJob);
  const [localFilter, setLocalFilter] = useState("");
  const [minExp, setMinExp] = useState("");
  const [editing, setEditing] = useState(false);

  const { data: job } = useQuery({
    queryKey: ["job", companyId, id],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["job-scores", companyId, id],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_scores")
        .select(
          "score, detalhes_matching, stale, candidate_version, job_version, criteria_hash, candidates(*)",
        )
        .eq("company_id", companyId)
        .eq("job_id", id)
        .order("score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const recalc = useMutation({
    mutationFn: async () => rank({ data: { companyId, jobId: id } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-scores", companyId, id] });
      toast.success(`${result.count} candidato(s) avaliados.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeStatus = useMutation({
    mutationFn: async () => {
      if (!job) throw new Error("Vaga indisponível.");
      const { error } = await supabase.rpc("set_job_status", {
        p_company: companyId,
        p_job: id,
        p_expected_version: job.version,
        p_status: job.status === "aberta" ? "encerrada" : "aberta",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of ["job", "jobs", "job-revisions", "job-scores"])
        queryClient.invalidateQueries({ queryKey: [key, companyId] });
      toast.success("Situação da vaga atualizada. Os candidatos foram mantidos.");
    },
    onError: (error) => toast.error(jobError(error)),
  });

  const removeJob = useMutation({
    mutationFn: async () => archive({ data: { companyId, jobId: id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs", companyId] });
      toast.success("Vaga arquivada.");
      navigate({ to: "/vagas" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    return scores.filter((row) => {
      const candidate = row.candidates;
      if (!candidate) return false;
      const localOk =
        !localFilter ||
        (candidate.localizacao ?? "").toLowerCase().includes(localFilter.toLowerCase());
      const expOk = !minExp || (candidate.anos_experiencia ?? 0) >= Number(minExp);
      return localOk && expOk;
    });
  }, [scores, localFilter, minExp]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/vagas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Voltar para vagas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{job?.titulo ?? "Vaga"}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{job?.descricao}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => recalc.mutate()}
            disabled={
              !canEdit ||
              recalc.isPending ||
              job?.status !== "aberta" ||
              !job?.approved_hash ||
              editing
            }
          >
            <Sparkles className="size-4" />
            {recalc.isPending ? "Calculando..." : "Calcular aderência"}
          </Button>
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
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => removeJob.mutate()}
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
            {job?.categoria === "jovem_aprendiz" ? "Jovem Aprendiz (14 a 24 anos)" : "Vaga regular"}
          </p>
          <p>
            <Badge variant="outline">
              {job?.status === "aberta" ? "Vaga aberta" : "Vaga encerrada"}
            </Badge>{" "}
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
          {((job?.criteria ?? []) as unknown as JobCriterion[]).map((c, i) => (
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

      <div className="flex flex-wrap gap-3">
        <div className="w-full max-w-xs">
          <CityAutocomplete
            value={localFilter}
            onChange={setLocalFilter}
            placeholder="Filtrar por cidade"
          />
        </div>
        <Input
          type="number"
          min={0}
          placeholder="Experiência mínima (anos)"
          value={minExp}
          onChange={(e) => setMinExp(e.target.value)}
          className="max-w-56"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando ranking...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum candidato avaliado ainda. Clique em "Calcular aderência".
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const candidate = row.candidates!;
            const details = (row.detalhes_matching ?? {}) as unknown as MatchDetails;
            const outdated =
              row.stale ||
              row.candidate_version !== candidate.data_version ||
              row.job_version !== job?.version ||
              row.criteria_hash !== job?.approved_hash;
            return (
              <Card key={candidate.id}>
                <CardContent className="space-y-3 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                      to="/candidatos/$id"
                      params={{ id: candidate.id }}
                      className="font-medium hover:underline"
                    >
                      {candidate.nome ?? "Currículo sem nome"}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {candidate.localizacao ?? "Local não informado"}
                      </span>
                      <Badge variant={outdated ? "outline" : "default"}>
                        {Math.round(row.score)}% de aderência{outdated ? " · desatualizada" : ""}
                      </Badge>
                    </div>
                  </div>
                  {outdated && (
                    <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
                      A vaga, os critérios ou os dados do candidato mudaram. Calcule a aderência
                      novamente antes de usar esta avaliação.
                    </p>
                  )}
                  <Progress value={Number(row.score)} />
                  {details.limite_obrigatorio_aplicado && (
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Nota limitada a 49%: há requisito obrigatório não comprovado. Confira o
                      currículo.
                    </p>
                  )}
                  {details.criterios && (
                    <details className="text-xs">
                      <summary className="cursor-pointer">
                        Como esta nota foi calculada · versão {row.job_version}
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {details.criterios.map((c, i) => (
                          <li key={i}>
                            {c.text}:{" "}
                            {c.atendido
                              ? "atendido"
                              : c.proporcao > 0
                                ? "parcial"
                                : "não comprovado"}{" "}
                            · peso {c.weight} · {c.pontos.toFixed(1)} pontos
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2">
                        Nota antes do limite obrigatório: {details.pontuacao_antes_limite}%.
                      </p>
                    </details>
                  )}
                  <div className="grid gap-1 text-xs md:grid-cols-2">
                    <p className="text-success">
                      Atende: {details.obrigatorios_atendidos?.join(", ") || "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Falta: {details.obrigatorios_faltantes?.join(", ") || "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Diferenciais: {details.desejaveis_atendidos?.join(", ") || "—"}
                    </p>
                    <p className="text-muted-foreground">
                      Experiência: {candidate.anos_experiencia ?? 0} ano(s)
                      {details.experiencia_ok ? " (atende)" : " (abaixo do mínimo)"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <JobHistory key={`${companyId}:${id}`} companyId={companyId} jobId={id} />
    </div>
  );
}
