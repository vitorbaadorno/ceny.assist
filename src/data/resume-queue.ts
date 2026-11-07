import { supabase } from "@/integrations/supabase/client";
export const jobFields =
  "id,document_id,candidate_id,state,phase,generation,attempts,available_at,message,created_at" as const;
export async function readBatchHistory(companyId: string) {
  const batches = await supabase
    .from("resume_batches")
    .select(
      "id,created_at,file_count,resume_batch_entries(slot,filename,state,message),resume_batch_items(slot,document_id)",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (batches.error) throw batches.error;
  const ids = [
    ...new Set(batches.data.flatMap((b) => b.resume_batch_items.map((i) => i.document_id))),
  ];
  const jobs = ids.length
    ? await supabase.rpc("batch_current_jobs", { p_company: companyId, p_documents: ids })
    : { data: [], error: null };
  if (jobs.error) throw jobs.error;
  return batches.data.map((b) => ({
    ...b,
    entries: b.resume_batch_entries
      .sort((a, c) => a.slot - c.slot)
      .map((entry) => {
        const doc = b.resume_batch_items.find((i) => i.slot === entry.slot);
        return { ...entry, job: jobs.data?.find((j) => j.document_id === doc?.document_id) };
      }),
  }));
}
