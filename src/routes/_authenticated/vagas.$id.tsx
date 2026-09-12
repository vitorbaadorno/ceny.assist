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
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rank = useServerFn(rankJobCandidates);
  const archive = useServerFn(archiveJob);
  const [localFilter, setLocalFilter] = useState("");
  const [minExp, setMinExp] = useState("");

  const { data: job } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["job-scores", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_scores")
        .select("score, detalhes_matching, candidates(*)")
        .eq("job_id", id)
        .order("score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const recalc = useMutation({
    mutationFn: async () => rank({ data: { jobId: id } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-scores", id] });
      toast.success(`${result.count} candidato(s) avaliados.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeJob = useMutation({
    mutationFn: async () => archive({ data: { jobId: id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Vaga excluída.");
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
          <Button onClick={() => recalc.mutate()} disabled={recalc.isPending}>
            <Sparkles className="size-4" />
            {recalc.isPending ? "Calculando..." : "Calcular aderência"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive"><Trash2 className="size-4" /> Excluir vaga</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir vaga?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir? Essa ação não pode ser desfeita. Os candidatos serão mantidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => removeJob.mutate()} disabled={removeJob.isPending}>
                  Excluir vaga
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

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
            <span className="font-medium">Obrigatórios:</span>{" "}
            {(job?.requisitos_obrigatorios ?? []).join(", ") || "—"}
          </p>
          <p>
            <span className="font-medium">Desejáveis:</span>{" "}
            {(job?.requisitos_desejaveis ?? []).join(", ") || "—"}
          </p>
          <p>
            <span className="font-medium">Experiência mínima:</span> {job?.experiencia_minima ?? 0}{" "}
            ano(s) · <span className="font-medium">Local:</span> {job?.localizacao ?? "—"} ·{" "}
            <span className="font-medium">Formação:</span> {job?.formacao_exigida ?? "—"}
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
                      <Badge>{Math.round(row.score)}% de aderência</Badge>
                    </div>
                  </div>
                  <Progress value={Number(row.score)} />
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
    </div>
  );
}
