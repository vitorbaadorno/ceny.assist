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
  const result = await generate<{ ok: boolean }>({
    onReceipt: (r) => {
      receipt = r;
    },
    instructions: "Return the requested JSON, no commentary.",
    parts: [{ type: "input_text", text: "Synthetic test. Return ok=true." }],
    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
  });
  return {
    ok: result.ok === true,
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
  if (!apiKey) throw new AiGatewayError(401, "ServiÃƒÂ§o Gemini nÃƒÂ£o configurado.");
  if (!/^[a-zA-Z0-9.-]{1,100}$/.test(MODEL))
    throw new AiGatewayError(400, "ConfiguraÃƒÂ§ÃƒÂ£o de modelo invÃƒÂ¡lida.");
  const parts = options.parts.map((p) => {
    if (p.type === "input_text") return { text: p.text };
    const data = p.type === "input_file" ? p.file_data : p.image_url;
    const match = /^data:(application\/pdf|image\/png|image\/jpeg);base64,([a-zA-Z0-9+/=]+)$/.exec(
      data,
    );
    if (!match) throw new AiGatewayError(400, "Formato de documento nÃƒÂ£o suportado.");
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
    throw new AiGatewayError(503, "Falha de conexÃƒÂ£o com o Gemini.");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new AiGatewayError(
      response.status,
      "ServiÃƒÂ§o Gemini indisponÃƒÂ­vel para esta tentativa.",
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
    throw new AiGatewayError(502, "Resposta Gemini invÃƒÂ¡lida.");
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
      "Leitura Gemini incompleta ou bloqueada. FaÃƒÂ§a a revisÃƒÂ£o manual.",
    );
  const content = payload.candidates[0]?.content?.parts;
  if (
    !Array.isArray(content) ||
    !content.length ||
    content.some((p: any) => typeof p.text !== "string" || p.thought)
  )
    throw new AiGatewayError(502, "ConteÃƒÂºdo Gemini incompatÃƒÂ­vel.");
  try {
    return JSON.parse(content.map((p: any) => p.text).join("")) as T;
  } catch {
    throw new AiGatewayError(502, "RelatÃƒÂ³rio Gemini invÃƒÂ¡lido.");
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
