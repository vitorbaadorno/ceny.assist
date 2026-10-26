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
    z.object({ companyId: z.string().uuid(), candidateId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireCompanyRole(context.supabase, context.userId, data.companyId);
    const { data: candidate, error: loadError } = await context.supabase
      .from("candidates")
      .select("arquivo_original_path, arquivo_nome")
      .eq("company_id", data.companyId)
      .eq("id", data.candidateId)
      .single();
    if (loadError || !candidate?.arquivo_original_path) throw new Error("Currículo indisponível.");
    const { data: signed, error } = await context.supabase.storage
      .from("resumes")
      .createSignedUrl(candidate.arquivo_original_path, 60, {
        download: candidate.arquivo_nome ?? "curriculo",
      });
    if (error || !signed) throw new Error("Não foi possível gerar o link do currículo.");
    return { url: signed.signedUrl };
  });
