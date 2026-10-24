import { useCompany } from "@/hooks/useCompany";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { processResume } from "@/lib/resumes.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Enviar currículos | Triagem de Currículos" },
      {
        name: "description",
        content:
          "Envie currículos em PDF ou foto e deixe a IA extrair nome, contato, formação, experiências e habilidades automaticamente.",
      },
      { property: "og:title", content: "Enviar currículos | Triagem de Currículos" },
      {
        property: "og:description",
        content: "Upload em lote de currículos em PDF ou imagem com leitura automática por IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadPage,
});

type Item = {
  name: string;
  state: "enviando" | "lendo" | "ok" | "revisao" | "erro";
  message?: string;
};

function UploadPage() {
  const { companyId, canEdit, canAdmin } = useCompany();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const runExtraction = useServerFn(processResume);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const list = Array.from(files);
    setItems(list.map((file) => ({ name: file.name, state: "enviando" as const })));

    const update = (index: number, patch: Partial<Item>) =>
      setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

    for (let index = 0; index < list.length; index++) {
      const file = list[index]!;
      try {
        if (!canEdit) throw new Error("Sem permissão para enviar currículos.");
        if (
          !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
          !file.size ||
          file.size > 10 * 1024 * 1024
        ) {
          throw new Error("Envie PDF, JPG ou PNG de até 10 MB.");
        }
        const { data: candidate, error: insertError } = await supabase
          .from("candidates")
          .insert({
            id: crypto.randomUUID(),
            company_id: companyId,
            nome: file.name,
            arquivo_nome: file.name,
          })
          .select("id, arquivo_original_path")
          .single();
        if (insertError || !candidate)
          throw new Error(insertError?.message ?? "Falha ao registrar.");
        const { error: uploadError } = await supabase.storage
          .from("resumes")
          .upload(candidate.arquivo_original_path!, file, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadError)
          throw new Error(
            "Arquivo não enviado. O registro poderá ser arquivado pelo administrador: " +
              uploadError.message,
          );

        update(index, { state: "lendo" });
        const result = await runExtraction({ data: { companyId, candidateId: candidate.id } });
        update(index, { state: result.status === "revisao_manual" ? "revisao" : "ok" });
      } catch (error) {
        update(index, {
          state: "erro",
          message: error instanceof Error ? error.message : "Falha no envio.",
        });
      }
    }

    setBusy(false);
    toast.info("Envio finalizado. Confira o resultado de cada arquivo.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Enviar currículos</h1>
        <p className="text-sm text-muted-foreground">
          Aceita PDF e fotos de currículos impressos (JPG, PNG). Você pode selecionar vários de uma
          vez.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar arquivos</CardTitle>
          <CardDescription>
            Cada arquivo vira um candidato e é lido automaticamente pela IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={!canEdit || busy}
            onChange={(e) => handleFiles(e.target.files)}
          />
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Processando os arquivos, não feche a
              página.
            </p>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Andamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-start gap-3 text-sm">
                {item.state === "ok" ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-success" />
                ) : item.state === "erro" ? (
                  <XCircle className="mt-0.5 size-4 text-destructive" />
                ) : item.state === "revisao" ? (
                  <FileText className="mt-0.5 size-4 text-warning" />
                ) : (
                  <Loader2 className="mt-0.5 size-4 animate-spin text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-muted-foreground">
                    {item.state === "enviando" && "Enviando arquivo..."}
                    {item.state === "lendo" && "IA lendo o currículo..."}
                    {item.state === "ok" && "Dados extraídos com sucesso."}
                    {item.state === "revisao" && "Extraído, mas precisa de revisão manual."}
                    {item.state === "erro" && item.message}
                  </p>
                </div>
              </div>
            ))}
            {!busy && (
              <Button variant="outline" onClick={() => navigate({ to: "/" })}>
                Ver candidatos
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
