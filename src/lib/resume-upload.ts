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
  if (error || !session) throw new Error("Sessão indisponível. Entre novamente.");
  const response = await fetch(`${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/ceny-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(120000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Operação indisponível.");
  return result;
}
export async function sendResume(
  file: File,
  companyId: string,
  batchId: string,
  slot: number,
  signal: AbortSignal,
) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session) throw new Error("Sessão indisponível. Entre novamente.");
  const params = new URLSearchParams({
    action: "upload",
    companyId,
    batchId,
    slot: String(slot),
    filename: file.name,
  });
  const response = await fetch(
    `${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/ceny-worker?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
        "Content-Type": "application/octet-stream",
      },
      body: file,
      signal,
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Envio recusado.");
  return result as {
    documentId: string;
    candidateId: string;
    state: string;
    duplicate: boolean;
    message?: string;
  };
}
