import { documentInProgress } from "@/lib/workflow-states";
import { QueryError } from "@/components/query-feedback";
import { errorFeedback, displayDate } from "@/lib/ui-feedback";
import { useEffect, useState } from "react";
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

function CandidateDocumentsContent({
  candidate,
  canEdit,
}: {
  candidate: Tables<"candidates">;
  canEdit: boolean;
}) {
  const cache = useQueryClient();
  const sign = useServerFn(getResumeUrl);
  const [opened, setOpened] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!opened) return;
    const timer = setTimeout(() => setOpened(null), 55000);
    return () => clearTimeout(timer);
  }, [opened]);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["person-documents", candidate.company_id, candidate.id, page],
    refetchInterval: (q) => (q.state.data?.some(documentInProgress) ? 5000 : false),
    queryFn: async () => {
      const r = await supabase
        .from("resume_documents")
        .select(
          "id,version,filename,state,error_message,created_at,stored_at,source,uploaded_by,byte_size,page_count,sha256",
        )
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
    onError: (error) =>
      toast.error(
        errorFeedback(
          error,
          "Não foi possível confirmar a seleção. Confira o cadastro antes de repetir.",
        ).message,
      ),
  });
  const open = useMutation({
    mutationFn: async (documentId: string) => {
      const result = await sign({
        data: { companyId: candidate.company_id, candidateId: candidate.id, documentId },
      });
      if (!result?.url) throw new Error("O acesso ao arquivo não foi confirmado.");
      return { id: documentId, url: result.url };
    },
    onSuccess: setOpened,
    onError: () => setOpened(null),
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
        {query.isError && (
          <QueryError
            error={query.error}
            retry={() => query.refetch()}
            busy={query.isFetching}
            fallback="Não foi possível consultar os documentos."
          />
        )}
        {open.isError && (
          <QueryError
            error={open.error}
            fallback="Não foi possível preparar o acesso. Confira se o envio terminou e tente novamente."
          />
        )}
        {query.isLoading && <p role="status">Carregando documentos…</p>}
        {!query.isError && query.data?.length === 0 && (
          <p>
            Nenhum documento versionado. O original legado, se disponível, pode ser consultado
            durante a revisão.
          </p>
        )}
        {(!query.isError ? query.data : undefined)?.slice(0, 20).map((d) => (
          <div key={d.id} className="space-y-3 rounded border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="break-all font-medium">
                Versão {d.version} · {d.filename}
              </p>
              {d.id === candidate.active_document_id && <Badge>Selecionado</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Recebido em {displayDate(d.created_at)} · Origem:{" "}
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
                aria-describedby={!d.stored_at ? `file-unavailable-${d.id}` : undefined}
                disabled={!d.stored_at || open.isPending}
                onClick={() => open.mutate(d.id)}
              >
                {open.isPending && open.variables === d.id
                  ? "Preparando acesso…"
                  : "Preparar acesso ao original"}
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
            {!d.stored_at && (
              <p id={`file-unavailable-${d.id}`} className="text-sm">
                Original indisponível: o recebimento do arquivo ainda não foi confirmado.
              </p>
            )}
            {opened?.id === d.id && (
              <div role="status" className="space-y-2 text-sm">
                <p>
                  Acesso temporário preparado. Se o navegador bloquear uma nova aba, use a opção
                  nesta aba.
                </p>
                <a
                  className="mr-4 underline"
                  href={opened.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir original em outra aba
                </a>
                <a className="underline" href={opened.url}>
                  Abrir original nesta aba
                </a>
              </div>
            )}
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
                <DocumentAnalysis
                  companyId={candidate.company_id}
                  documentId={d.id}
                  state={d.state}
                />
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

export function CandidateDocuments(props: Parameters<typeof CandidateDocumentsContent>[0]) {
  return (
    <CandidateDocumentsContent
      key={props.candidate.company_id + ":" + props.candidate.id}
      {...props}
    />
  );
}

function DocumentAnalysis({
  companyId,
  documentId,
  state,
}: {
  companyId: string;
  documentId: string;
  state: string;
}) {
  const query = useQuery({
    queryKey: ["document-analysis", companyId, documentId, state],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resume_documents")
        .select("latest_extraction")
        .eq("company_id", companyId)
        .eq("id", documentId)
        .single();
      if (error) throw error;
      return data.latest_extraction;
    },
  });
  if (query.error) return <QueryError error={query.error} retry={query.refetch} />;
  if (query.isPending) return <p role="status">Consultando leitura…</p>;
  return <CandidateAnalysis value={query.data} />;
}
