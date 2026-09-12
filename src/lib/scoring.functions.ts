import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scoreCandidate } from "@/lib/scoring";

export const rankJobCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", data.jobId)
      .single();
    if (jobError || !job) throw new Error("Vaga não encontrada.");

    const { data: candidates, error: candidatesError } = await supabase
      .from("candidates")
      .select("id, skills, localizacao, anos_experiencia, dados_extraidos")
      .neq("processing_status", "processando");
    if (candidatesError) throw new Error(candidatesError.message);

    const rows = (candidates ?? []).map((candidate) => {
      const { score, details } = scoreCandidate(candidate, job);
      return {
        candidate_id: candidate.id,
        job_id: job.id,
        score,
        detalhes_matching: details as unknown as Record<string, unknown>,
      };
    });

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("candidate_scores")
        .upsert(rows, { onConflict: "candidate_id,job_id" });
      if (upsertError) throw new Error(upsertError.message);
    }

    return { count: rows.length };
  });
