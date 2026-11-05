import { AiGatewayError, readAiStream, type AiReceipt } from "./ai-stream.ts";
import { requireAiPrivacyReview } from "./ai-privacy.ts";
export { AiGatewayError } from "./ai-stream.ts";
// Server-only helper for Lovable AI Gateway (Responses API).
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
export const MODEL = "openai/gpt-6-astra";

export type InputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "high" }
  | { type: "input_file"; filename: string; file_data: string };

/**
 * Calls the gateway with a strict JSON schema and returns the parsed object.
 * Always streams (required for reasoning models) and accumulates the output.
 */
export async function callAiJson<T>(options: {
  instructions: string;
  parts: InputPart[];
  schemaName: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  signal?: AbortSignal;
  onReceipt?: (receipt: AiReceipt) => void;
}): Promise<T> {
  requireAiPrivacyReview(Deno.env.get("CENY_AI_PRIVACY_REVIEW_REFERENCE"));
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new AiGatewayError(401, "Serviço de IA não configurado.");

  const response = await fetch(GATEWAY_URL, {
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(90000)])
      : AbortSignal.timeout(90000),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      stream: true,
      instructions: options.instructions,
      input: [{ role: "user", content: options.parts }],
      reasoning: { effort: options.effort ?? "low" },
      text: {
        format: {
          type: "json_schema",
          name: options.schemaName,
          strict: true,
          schema: options.schema,
        },
      },
    }),
  });

  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {});
    throw new AiGatewayError(
      response.status,
      response.status === 429
        ? "Muitas solicitações à IA no momento. Tente novamente em instantes."
        : response.status === 402
          ? "Os créditos de IA acabaram. Adicione créditos para continuar."
          : `Falha na leitura por IA (${response.status}).`,
    );
  }

  const result = await readAiStream(response.body, options.onReceipt);
  return result.value as T;
}
