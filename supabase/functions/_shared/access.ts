import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import type { Database } from "./database.ts";

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
