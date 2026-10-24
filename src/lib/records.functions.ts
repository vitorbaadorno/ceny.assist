import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCompanyRole } from "@/lib/company-access";

export const archiveCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ companyId: z.string().uuid(), candidateId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireCompanyRole(context.supabase, context.userId, data.companyId, ["owner", "admin"]);
    const { error } = await context.supabase.rpc("archive_candidate", {
      p_company: data.companyId,
      p_id: data.candidateId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ companyId: z.string().uuid(), jobId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireCompanyRole(context.supabase, context.userId, data.companyId, ["owner", "admin"]);
    const { error } = await context.supabase.rpc("archive_job", {
      p_company: data.companyId,
      p_id: data.jobId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
