import { requireCompanyRole } from "./access.ts";
import { scoreCandidate, type CandidateForScore } from "./scoring.ts";
import type { Json, WorkerContext } from "./context.ts";
type Run = {
  id: string;
  status: string;
  eligible: number;
  total: number;
  job_snapshot: { criteria: Json };
};
export async function rankCandidates(
  data: { companyId: string; jobId: string; requestId: string },
  context: WorkerContext,
) {
  await requireCompanyRole(context.supabase, context.userId, data.companyId, [
    "owner",
    "admin",
    "recruiter",
  ]);
  const { data: started, error: startError } = await context.admin.rpc("begin_ranking", {
    p_actor: context.userId,
    p_company: data.companyId,
    p_job: data.jobId,
    p_request: data.requestId,
  });
  if (startError)
    throw new Error(
      "Não foi possível iniciar. Confira a aprovação da vaga ou aguarde o cálculo em andamento.",
    );
  const run = started as unknown as Run;
  if (run.status === "completed")
    return { count: run.eligible, pending: run.total - run.eligible, runId: run.id };
  try {
    let cursor = "";
    for (;;) {
      let query = context.supabase
        .from("ranking_entries")
        .select("candidate_id,snapshot,reason")
        .eq("company_id", data.companyId)
        .eq("run_id", run.id)
        .is("reason", null)
        .order("candidate_id")
        .limit(200);
      if (cursor) query = query.gt("candidate_id", cursor);
      const { data: page, error } = await query;
      if (error) throw error;
      if (!page?.length) break;
      const rows = page.map((e) => {
        const c = e.snapshot as unknown as CandidateForScore & { dados_efetivos: Json };
        const result = scoreCandidate(
          { ...c, dados_extraidos: c.dados_efetivos },
          run.job_snapshot,
        );
        return { candidate_id: e.candidate_id, score: result.score, details: result.details };
      });
      const saved = await context.admin.rpc("stage_ranking", {
        p_actor: context.userId,
        p_run: run.id,
        p_rows: rows as unknown as Json,
      });
      if (saved.error) throw saved.error;
      cursor = page[page.length - 1]!.candidate_id;
    }
    const finished = await context.admin.rpc("finish_ranking", {
      p_actor: context.userId,
      p_run: run.id,
    });
    if (finished.error) throw finished.error;
    return { count: run.eligible, pending: run.total - run.eligible, runId: run.id };
  } catch {
    await context.admin.rpc("fail_ranking", { p_actor: context.userId, p_run: run.id });
    throw new Error(
      "O cálculo não foi publicado. O ranking anterior foi preservado. Confira alterações recentes e inicie um novo cálculo.",
    );
  }
}
