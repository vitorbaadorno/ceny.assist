import { supabase } from "@/integrations/supabase/client";
import type { BrowsePage, BrowseFilters } from "@/lib/company-browse";
import { decodeBrowsePage } from "@/lib/browse-page";
export async function readCompanyPage<T>(
  kind: "ranking" | "jobs" | "candidates",
  companyId: string,
  filters: BrowseFilters,
  page: number,
  signal: AbortSignal,
  runId?: string,
) {
  const args = { p_company: companyId, p_filters: filters, p_page: page };
  const request =
    kind === "ranking"
      ? supabase.rpc("browse_ranking", { ...args, p_run: runId! })
      : kind === "jobs"
        ? supabase.rpc("browse_job_cards", args)
        : supabase.rpc("browse_candidates", args);
  const { data, error } = await request.abortSignal(signal);
  if (error) throw error;
  return decodeBrowsePage(kind, data) as BrowsePage<T>;
}
