import { supabase } from "@/integrations/supabase/client";

export async function readRecentDocuments(companyId: string, signal: AbortSignal) {
  const { data, error } = await supabase
    .from("resume_documents")
    .select("id,candidate_id,filename,state,source,created_at,uploaded_by,error_message")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50)
    .abortSignal(signal);
  if (error) throw error;
  return data;
}

export async function readDocumentVersions(
  companyId: string,
  candidateId: string,
  page: number,
  signal: AbortSignal,
) {
  const r = await supabase
    .from("resume_documents")
    .select(
      "id,version,filename,state,error_message,created_at,stored_at,source,uploaded_by,byte_size,page_count,sha256",
    )
    .eq("company_id", companyId)
    .eq("candidate_id", candidateId)
    .order("version", { ascending: false })
    .range(page * 20, page * 20 + 20)
    .abortSignal(signal);
  if (r.error) throw r.error;
  return r.data;
}
