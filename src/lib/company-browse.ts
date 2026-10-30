import { useEffect, useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
>;
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
  const result = useQuery({
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
    refetchInterval: 5000,
    queryFn: async ({ signal }) => {
      const args = { p_company: companyId, p_filters: JSON.parse(debounced), p_page: page };
      const request =
        kind === "ranking"
          ? supabase.rpc("browse_ranking", { ...args, p_run: runId! })
          : kind === "jobs"
            ? supabase.rpc("browse_jobs", args)
            : supabase.rpc("browse_candidates", args);
      const { data, error } = await request.abortSignal(signal);
      if (error) throw error;
      return data as unknown as BrowsePage<T>;
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
      "talent-pool",
      "candidate-job-links",
      "linkable-jobs",
      "jobs",
      "ranking-current",
      "ranking-entries",
      "ranking-pending",
      "ranking-runs",
    ].map((key) => cache.invalidateQueries({ queryKey: [key, companyId] })),
  );
}
