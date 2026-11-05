import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReportAccess } from "./vacancy-report";

export const downloadVacancyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        reportId: z.string().uuid(),
        format: z.enum(["pdf", "csv"]),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RPC rechecks live membership and every candidate, then audits the release atomically.
    const result = await context.supabase.rpc("access_vacancy_report", {
      p_company: data.companyId,
      p_report: data.reportId,
      p_action: data.format,
    });
    if (result.error)
      throw new Error(
        "Download indisponível. Confira seu acesso e a disponibilidade dos candidatos.",
      );
    const access = result.data as unknown as ReportAccess;
    const bytes =
      data.format === "pdf"
        ? await (await import("./vacancy-report-pdf")).reportPdf(access)
        : new TextEncoder().encode((await import("./vacancy-report")).reportCsv(access));
    // No public bucket, permanent URL, or client-supplied report content.
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": data.format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ceny-relatorio-${data.reportId}.${data.format}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
