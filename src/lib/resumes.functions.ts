import { errorFeedback } from "@/lib/ui-feedback";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCompanyRole } from "@/lib/company-access";
export const processResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ companyId: z.string().uuid(), candidateId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireCompanyRole(context.supabase, context.userId, data.companyId, [
      "owner",
      "admin",
      "recruiter",
    ]);
    const { data: result, error } = await context.supabase.functions.invoke("ceny-worker", {
      body: { action: "extract", ...data },
    });
    if (error) {
      if (error.context instanceof Response) {
        const detail = await error.context.json().catch(() => null);
        if (typeof detail?.error === "string") throw new Error(detail.error);
      }
      throw new Error(
        "Não foi possível processar o currículo. Verifique se o serviço de IA está configurado.",
      );
    }
    return result as { status: string };
  });

export const getResumeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        candidateId: z.string().uuid(),
        documentId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireCompanyRole(context.supabase, context.userId, data.companyId);
    const { data: candidate, error: loadError } = await context.supabase
      .from("candidates")
      .select("arquivo_original_path, arquivo_nome, active_document_id")
      .eq("company_id", data.companyId)
      .eq("id", data.candidateId)
      .single();
    if (loadError && loadError.code !== "PGRST116")
      throw new Error(errorFeedback(loadError, "Não foi possível consultar o currículo.").message);
    if (!candidate?.arquivo_original_path) throw new Error("Currículo indisponível.");
    let path = candidate.arquivo_original_path;
    let filename = candidate.arquivo_nome ?? "curriculo";
    const documentId = data.documentId ?? candidate.active_document_id;
    if (documentId) {
      const { data: document, error } = await context.supabase
        .from("resume_documents")
        .select("object_path,filename,stored_at")
        .eq("id", documentId)
        .eq("company_id", data.companyId)
        .eq("candidate_id", data.candidateId)
        .single();
      if (error && error.code !== "PGRST116")
        throw new Error(errorFeedback(error, "Não foi possível consultar o documento.").message);
      if (!document?.stored_at) throw new Error("Documento indisponível.");
      path = document.object_path;
      filename = document.filename;
    }
    const { data: signed, error } = await context.supabase.storage
      .from("resumes")
      .createSignedUrl(path, 60, {
        download: filename,
      });
    if (error)
      throw new Error(errorFeedback(error, "Não foi possível gerar o link do currículo.").message);
    if (!signed?.signedUrl) throw new Error("Não foi possível gerar o link do currículo.");
    return { url: signed.signedUrl };
  });
