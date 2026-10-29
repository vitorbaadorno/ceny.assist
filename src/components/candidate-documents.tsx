import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getResumeUrl } from "@/lib/resumes.functions";
import { CandidateQueue } from "./resume-queue";
import { CandidateAnalysis } from "./candidate-analysis";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

export function CandidateDocuments({
  candidate,
  canEdit,
}: {
  candidate: Tables<"candidates">;
  canEdit: boolean;
}) {
  const cache = useQueryClient();
  const sign = useServerFn(getResumeUrl);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["person-documents", candidate.company_id, candidate.id, page],
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase
        .from("resume_documents")
        .select("*")
        .eq("company_id", candidate.company_id)
        .eq("candidate_id", candidate.id)
        .order("version", { ascending: false })
        .range(page * 20, page * 20 + 20);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const choose = useMutation({
    mutationFn: async (documentId: string) => {
      const r = await supabase.rpc("select_candidate_document", {
        p_company: candidate.company_id,
        p_candidate: candidate.id,
        p_document: documentId,
        p_expected_version: candidate.review_version,
      });
      if (r.error) throw r.error;
    },
    onSuccess: async () => {
      await cache.invalidateQueries();
      toast.success("Currículo selecionado. Confira os dados e conclua a revisão novamente.");
    },
    onError: () =>
      toast.error("Não foi possível selecionar. Atualize o cadastro e confira seu acesso."),
  });
  const open = useMutation({
    mutationFn: async (documentId: string) => {
      const result = await sign({
        data: { companyId: candidate.company_id, candidateId: candidate.id, documentId },
      });
      const a = document.createElement("a");
      a.href = result.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    },
    onError: () =>
      toast.error(
        "Não foi possível abrir o original. Confira se o envio terminou e se você ainda tem acesso.",
      ),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Currículos e versões</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cada arquivo mantém seu original, origem e análises. O currículo selecionado fornece os
          dados para revisão e avaliação. As correções do RH são preservadas; uma troca exige nova
          conferência.
        </p>
        {canEdit && (
          <Button asChild>
            <Link to="/upload" search={{ candidateId: candidate.id }}>
              Adicionar currículo desta pessoa
            </Link>
          </Button>
        )}
        {query.isError && <p role="alert">Não foi possível consultar os documentos.</p>}
        {query.isLoading && <p>Carregando documentos…</p>}
        {query.data?.length === 0 && (
          <p>
            Nenhum documento versionado. O original legado, se disponível, pode ser consultado
            durante a revisão.
          </p>
        )}
        {query.data?.slice(0, 20).map((d) => (
          <div key={d.id} className="space-y-3 rounded border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="break-all font-medium">
                Versão {d.version} · {d.filename}
              </p>
              {d.id === candidate.active_document_id && <Badge>Selecionado</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Recebido em {new Date(d.created_at).toLocaleString("pt-BR")} · Origem:{" "}
              {
                (
                  {
                    selecao_local: "arquivo local",
                    email: "e-mail",
                    indicacao: "indicação",
                    outro: "outra",
                  } as Record<string, string>
                )[d.source]
              }{" "}
              · Enviado por: {d.uploaded_by ?? "Conta removida"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!d.stored_at || open.isPending}
                onClick={() => open.mutate(d.id)}
              >
                Abrir original
              </Button>
              {canEdit && d.id !== candidate.active_document_id && (
                <Button
                  variant="outline"
                  disabled={!d.stored_at || choose.isPending}
                  onClick={() => choose.mutate(d.id)}
                >
                  Usar esta versão e revisar
                </Button>
              )}
              <Button variant="ghost" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                {expanded === d.id ? "Ocultar análises" : "Consultar análises"}
              </Button>
            </div>
            {d.error_message && (
              <p className="text-sm" role="status">
                {d.error_message}
              </p>
            )}
            {expanded === d.id && (
              <div className="space-y-3">
                <CandidateQueue
                  companyId={candidate.company_id}
                  candidateId={candidate.id}
                  documentId={d.id}
                  canEdit={canEdit}
                  showHistory
                />
                <CandidateAnalysis value={d.latest_extraction} />
                <details className="text-xs">
                  <summary>Identificação do conteúdo</summary>
                  <p className="break-all">SHA-256: {d.sha256}</p>
                  <p>
                    {d.byte_size} bytes · {d.page_count} página(s)
                  </p>
                </details>
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-3">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Anteriores
          </Button>
          <span className="self-center text-sm">Página {page + 1}</span>
          <Button
            variant="outline"
            disabled={(query.data?.length ?? 0) <= 20}
            onClick={() => setPage(page + 1)}
          >
            Mais versões
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
