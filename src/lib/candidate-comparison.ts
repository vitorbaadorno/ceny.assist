import type { Tables } from "@/integrations/supabase/types";
import type { MatchDetails } from "./scoring";
import type { JobCriterion } from "../../supabase/functions/_shared/job-criteria";
export type ComparisonPerson = {
  current: Pick<
    Tables<"candidates">,
    | "id"
    | "nome"
    | "localizacao"
    | "skills"
    | "anos_experiencia"
    | "processing_status"
    | "review_status"
    | "review_version"
    | "data_version"
    | "active_document_id"
  >;
  entry: Tables<"ranking_entries"> | null;
};
export type ComparisonData = {
  job: Tables<"jobs">;
  run: Tables<"ranking_runs"> | null;
  candidates: ComparisonPerson[];
};
export function comparisonState(data: ComparisonData, person: ComparisonPerson) {
  const { run } = data;
  const { current, entry } = person;
  const snapshot = entry?.snapshot as unknown as Tables<"candidates"> | undefined;
  const stale =
    !!run &&
    (run.stale ||
      run.formula !== "evidence-v3" ||
      (run.job_snapshot as unknown as Tables<"jobs">).version !== data.job.version ||
      (!!snapshot &&
        (snapshot.data_version !== current.data_version ||
          snapshot.review_version !== current.review_version ||
          snapshot.active_document_id !== current.active_document_id)));
  const pending =
    current.review_status !== "completed" ||
    !["concluido", "revisao_manual"].includes(current.processing_status);
  return {
    stale,
    pending,
    reason: !run
      ? "Ranking ainda não calculado."
      : !entry
        ? "Candidato não incluído nesta avaliação."
        : (entry.reason ?? (entry.score === null ? "Sem avaliação final." : null)),
    display: snapshot ?? current,
  };
}
export function comparisonCriterion(criterion: JobCriterion, entry: ComparisonPerson["entry"]) {
  const criteria = (entry?.details as unknown as Partial<MatchDetails> | null)?.criterios;
  if (!entry || entry.reason || entry.score === null || !Array.isArray(criteria)) return null;
  return (
    criteria.find(
      (c) =>
        c.kind === criterion.kind &&
        c.text === criterion.text &&
        c.required === criterion.required &&
        c.weight === criterion.weight &&
        c.min_years === criterion.min_years,
    ) ?? null
  );
}
