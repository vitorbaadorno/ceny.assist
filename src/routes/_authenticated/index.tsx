import { useCompany } from "@/hooks/useCompany";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Candidatos | Triagem de Currículos" },
      {
        name: "description",
        content:
          "Painel do RH com todos os candidatos, dados extraídos por IA, status no funil e busca por habilidades.",
      },
      { property: "og:title", content: "Candidatos | Triagem de Currículos" },
      {
        property: "og:description",
        content: "Painel do RH com todos os candidatos e seus dados extraídos automaticamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CandidatesPage,
});

export const STATUS_FUNIL = [
  { value: "novo", label: "Novo" },
  { value: "em_analise", label: "Em análise" },
  { value: "aprovado", label: "Aprovado" },
  { value: "rejeitado", label: "Rejeitado" },
  { value: "contratado", label: "Contratado" },
];

export function processingLabel(status: string) {
  switch (status) {
    case "processando":
      return { label: "Processando", variant: "secondary" as const };
    case "revisao_manual":
      return { label: "Revisão manual", variant: "outline" as const };
    case "erro":
      return { label: "Erro na leitura", variant: "destructive" as const };
    default:
      return { label: "Dados extraídos", variant: "default" as const };
  }
}

function CandidatesPage() {
  const { companyId, canEdit, canAdmin } = useCompany();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [page, setPage] = useState(0);

  const {
    data: candidates = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["candidates", companyId, search, status, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_candidates", {
        p_company: companyId,
        p_query: search,
        p_status: status,
        p_offset: page * 50,
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 8000,
  });

  const filtered = candidates.slice(0, 50);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidatos</h1>
          <p className="text-sm text-muted-foreground">
            Banco de pessoas e seus currículos · Página {page + 1}.
          </p>
        </div>
        <Button asChild>
          <Link to="/upload">
            <Upload className="size-4" /> Enviar currículos
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nome, e-mail ou habilidade"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_FUNIL.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
        <Button
          variant="outline"
          disabled={candidates.length <= 50}
          onClick={() => setPage(page + 1)}
        >
          Próxima página
        </Button>
      </div>
      {isError ? (
        <p role="alert">Não foi possível consultar o acervo. Tente atualizar a página.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando candidatos...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum candidato encontrado. Envie currículos para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((candidate) => {
            const processing = processingLabel(candidate.processing_status);
            return (
              <Link
                key={candidate.id}
                to="/candidatos/$id"
                params={{ id: candidate.id }}
                className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {candidate.nome ?? candidate.arquivo_nome ?? "Currículo sem nome"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[candidate.email, candidate.telefone, candidate.localizacao]
                        .filter(Boolean)
                        .join(" · ") || "Dados ainda não extraídos"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={processing.variant}>{processing.label}</Badge>
                    <Badge variant="secondary">
                      {STATUS_FUNIL.find((s) => s.value === candidate.status)?.label ??
                        candidate.status}
                    </Badge>
                  </div>
                </div>
                {(candidate.skills ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(candidate.skills ?? []).slice(0, 8).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
