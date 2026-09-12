import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const archiveCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: candidate, error: loadError } = await context.supabase
      .from("candidates")
      .select("id, arquivo_original_path")
      .eq("id", data.candidateId)
      .single();
    if (loadError || !candidate) throw new Error("Candidato não encontrado.");

    if (candidate.arquivo_original_path) {
      const { error } = await context.supabase.storage
        .from("resumes")
        .remove([candidate.arquivo_original_path]);
      if (error) throw new Error("Não foi possível apagar o arquivo do currículo.");
    }

    const { error: scoresError } = await context.supabase
      .from("candidate_scores")
      .delete()
      .eq("candidate_id", candidate.id);
    if (scoresError) throw new Error(scoresError.message);

    const { error: archiveError } = await context.supabase.rpc("archive_candidate", {
      p_id: candidate.id,
    });
    if (archiveError) throw new Error(archiveError.message);
    return { ok: true };
  });

export const archiveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job, error: loadError } = await context.supabase
      .from("jobs")
      .select("id")
      .eq("id", data.jobId)
      .single();
    if (loadError || !job) throw new Error("Vaga não encontrada.");

    const { error: scoresError } = await context.supabase
      .from("candidate_scores")
      .delete()
      .eq("job_id", job.id);
    if (scoresError) throw new Error(scoresError.message);

    const { error: archiveError } = await context.supabase.rpc("archive_job", {
      p_id: job.id,
    });
    if (archiveError) throw new Error(archiveError.message);
    return { ok: true };
  });