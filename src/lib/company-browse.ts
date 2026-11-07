import { useEffect, useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { readCompanyPage } from "@/data/company-browse";
import type { Tables } from "@/integrations/supabase/types";

export type BrowseFilters = Partial<
  Record<
    | "q"
    | "location"
    | "minExperience"
    | "skill"
    | "status"
    | "processing"
    | "review"
    | "category"
    | "minScore"
    | "outcome"
    | "required"
    | "criterion"
    | "favorite"
    | "criterionState",
    string
  >
>;
export type BrowsePage<T> = {
  items: T[];
  total: number;
  filtered: number;
  page: number;
  pageSize: number;
};
export type CandidateListItem = Pick<
  Tables<"candidates">,
  | "id"
  | "nome"
  | "email"
  | "telefone"
  | "localizacao"
  | "arquivo_nome"
  | "skills"
  | "anos_experiencia"
  | "status"
  | "processing_status"
  | "review_status"
  | "created_at"
> & { is_favorite: boolean };
export function useBrowse<T>(
  kind: "candidates" | "jobs" | "ranking",
  companyId: string,
  filters: BrowseFilters,
  page: number,
  runId?: string,
  key?: string,
) {
  const serialized = JSON.stringify(filters);
  const [debounced, setDebounced] = useState(serialized);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(serialized), 250);
    return () => clearTimeout(timer);
  }, [serialized]);
  const result = useQuery<BrowsePage<T>>({
    queryKey: [
      key ?? (kind === "ranking" ? "ranking-entries" : kind),
      companyId,
      runId,
      debounced,
      page,
    ],
    enabled: !!companyId && (kind !== "ranking" || !!runId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (q) =>
      kind === "candidates" &&
      q.state.data?.items.some(
        (row) => (row as CandidateListItem).processing_status === "processando",
      )
        ? 5000
        : false,
    queryFn: async ({ signal }) => {
      return readCompanyPage<T>(kind, companyId, JSON.parse(debounced), page, signal, runId);
    },
  });
  // Never display cached rows as the result of a different, not-yet-issued query.
  return {
    ...result,
    data: serialized === debounced ? result.data : undefined,
    isLoading: serialized !== debounced || result.isLoading,
  };
}
export function refreshCompanyLists(cache: QueryClient, companyId: string) {
  return Promise.all(
    [
      "candidates",
      "candidate",
      "job",
      "job-revisions",
      "job-scores",
      "person-documents",
      "resume-documents",
      "document-analysis",
      "attempt-detail",
      "company-usage",
      "company-operations",
      "company-activity",
      "resume-batches",
      "candidate-queue",
      "candidate-revisions",
      "candidate-scores",
      "candidate-notes",
      "candidate-decisions",
      "vacancy-reports",
      "report-runs",
      "vacancy-report-events",
      "candidate-favorites",
      "privacy-candidates",
      "privacy-history",
      "talent-pool",
      "candidate-job-links",
      "linkable-jobs",
      "jobs",
      "candidate-comparison",
      "ranking-current",
      "ranking-entries",
      "ranking-pending",
      "ranking-runs",
    ].map((key) => cache.invalidateQueries({ queryKey: [key, companyId] })),
  );
}
