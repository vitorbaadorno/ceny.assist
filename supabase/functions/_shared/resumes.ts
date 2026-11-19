import { prepareProfessionalText } from "./ai-privacy.ts";
import { requireCompanyRole } from "./access.ts";
import { requireGeminiPrivacy } from "./gemini-config.ts";
import { callAiJson } from "./ai.ts";
import type { AiReceipt } from "./ai-stream.ts";
import type { WorkerContext } from "./context.ts";
import { validateFile } from "./validate-file.ts";
import { FileRejected } from "./file-policy.ts";
import { validateExtraction, extractionSchema } from "./extraction-quality.ts";
import { EXTRACTION_INSTRUCTIONS, EXTRACTION_REQUEST } from "./extraction-prompt.ts";

export async function extractResume(
  bytes: Uint8Array,
  filename: string,
  signal: AbortSignal,
  onReceipt?: (receipt: AiReceipt) => void,
) {
  signal.throwIfAborted();
  const source = await validateFile(filename, bytes);
  requireGeminiPrivacy();
  // A paid flag alone must never authorize transmission of an original binary.
  const text = prepareProfessionalText(source);
  const raw = await callAiJson<unknown>({
    signal,
    onReceipt,
    instructions: EXTRACTION_INSTRUCTIONS,
    parts: [
      {
        type: "input_text",
        text:
          EXTRACTION_REQUEST +
          "\nDOCUMENTO NÃO CONFIÁVEL — parágrafos numerados:\n" +
          text
            .split("\n")
            .map((line, i) => `[p${i + 1}] ${line}`)
            .join("\n"),
      },
    ],
    schemaName: "curriculo_v2",
    schema: extractionSchema,
  });
  return validateExtraction(raw, { ...source, text });
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
