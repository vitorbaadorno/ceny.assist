import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getResumeUrl, processResume } from "@/lib/resumes.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileDown, RefreshCw } from "lucide-react";
import { STATUS_FUNIL, processingLabel } from "./index";

export const Route = createFileRoute("/_authenticated/candidatos/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do candidato | Triagem de Currículos" },
      {
        name: "description",
        content:
          "Veja todos os dados extraídos do currículo, atualize o status no funil e abra o arquivo original.",
      },
      { property: "og:title", content: "Detalhe do candidato | Triagem de Currículos" },
      {
        property: "og:description",
        content: "Dados extraídos do currículo, status no funil e arquivo original.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CandidateDetail,
});

type Experiencia = { empresa?: string; cargo?: string; periodo?: string; descricao?: string };
type Formacao = { curso?: string; instituicao?: string; nivel?: string; periodo?: string };

function CandidateDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const signUrl = useServerFn(getResumeUrl);
  const reprocess = useServerFn(processResume);

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const updateCandidate = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("candidates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Candidato atualizado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rerun = useMutation({
    mutationFn: async () => reprocess({ data: { candidateId: id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      toast.success("Currículo relido pela IA.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !candidate) {
    return <p className="text-sm text-muted-foreground">Carregando candidato...</p>;
  }

  const dados = (candidate.dados_extraidos ?? {}) as {
    experiencias?: Experiencia[];
    formacao_academica?: Formacao[];
    idiomas?: string[];
    certificacoes?: string[];
    campos_incertos?: string[];
  };
  const processing = processingLabel(candidate.processing_status);

  async function openResume() {
    if (!candidate?.arquivo_original_path) return;
    try {
      const { url } = await signUrl({ data: { path: candidate.arquivo_original_path } });
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Não foi possível abrir o currículo.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> Voltar para candidatos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {candidate.nome ?? "Currículo sem nome"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[candidate.email, candidate.telefone, candidate.localizacao].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={processing.variant}>{processing.label}</Badge>
          <Button variant="outline" size="sm" onClick={openResume}>
            <FileDown className="size-4" /> Currículo original
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={rerun.isPending}
            onClick={() => rerun.mutate()}
          >
            <RefreshCw className="size-4" /> {rerun.isPending ? "Lendo..." : "Reprocessar"}
          </Button>
        </div>
      </header>

      {candidate.processing_error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {candidate.processing_error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Status no funil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={candidate.status}
              onValueChange={(value) => updateCandidate.mutate({ status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FUNIL.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <p className="text-sm font-medium">Observações</p>
              <Textarea
                rows={4}
                defaultValue={candidate.observacoes ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (candidate.observacoes ?? "")) {
                    updateCandidate.mutate({ observacoes: e.target.value });
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Experiência estimada: {candidate.anos_experiencia ?? 0} ano(s)
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Habilidades</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {(candidate.skills ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma habilidade identificada.</p>
              ) : (
                (candidate.skills ?? []).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground"
                  >
                    {skill}
                  </span>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Experiências profissionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(dados.experiencias ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma experiência identificada.</p>
              ) : (
                (dados.experiencias ?? []).map((exp, index) => (
                  <div key={index} className="border-l-2 border-primary/30 pl-3">
                    <p className="font-medium">
                      {exp.cargo ?? "Cargo não informado"}
                      {exp.empresa ? ` · ${exp.empresa}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{exp.periodo}</p>
                    {exp.descricao && <p className="mt-1 text-sm">{exp.descricao}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Formação, idiomas e certificações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(dados.formacao_academica ?? []).map((item, index) => (
                <p key={index}>
                  <span className="font-medium">{item.curso ?? item.nivel ?? "Formação"}</span>
                  {item.instituicao ? ` — ${item.instituicao}` : ""}
                  {item.periodo ? ` (${item.periodo})` : ""}
                </p>
              ))}
              {(dados.idiomas ?? []).length > 0 && (
                <p>
                  <span className="font-medium">Idiomas:</span> {(dados.idiomas ?? []).join(", ")}
                </p>
              )}
              {(dados.certificacoes ?? []).length > 0 && (
                <p>
                  <span className="font-medium">Certificações:</span>{" "}
                  {(dados.certificacoes ?? []).join(", ")}
                </p>
              )}
              {(dados.campos_incertos ?? []).length > 0 && (
                <p className="text-warning-foreground">
                  Campos a conferir: {(dados.campos_incertos ?? []).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
