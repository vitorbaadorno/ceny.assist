import { supabase } from "@/integrations/supabase/client";
export {
  FILE_LIMITS,
  FILE_ACCEPT,
  checkFileEnvelope,
} from "../../supabase/functions/_shared/file-policy";
export { documentState, uploadSummary, type UploadState } from "./resume-progress";
export async function invokeResume<T>(body: unknown, signal?: AbortSignal): Promise<T> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error("Sessão expirada. Entre novamente.");
  const response = await fetch(
    `${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/analisar-curriculo`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(120000),
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw Object.assign(new Error(result?.error ?? "Operação indisponível."), {
      status: response.status,
    });
  if (!result)
    throw new Error("O serviço não confirmou a operação. Confira o histórico antes de repetir.");
  return result;
}
export async function sendResume(
  file: File,
  companyId: string,
  batchId: string,
  slot: number,
  signal: AbortSignal,
  candidateId?: string,
) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error("Sessão expirada. Entre novamente.");
  const params = new URLSearchParams({
    action: "upload",
    companyId,
    batchId,
    slot: String(slot),
  });
  if (candidateId) {
    params.set("candidateId", candidateId);
    params.set("identityConfirmed", "true");
  }
  const response = await fetch(
    `${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/ceny-worker?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
        "Content-Type": "application/octet-stream",
        "x-ceny-filename": encodeURIComponent(file.name),
      },
      body: file,
      signal,
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw Object.assign(new Error(result?.error ?? "Envio recusado."), { status: response.status });
  if (!result?.documentId || !result?.candidateId || typeof result.state !== "string")
    throw new Error("O serviço não confirmou o envio. Confira o histórico antes de repetir.");
  return result as {
    documentId: string;
    candidateId: string;
    state: string;
    duplicate: boolean;
    message?: string;
  };
}
