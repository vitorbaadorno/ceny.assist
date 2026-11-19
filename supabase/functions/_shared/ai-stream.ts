export class AiGatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AiGatewayError";
  }
}
export type AiReceipt = {
  response_id: string | null;
  model_reported: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
};
const count = (n: unknown) =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
type StreamResponse = {
  id?: unknown;
  model?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown; total_tokens?: unknown };
  status?: unknown;
  error?: unknown;
  incomplete_details?: unknown;
  output_text?: unknown;
  output?: {
    type?: unknown;
    status?: unknown;
    role?: unknown;
    content?: { type?: unknown; text?: unknown }[];
  }[];
};
export function receiptOf(response: StreamResponse | null | undefined): AiReceipt {
  return {
    response_id: typeof response?.id === "string" ? response.id.slice(0, 200) : null,
    model_reported: typeof response?.model === "string" ? response.model.slice(0, 200) : null,
    input_tokens: count(response?.usage?.input_tokens),
    output_tokens: count(response?.usage?.output_tokens),
    total_tokens: count(response?.usage?.total_tokens),
  };
}

// SSE is framed by blank lines, not network chunks. Never accept partial JSON merely
// because it happens to be syntactically complete before the terminal event arrives.
export async function readAiStream(
  body: ReadableStream<Uint8Array>,
  onReceipt?: (receipt: AiReceipt) => void,
) {
  const reader = body.getReader(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "",
    output = "",
    completed = false,
    bytes = 0,
    events = 0;
  let receipt: AiReceipt = receiptOf(null);
  const invalid = () =>
    new AiGatewayError(502, "A resposta da leitura foi interrompida ou inválida. Tente novamente.");
  const consume = (frame: string) => {
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) return;
    if (++events > 10000) throw invalid();
    if (data === "[DONE]") {
      if (!completed) throw invalid();
      return;
    }
    let event: { type?: unknown; delta?: unknown; response?: StreamResponse };
    try {
      event = JSON.parse(data);
    } catch {
      throw invalid();
    }
    if (!event || typeof event.type !== "string") throw invalid();
    if (
      ["response.failed", "response.incomplete", "response.error", "error"].includes(event.type)
    ) {
      if (event.response) onReceipt?.(receiptOf(event.response));
      throw new AiGatewayError(
        502,
        "O serviço não concluiu a leitura. A tentativa será tratada como falha.",
      );
    }
    if (event.type.includes("refusal"))
      throw new AiGatewayError(
        422,
        "O serviço recusou a leitura. O RH precisa conferir o documento.",
      );
    if (event.type === "response.output_text.delta") {
      if (completed || typeof event.delta !== "string") throw invalid();
      output += event.delta;
      if (output.length > 1_000_000) throw invalid();
    }
    if (event.type === "response.completed") {
      const response = event.response;
      if (
        completed ||
        response?.status !== "completed" ||
        response.error ||
        response.incomplete_details
      )
        throw invalid();
      receipt = receiptOf(response);
      onReceipt?.(receipt);
      let finalText = "";
      if (Array.isArray(response.output)) {
        for (const item of response.output) {
          if (item.type === "reasoning") continue;
          if (
            item.type !== "message" ||
            item.status !== "completed" ||
            item.role !== "assistant" ||
            !Array.isArray(item.content)
          )
            throw invalid();
          for (const part of item.content) {
            if (part.type !== "output_text" || typeof part.text !== "string") throw invalid();
            finalText += part.text;
          }
        }
      } else if (typeof response.output_text === "string") finalText = response.output_text;
      if (!finalText.trim() || finalText.length > 1_000_000 || (output && output !== finalText))
        throw invalid();
      output = finalText;
      completed = true;
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      bytes += value.byteLength;
      if (bytes > 2_000_000) throw invalid();
      buffer += decoder.decode(value, { stream: true });
      // Keep a trailing CR until the next chunk to support split CRLF boundaries.
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
    }
    if (buffer.trim() || !completed || !output.trim()) throw invalid();
    let value: unknown;
    try {
      value = JSON.parse(output);
    } catch {
      throw invalid();
    }
    return { value, receipt };
  } catch (error) {
    if (
      error instanceof AiGatewayError ||
      (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))
    )
      throw error;
    throw invalid();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
