import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCompanyRole } from "@/lib/company-access";
export const rankJobCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ companyId: z.string().uuid(), jobId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireCompanyRole(context.supabase, context.userId, data.companyId, [
      "owner",
      "admin",
      "recruiter",
    ]);
    const { data: result, error } = await context.supabase.functions.invoke("ceny-worker", {
      body: { action: "rank", ...data },
    });
    if (error)
      throw new Error(
        "Não foi possível calcular o ranking. Verifique seu acesso e tente novamente.",
      );
    return result as { count: number };
  });
