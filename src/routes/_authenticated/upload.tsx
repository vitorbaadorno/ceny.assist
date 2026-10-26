import { useCompany } from "@/hooks/useCompany";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  FILE_ACCEPT,
  FILE_LIMITS,
  checkFileEnvelope,
  documentState,
  invokeResume,
  sendResume,
  uploadSummary,
  type UploadState,
} from "@/lib/resume-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Enviar currículos | Ceny" }] }),
  component: UploadPage,
});
type Item = {
  file: File;
  state: UploadState;
  message?: string | undefined;
  duplicate?: boolean;
  candidateId?: string;
  documentId?: string;
};
const labels: Record<UploadState, string> = {
  aguardando: "Aguardando envio",
  enviando: "Enviando e validando",
  enviado: "Enviado — aguardando leitura",
  lendo: "Em leitura",
  ok: "Concluído",
  revisao: "Precisa de revisão",
  erro: "Erro",
};
const sources = {
  selecao_local: "Arquivo local",
  email: "Recebido por e-mail",
  indicacao: "Indicação",
  outro: "Outra origem",
};

function UploadPage() {
  const { companyId, canEdit, canAdmin } = useCompany();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    [finished, setFinished] = useState(false);
  const [source, setSource] = useState<keyof typeof sources>("selecao_local");
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );
  const history = useQuery({
    queryKey: ["resume-documents", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resume_documents")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });
  useEffect(() => {
    if (!history.data) return;
    setItems((current) =>
      current.map((item) => {
        const doc = history.data.find((d) => d.id === item.documentId);
        if (!doc || !["completed", "review", "error"].includes(doc.state)) return item;
        return {
          ...item,
          state: documentState(doc.state),
          message: doc.error_message ?? item.message,
        };
      }),
    );
  }, [history.data]);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["candidates", companyId] }),
      queryClient.invalidateQueries({ queryKey: ["resume-documents", companyId] }),
    ]);
  function selectFiles(files: FileList | null) {
    if (!files?.length) return;
    setFinished(false);
    if (files.length > FILE_LIMITS.files) {
      setItems([]);
      toast.error("Selecione no máximo 5 arquivos por envio.");
      return;
    }
    setItems(
      Array.from(files, (file) => {
        try {
          checkFileEnvelope(file.name, file.size);
          return { file, state: "aguardando" as const };
        } catch (e) {
          return { file, state: "erro" as const, message: (e as Error).message };
        }
      }),
    );
  }
  async function start() {
    if (busy || !canEdit || !items.length) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setFinished(false);
    let result = items.map((i) => ({ ...i }));
    const update = (index: number, patch: Partial<Item>) => {
      result = result.map((item, i) => (i === index ? { ...item, ...patch } : item));
      if (!controller.signal.aborted) setItems(result);
    };
    try {
      const { data: batchId, error } = await supabase.rpc("begin_resume_batch", {
        p_company: companyId,
        p_count: items.length,
        p_source: source,
      });
      if (error || !batchId)
        throw new Error("Não foi possível iniciar o envio. Confira seu acesso à empresa.");
      // Opportunistic reconciliation is also available explicitly to administrators.
      await invokeResume(
        { action: "cleanup", companyId },
        AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      ).catch(() => {});
      for (let i = 0; i < result.length; i++) {
        if (controller.signal.aborted) break;
        const item = result[i]!;
        if (item.state === "erro") continue;
        let accepted = false;
        try {
          update(i, { state: "enviando" });
          const response = await sendResume(
            item.file,
            companyId,
            batchId,
            i,
            AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
          );
          accepted = true;
          update(i, {
            state: documentState(response.state),
            candidateId: response.candidateId,
            documentId: response.documentId,
            duplicate: response.duplicate,
            message: response.message,
          });
          await refresh();
          if (controller.signal.aborted) break;
          if (response.state === "uploaded") {
            update(i, { state: "lendo" });
            const read = await invokeResume<{ status: string; message?: string }>(
              { action: "extract", companyId, candidateId: response.candidateId },
              AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
            );
            update(i, { state: documentState(read.status), message: read.message });
          }
        } catch (e) {
          if (controller.signal.aborted) break;
          let state: UploadState = "erro";
          if (accepted && result[i]?.documentId) {
            const { data } = await supabase
              .from("resume_documents")
              .select("state")
              .eq("id", result[i]!.documentId!)
              .eq("company_id", companyId)
              .maybeSingle();
            if (data) state = documentState(data.state);
          }
          update(i, {
            state,
            message:
              e instanceof Error
                ? e.message
                : "Falha no envio. Confira o histórico antes de repetir.",
          });
        } finally {
          if (!controller.signal.aborted) await refresh();
        }
      }
    } catch (e) {
      result = result.map((i) =>
        i.state === "aguardando" ? { ...i, state: "erro", message: (e as Error).message } : i,
      );
      if (!controller.signal.aborted) setItems(result);
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        setFinished(true);
        const s = uploadSummary(result);
        if (s.failed === result.length)
          toast.error("Nenhum arquivo foi concluído. Confira os motivos de recusa.");
        else if (s.failed || s.review || s.pending)
          toast.warning("Lote finalizado com pendências. Confira o resumo.");
        else toast.success(`${s.completed} currículo(s) concluído(s).`);
      }
    }
  }
  async function reconcile() {
    try {
      const result = await invokeResume<{ removed: number; failed: number }>({
        action: "cleanup",
        companyId,
      });
      await refresh();
      if (result.failed)
        toast.error(
          `${result.failed} arquivo(s) ainda não puderam ser removidos. Tente novamente mais tarde.`,
        );
      else
        toast.info(
          `Conferência concluída: ${result.removed} arquivo(s) temporário(s) removido(s).`,
        );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const summary = uploadSummary(items);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Enviar currículos</h1>
        <p className="text-sm text-muted-foreground">
          PDF, Word DOCX, JPG e PNG. Até 5 arquivos por envio, 10 MB por arquivo e 20 páginas por
          documento.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Selecionar arquivos</CardTitle>
          <CardDescription>
            Imagens: até 8 megapixels. DOCX: páginas declaradas/estimadas, até 60.000 caracteres e
            20 MB descompactados. DOC, arquivos com senha, macros ou conteúdo ativo são recusados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm">
            Origem dos currículos
            <select
              className="ml-3 rounded border bg-background p-2"
              value={source}
              disabled={busy || !canEdit}
              onChange={(e) => setSource(e.target.value as keyof typeof sources)}
            >
              {Object.entries(sources).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Input
            aria-label="Selecionar currículos"
            type="file"
            multiple
            accept={FILE_ACCEPT}
            disabled={!canEdit || busy}
            onChange={(e) => {
              selectFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="text-sm text-muted-foreground">
            Arquivos idênticos já enviados para esta empresa reutilizam o registro existente, sem
            nova leitura por IA.
          </p>
          <Button
            disabled={!canEdit || busy || !items.some((i) => i.state === "aguardando")}
            onClick={start}
          >
            {busy ? "Processando lote…" : "Iniciar envio"}
          </Button>
          {busy && (
            <p role="status" className="text-sm">
              Mantenha esta página aberta. Ao sair ou trocar de empresa, os próximos envios são
              cancelados; o histórico preserva os já recebidos.
            </p>
          )}
        </CardContent>
      </Card>
      {!!items.length && (
        <Card>
          <CardHeader>
            <CardTitle>Andamento do lote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3" aria-live="polite">
            {items.map((item, index) => (
              <div key={index} className="border-b pb-2 text-sm">
                <p className="break-all font-medium">{item.file.name}</p>
                <p className={item.state === "erro" ? "text-destructive" : "text-muted-foreground"}>
                  {labels[item.state]}
                  {item.duplicate ? " · Registro existente, sem duplicação" : ""}
                </p>
                {item.message && <p>{item.message}</p>}
              </div>
            ))}
            {finished && (
              <p role="status" className="font-medium">
                Resumo: {summary.completed} concluído(s), {summary.failed} com erro,{" "}
                {summary.review} para revisão e {summary.pending} pendente(s). {summary.duplicates}{" "}
                arquivo(s) já existente(s).
              </p>
            )}
            <Button asChild variant="outline">
              <Link to="/">Ver candidatos</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de recebimento</CardTitle>
          <CardDescription>
            Últimos 50 documentos da empresa. O registro inclui responsável pelo envio, data e
            origem. A lista é atualizada a cada 5 segundos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canAdmin && (
            <Button variant="outline" onClick={reconcile}>
              Conferir e limpar envios interrompidos
            </Button>
          )}
          {history.isError && <p role="alert">Não foi possível carregar o histórico.</p>}
          {history.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum documento recebido ainda.</p>
          )}
          {history.data?.map((doc) => (
            <div key={doc.id} className="border-b pb-3 text-sm">
              <Link
                className="font-medium underline"
                to="/candidatos/$id"
                params={{ id: doc.candidate_id }}
              >
                {doc.filename}
              </Link>
              <p>
                {labels[documentState(doc.state)]} · {sources[doc.source as keyof typeof sources]}
              </p>
              <p className="break-all text-muted-foreground">
                {new Date(doc.created_at).toLocaleString("pt-BR")} · Usuário:{" "}
                {doc.uploaded_by ?? "Conta removida"}
              </p>
              {doc.error_message && <p>{doc.error_message}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
