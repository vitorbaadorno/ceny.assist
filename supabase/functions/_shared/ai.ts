// Server-only helper for Lovable AI Gateway (Responses API).
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export type InputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | { type: "input_file"; filename: string; file_data: string };

export class AiGatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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
}): Promise<T> {
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

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (buffer.length > 1_000_000 || text.length > 1_000_000) {
      await reader.cancel();
      throw new AiGatewayError(502, "Resposta da IA excedeu o limite.");
    }
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        } else if (event.type === "response.completed" && event.response?.output_text) {
          if (!text) text = event.response.output_text;
        }
      } catch {
        // ignore malformed keep-alive chunks
      }
    }
  }

  if (!text.trim()) {
    throw new AiGatewayError(502, "A IA não retornou dados legíveis do currículo.");
  }

  return JSON.parse(text) as T;
}
