import { useCompany } from "@/hooks/useCompany";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getResumeUrl } from "@/lib/resumes.functions";
import { CandidateQueue } from "@/components/resume-queue";
import { CandidateAnalysis } from "@/components/candidate-analysis";
import { archiveCandidate } from "@/lib/records.functions";
import { calculateAge, isYoungApprenticeEligible } from "@/lib/age";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CityAutocomplete } from "@/components/city-autocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileDown, Trash2 } from "lucide-react";
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
  const { companyId, canEdit, canAdmin } = useCompany();
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signUrl = useServerFn(getResumeUrl);
  const archive = useServerFn(archiveCandidate);
  const [city, setCity] = useState("");

  const {
    data: candidate,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["candidate", companyId, id],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (candidate) setCity(candidate.localizacao ?? "");
  }, [candidate]);

  const updateCandidate = useMutation({
    mutationFn: async (patch: {
      status?: string;
      observacoes?: string;
      localizacao?: string | null;
      data_nascimento?: string | null;
    }) => {
      if (!canEdit) throw new Error("Sem permissão para editar.");
      const { error } = await supabase
        .from("candidates")
        .update(patch)
        .eq("company_id", companyId)
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", companyId, id] });
      queryClient.invalidateQueries({ queryKey: ["candidates", companyId] });
      toast.success("Candidato atualizado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeCandidate = useMutation({
    mutationFn: async () => archive({ data: { companyId, candidateId: id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["candidates", companyId] });
      toast.success("Currículo arquivado.");
      navigate({ to: "/" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loadError) return <p role="alert">Candidato indisponível ou acesso não autorizado.</p>;
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
  const age = calculateAge(candidate.data_nascimento);
  const apprenticeEligible = isYoungApprenticeEligible(candidate.data_nascimento);

  async function openResume() {
    if (!candidate?.arquivo_original_path) return;
    try {
      const { url } = await signUrl({ data: { companyId, candidateId: candidate.id } });
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Não foi possível abrir o currículo.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Voltar para candidatos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {candidate.nome ?? "Currículo sem nome"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[candidate.email, candidate.telefone, candidate.localizacao]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={processing.variant}>{processing.label}</Badge>
          <Button variant="outline" size="sm" onClick={openResume}>
            <FileDown className="size-4" /> Currículo original
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!canAdmin} variant="destructive" size="sm">
                <Trash2 className="size-4" /> Arquivar currículo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar currículo?</AlertDialogTitle>
                <AlertDialogDescription>
                  O candidato e seu arquivo sairão do acesso da equipe. Os dados serão mantidos
                  arquivados para revisão administrativa.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => removeCandidate.mutate()}
                  disabled={!canAdmin || removeCandidate.isPending}
                >
                  Arquivar currículo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <CandidateQueue companyId={companyId} candidateId={id} canEdit={canEdit} />
      <CandidateAnalysis value={candidate.dados_extraidos} />
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
              disabled={!canEdit}
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
                disabled={!canEdit}
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
              Experiência calculada:{" "}
              {candidate.anos_experiencia === null
                ? "Não informada"
                : `${candidate.anos_experiencia} ano(s)`}
            </p>
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="data-nascimento">Data de nascimento</Label>
              <Input
                disabled={!canEdit}
                id="data-nascimento"
                type="date"
                defaultValue={candidate.data_nascimento ?? ""}
                onBlur={(event) => {
                  const value = event.target.value || null;
                  if (value !== candidate.data_nascimento)
                    updateCandidate.mutate({ data_nascimento: value });
                }}
              />
              <p className="text-xs text-muted-foreground">
                {age === null
                  ? "Idade não informada — não elegível para vagas de Jovem Aprendiz."
                  : `${age} anos · ${apprenticeEligible ? "Elegível" : "Não elegível"} para Jovem Aprendiz`}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade-candidato">Cidade</Label>
              <CityAutocomplete
                disabled={!canEdit}
                id="cidade-candidato"
                value={city}
                onChange={setCity}
                onSelect={(localizacao) => updateCandidate.mutate({ localizacao })}
              />
            </div>
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
