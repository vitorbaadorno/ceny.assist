import { requireCompanyRole } from "./access.ts";
import { validateFile } from "./validate-file.ts";
import { readLimitedBody, FileRejected } from "./file-policy.ts";
import type { WorkerContext } from "./context.ts";

export async function cleanupResumes(companyId: string, context: WorkerContext) {
  await requireCompanyRole(context.supabase, context.userId, companyId, [
    "owner",
    "admin",
    "recruiter",
  ]);
  const { data: targets, error } = await context.admin.rpc("claim_resume_cleanup", {
    p_actor: context.userId,
    p_company: companyId,
  });
  if (error) throw new Error("Não foi possível conferir os envios interrompidos.");
  let removed = 0,
    failed = 0;
  for (const target of targets ?? []) {
    const { error: removeError } = await context.admin.storage
      .from("resumes")
      .remove([target.object_path]);
    if (removeError) {
      failed++;
      continue;
    }
    if (target.document_id) {
      const { error: finishError } = await context.admin.rpc("finish_resume_cleanup", {
        p_company: companyId,
        p_document: target.document_id,
      });
      if (finishError) {
        failed++;
        continue;
      }
    }
    removed++;
  }
  return { removed, failed };
}

async function receiveValidatedResume(
  request: Request,
  data: { companyId: string; batchId: string; slot: number; filename: string },
  context: WorkerContext,
) {
  await requireCompanyRole(context.supabase, context.userId, data.companyId, [
    "owner",
    "admin",
    "recruiter",
  ]);
  // Check quota and identity BEFORE reading an untrusted body; reserve rechecks atomically.
  const { data: batch, error: batchError } = await context.supabase
    .from("resume_batches")
    .select("uploaded_by,file_count,created_at")
    .eq("id", data.batchId)
    .eq("company_id", data.companyId)
    .single();
  if (
    batchError ||
    !batch ||
    batch.uploaded_by !== context.userId ||
    data.slot >= batch.file_count ||
    Date.now() - Date.parse(batch.created_at) > 3600000
  )
    throw new FileRejected("Lote inválido ou expirado. Selecione os arquivos novamente.");
  const bytes = await readLimitedBody(request);
  const validated = await validateFile(data.filename, bytes);
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const sha = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const { data: reservation, error } = await context.admin.rpc("reserve_resume", {
    p_actor: context.userId,
    p_company: data.companyId,
    p_batch: data.batchId,
    p_slot: data.slot,
    p_sha: sha,
    p_filename: data.filename,
    p_mime: validated.mime,
    p_size: bytes.length,
    p_pages: validated.pages,
  });
  if (error || !reservation)
    throw new FileRejected(
      "Não foi possível registrar o documento. O lote pode ter expirado ou o currículo já estar arquivado.",
    );
  const record = reservation as {
    documentId: string;
    candidateId: string;
    owned: boolean;
    token: string;
    path: string;
    state: string;
    message?: string;
  };
  if (!record.owned)
    return {
      documentId: record.documentId,
      candidateId: record.candidateId,
      state: record.state,
      duplicate: true,
      message: record.message,
    };
  try {
    const { error: uploadError } = await context.admin.storage
      .from("resumes")
      .upload(record.path, bytes, { contentType: validated.mime, upsert: false });
    if (uploadError) throw new Error("Falha no armazenamento.");
    const { error: finishError } = await context.admin.rpc("finish_resume_upload", {
      p_actor: context.userId,
      p_company: data.companyId,
      p_document: record.documentId,
      p_token: record.token,
    });
    if (finishError) throw new Error("Falha ao confirmar o recebimento.");
    return {
      documentId: record.documentId,
      candidateId: record.candidateId,
      state: "uploaded",
      duplicate: false,
    };
  } catch {
    // A lost confirmation may already have committed and queued this original.
    // Keep the tracked reference; reconciliation excludes jobs and waits beyond
    // the upload lifetime before deleting anything through the Storage API.
    throw new FileRejected(
      "O envio não foi confirmado. O registro foi preservado para conciliação; tente novamente após conferir o andamento.",
    );
  }
}

export async function receiveResume(
  request: Request,
  data: { companyId: string; batchId: string; slot: number; filename: string },
  context: WorkerContext,
) {
  try {
    const result = await receiveValidatedResume(request, data, context);
    if (result.state !== "receiving")
      await context.admin.rpc("record_resume_entry", {
        p_actor: context.userId,
        p_company: data.companyId,
        p_batch: data.batchId,
        p_slot: data.slot,
        p_filename: data.filename.slice(0, 180),
        p_state: ["error", "cleaning"].includes(result.state) ? "rejected" : "received",
        p_message: result.message,
      });
    return result;
  } catch (error) {
    if (error instanceof FileRejected)
      await context.admin.rpc("record_resume_entry", {
        p_actor: context.userId,
        p_company: data.companyId,
        p_batch: data.batchId,
        p_slot: data.slot,
        p_filename: data.filename.slice(0, 180),
        p_state: "rejected",
        p_message: error.message,
      });
    throw error;
  }
}
