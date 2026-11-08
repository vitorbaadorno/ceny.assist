import { extractionValidator, extractionSchema } from "./extraction-quality.ts";
import { EXTRACTION_INSTRUCTIONS } from "./extraction-prompt.ts";
import { AiGatewayError, type AiReceipt } from "./ai-stream.ts";
import { MODEL, GEMINI_ENDPOINT, requireGeminiPrivacy } from "./gemini-config.ts";
export { AiGatewayError } from "./ai-stream.ts";
export { MODEL } from "./gemini-config.ts";
export type InputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "high" }
  | { type: "input_file"; filename: string; file_data: string };
const tokens = (n: unknown) =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
export async function callAiJson<T>(options: {
  instructions: string;
  parts: InputPart[];
  schemaName: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  signal?: AbortSignal;
  onReceipt?: (r: AiReceipt) => void;
}): Promise<T> {
  requireGeminiPrivacy();
  return generate<T>(options);
}
// Fixed synthetic input only. Used by the private scheduler health check.
export async function probeGemini() {
  let receipt: AiReceipt | undefined;
  const result = await generate<unknown>({
    onReceipt: (r) => {
      receipt = r;
    },
    instructions: EXTRACTION_INSTRUCTIONS,
    parts: [
      {
        type: "input_text",
        text: "CurrÃ­culo fictÃ­cio para teste tÃ©cnico, sem pessoa real. [p1] ExperiÃªncia profissional: desenvolvimento SQL em projeto sintÃ©tico. [p2] FormaÃ§Ã£o: curso tÃ©cnico em desenvolvimento. NÃ£o hÃ¡ outras informaÃ§Ãµes.",
      },
    ],
    schema: extractionSchema,
  });
  return {
    ok: extractionValidator.safeParse(result).success,
    model: receipt?.model_reported ?? null,
    tokens: receipt?.total_tokens ?? null,
  };
}
async function generate<T>(options: {
  instructions: string;
  parts: InputPart[];
  schema: Record<string, unknown>;
  signal?: AbortSignal;
  onReceipt?: (r: AiReceipt) => void;
}): Promise<T> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new AiGatewayError(401, "ServiÃƒÆ’Ã‚Â§o Gemini nÃƒÆ’Ã‚Â£o configurado.");
  if (!/^[a-zA-Z0-9.-]{1,100}$/.test(MODEL))
    throw new AiGatewayError(400, "ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de modelo invÃƒÆ’Ã‚Â¡lida.");
  const parts = options.parts.map((p) => {
    if (p.type === "input_text") return { text: p.text };
    const data = p.type === "input_file" ? p.file_data : p.image_url;
    const match = /^data:(application\/pdf|image\/png|image\/jpeg);base64,([a-zA-Z0-9+/=]+)$/.exec(
      data,
    );
    if (!match) throw new AiGatewayError(400, "Formato de documento nÃƒÆ’Ã‚Â£o suportado.");
    return { inlineData: { mimeType: match[1], data: match[2] } };
  });
  let response: Response;
  try {
    response = await fetch(GEMINI_ENDPOINT + encodeURIComponent(MODEL) + ":generateContent", {
      method: "POST",
      redirect: "error",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(90000)])
        : AbortSignal.timeout(90000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.instructions }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16000,
          responseMimeType: "application/json",
          responseJsonSchema: options.schema,
        },
      }),
    });
  } catch {
    throw new AiGatewayError(503, "Falha de conexÃƒÆ’Ã‚Â£o com o Gemini.");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new AiGatewayError(
      response.status,
      "ServiÃƒÆ’Ã‚Â§o Gemini indisponÃƒÆ’Ã‚Â­vel para esta tentativa.",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new AiGatewayError(502, "Resposta Gemini ausente.");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > 2_000_000) throw new Error();
      text += decoder.decode(r.value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    await reader.cancel().catch(() => {});
    throw new AiGatewayError(502, "Resposta Gemini excedeu os limites ou foi interrompida.");
  }
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new AiGatewayError(502, "Resposta Gemini invÃƒÆ’Ã‚Â¡lida.");
  }
  options.onReceipt?.({
    response_id: typeof payload.responseId === "string" ? payload.responseId.slice(0, 200) : null,
    model_reported:
      typeof payload.modelVersion === "string" ? payload.modelVersion.slice(0, 200) : null,
    input_tokens: tokens(payload.usageMetadata?.promptTokenCount),
    output_tokens: tokens(payload.usageMetadata?.candidatesTokenCount),
    total_tokens: tokens(payload.usageMetadata?.totalTokenCount),
  });
  if (
    payload.promptFeedback?.blockReason ||
    payload.candidates?.length !== 1 ||
    payload.candidates[0]?.finishReason !== "STOP"
  )
    throw new AiGatewayError(
      422,
      "Leitura Gemini incompleta ou bloqueada. FaÃƒÆ’Ã‚Â§a a revisÃƒÆ’Ã‚Â£o manual.",
    );
  const content = payload.candidates[0]?.content?.parts;
  if (
    !Array.isArray(content) ||
    !content.length ||
    content.some((p: any) => typeof p.text !== "string" || p.thought)
  )
    throw new AiGatewayError(502, "ConteÃƒÆ’Ã‚Âºdo Gemini incompatÃƒÆ’Ã‚Â­vel.");
  try {
    return JSON.parse(content.map((p: any) => p.text).join("")) as T;
  } catch {
    throw new AiGatewayError(502, "RelatÃƒÆ’Ã‚Â³rio Gemini invÃƒÆ’Ã‚Â¡lido.");
  }
}

export async function availableGeminiModels() {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return [];
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
    headers: { "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!r.ok) {
    await r.body?.cancel();
    return [];
  }
  const data = await r.json();
  return (data.models ?? [])
    .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m: any) => m.name)
    .filter((s: unknown) => typeof s === "string" && /^models\/gemini-[a-zA-Z0-9.-]+$/.test(s))
    .slice(0, 50);
}
