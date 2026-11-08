import { supabase } from "@/integrations/supabase/client";

export async function readCandidate(companyId: string, id: string, signal: AbortSignal) {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function readVacancy(companyId: string, id: string, signal: AbortSignal) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw error;
  return data;
}
