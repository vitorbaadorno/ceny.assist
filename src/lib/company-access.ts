import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function requireCompanyRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  companyId: string,
  roles = ["owner", "admin", "recruiter", "viewer"],
) {
  const { data, error } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .single();
  if (error || !data || !roles.includes(data.role)) {
    throw new Error("Você não tem permissão para esta operação na empresa selecionada.");
  }
  return data.role;
}
