import { requireCompanyRole } from "./access.ts";
import { callAiJson, type InputPart } from "./ai.ts";
import type { AiReceipt } from "./ai-stream.ts";
import type { WorkerContext } from "./context.ts";
import { validateFile } from "./validate-file.ts";
import { FileRejected } from "./file-policy.ts";
import { validateExtraction, extractionSchema } from "./extraction-quality.ts";
import { EXTRACTION_INSTRUCTIONS, EXTRACTION_REQUEST } from "./extraction-prompt.ts";

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
export async function extractResume(
  bytes: Uint8Array,
  filename: string,
  signal: AbortSignal,
  onReceipt?: (receipt: AiReceipt) => void,
) {
  signal.throwIfAborted();
  const source = await validateFile(filename, bytes);
  const base64 = source.text ? "" : toBase64(bytes);
  const parts: InputPart[] = [
    { type: "input_text", text: EXTRACTION_REQUEST },
    source.text
      ? {
          type: "input_text",
          text:
            "DOCUMENTO NÃO CONFIÁVEL — parágrafos numerados:\n" +
            source.text
              .split("\n")
              .map((line, i) => `[p${i + 1}] ${line}`)
              .join("\n"),
        }
      : source.mime.startsWith("image/")
        ? { type: "input_image", image_url: `data:${source.mime};base64,${base64}`, detail: "high" }
        : { type: "input_file", filename, file_data: `data:${source.mime};base64,${base64}` },
  ];
  const raw = await callAiJson<unknown>({
    signal,
    onReceipt,
    instructions: EXTRACTION_INSTRUCTIONS,
    parts,
    schemaName: "curriculo_v2",
    schema: extractionSchema,
  });
  return validateExtraction(raw, source);
}

// Compatibility endpoint only enqueues; the independent scheduler performs I/O.
export async function processResume(
  data: { companyId: string; candidateId: string },
  context: WorkerContext,
) {
  await requireCompanyRole(context.supabase, context.userId, data.companyId, [
    "owner",
    "admin",
    "recruiter",
  ]);
  const { data: jobId, error } = await context.supabase.rpc("request_resume_job", {
    p_company: data.companyId,
    p_candidate: data.candidateId,
    p_mode: "normal",
    p_request: crypto.randomUUID(),
  });
  if (error)
    throw new FileRejected(
      "Não foi possível colocar este currículo na fila. Confira o original e seu acesso.",
    );
  return { status: "queued", jobId };
}
