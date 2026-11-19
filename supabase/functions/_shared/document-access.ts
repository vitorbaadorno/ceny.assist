import { requireCompanyRole } from "./access.ts";
import type { WorkerContext } from "./context.ts";

export async function signResume(
  data: { companyId: string; candidateId: string; documentId?: string },
  context: WorkerContext,
) {
  await requireCompanyRole(context.supabase, context.userId, data.companyId);
  const { data: candidate, error } = await context.supabase
    .from("candidates")
    .select("arquivo_original_path,active_document_id")
    .eq("company_id", data.companyId)
    .eq("id", data.candidateId)
    .eq("excluido", false)
    .single();
  if (error || !candidate?.arquivo_original_path) throw new Error("Currículo indisponível.");
  let path = candidate.arquivo_original_path;
  const id = data.documentId ?? candidate.active_document_id;
  if (id) {
    const { data: doc, error: loadError } = await context.supabase
      .from("resume_documents")
      .select("object_path,stored_at")
      .eq("id", id)
      .eq("company_id", data.companyId)
      .eq("candidate_id", data.candidateId)
      .single();
    if (loadError || !doc?.stored_at) throw new Error("Documento indisponível.");
    path = doc.object_path;
  }
  // Only this backend owns signing authority. No caller path, filename or TTL is accepted.
  const { data: signed, error: signError } = await context.admin.storage
    .from("resumes")
    .createSignedUrl(path, 60, { download: "curriculo" });
  if (signError || !signed?.signedUrl) throw new Error("Documento indisponível.");
  // Recheck after privileged I/O: revocation/archive must not return the generated URL.
  await requireCompanyRole(context.supabase, context.userId, data.companyId);
  const current = await context.supabase
    .from("candidates")
    .select("id")
    .eq("company_id", data.companyId)
    .eq("id", data.candidateId)
    .eq("excluido", false)
    .single();
  if (current.error || !current.data) throw new Error("Currículo indisponível.");
  const audit = await context.supabase.rpc("record_document_access", {
    p_company: data.companyId,
    p_candidate: data.candidateId,
  });
  if (audit.error || audit.data !== true) throw new Error("Acesso indisponível.");
  return { url: signed.signedUrl };
}
