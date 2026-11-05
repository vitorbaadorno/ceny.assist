import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCompanyRole } from "@/lib/company-access";

export const exportPrivacySubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ companyId: z.string().uuid(), requestId: z.string().uuid() }).parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireCompanyRole(context.supabase, context.userId, data.companyId, ["owner", "admin"]);
    const { data: result, error } = await context.supabase.rpc("export_privacy_subject", {
      p_company: data.companyId,
      p_request: data.requestId,
    });
    if (error) throw new Error("Confira o pedido, a verificação de identidade e seu acesso.");
    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="pedido-${data.requestId}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
