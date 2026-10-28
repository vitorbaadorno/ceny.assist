import { requireCompanyRole } from "./access.ts";
import { scoreCandidate } from "./scoring.ts";
import { isYoungApprenticeEligible } from "./age.ts";
import { validateJobPayload } from "./job-criteria.ts";
import type { Json, WorkerContext } from "./context.ts";
export async function rankCandidates(
  data: { companyId: string; jobId: string },
  context: WorkerContext,
) {
  const supabase = context.supabase;
  await requireCompanyRole(supabase, context.userId, data.companyId, [
    "owner",
    "admin",
    "recruiter",
  ]);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("company_id", data.companyId)
    .eq("id", data.jobId)
    .single();
  if (jobError || !job) throw new Error("Vaga não encontrada.");
  if (job.status !== "aberta" || !job.approved_hash)
    throw new Error("Reabra a vaga e aprove os critérios antes de avaliar.");
  validateJobPayload(
    {
      titulo: job.titulo,
      descricao: job.descricao ?? "",
      categoria: job.categoria as "regular" | "jovem_aprendiz",
      criteria: job.criteria as never,
    },
    true,
  );

  const candidates: Array<{
    id: string;
    skills: string[];
    localizacao: string | null;
    anos_experiencia: number | null;
    dados_efetivos: Json;
    data_nascimento: string | null;
    data_version: number;
  }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data: page, error } = await supabase
      .from("candidates")
      .select(
        "id, skills, localizacao, anos_experiencia, dados_efetivos, data_nascimento, data_version",
      )
      .eq("company_id", data.companyId)
      .in("processing_status", ["concluido", "revisao_manual"])
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error(error.message);
    candidates.push(...(page ?? []));
    if (!page || page.length < 500) break;
  }

  const eligibleCandidates = (candidates ?? []).filter(
    (candidate) =>
      job.categoria !== "jovem_aprendiz" || isYoungApprenticeEligible(candidate.data_nascimento),
  );

  const rows = eligibleCandidates.map((candidate) => {
    const { score, details } = scoreCandidate(
      { ...candidate, dados_extraidos: candidate.dados_efetivos },
      job,
    );
    return {
      candidate_id: candidate.id,
      candidate_version: candidate.data_version,
      job_id: job.id,
      score,
      detalhes_matching: details as unknown as Json,
    };
  });

  const supabaseAdmin = context.admin;
  const { error } = await supabaseAdmin.rpc("replace_job_scores_v2", {
    p_actor: context.userId,
    p_company: data.companyId,
    p_job: job.id,
    p_job_version: job.version,
    p_criteria_hash: job.approved_hash,
    p_scores: rows as unknown as Json,
  });
  if (error) throw new Error(error.message);

  return { count: rows.length };
}
