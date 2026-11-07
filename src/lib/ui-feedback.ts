import { processingStates } from "./workflow-states.ts";
export type ErrorKind =
  "session" | "permission" | "missing" | "connection" | "conflict" | "limit" | "unknown";
export function errorFeedback(error: unknown, fallback = "Não foi possível concluir a operação.") {
  const value = (error ?? {}) as {
    code?: string;
    status?: number;
    statusCode?: number | string;
    context?: { status?: number };
    name?: string;
    message?: string;
  };
  if (value.code === "INVALID_RESPONSE")
    return {
      kind: "unknown" as const,
      message:
        "O serviço retornou dados incompatíveis. Atualize a consulta ou consulte o responsável pela empresa.",
      retryable: true,
    };
  const rawStatus = value.status ?? value.statusCode ?? value.context?.status;
  const status = rawStatus === undefined ? undefined : Number(rawStatus);
  const message = value.message ?? "";
  let kind: ErrorKind = "unknown";
  if (
    status === 401 ||
    [
      "PGRST301",
      "PGRST302",
      "PGRST303",
      "session_not_found",
      "refresh_token_not_found",
      "refresh_token_already_used",
      "bad_jwt",
    ].includes(value.code ?? "") ||
    /jwt expired|invalid jwt|sessão (expirou|expirada|indisponível)|unauthorized|auth session missing/i.test(
      message,
    )
  )
    kind = "session";
  else if (
    status === 403 ||
    value.code === "42501" ||
    /permission denied|row-level security|sem permissão|não tem permissão|acesso (retirado|revogado)/i.test(
      message,
    )
  )
    kind = "permission";
  else if (
    status === 404 ||
    value.code === "PGRST116" ||
    /registro não encontrado|currículo indisponível|documento indisponível/i.test(message)
  )
    kind = "missing";
  else if (["P5401", "P5402"].includes(value.code ?? "")) kind = "limit";
  else if (value.code === "40001") kind = "conflict";
  else if (
    status === 0 ||
    (status !== undefined && status >= 500) ||
    ["TimeoutError", "AuthRetryableFetchError", "FunctionsFetchError"].includes(value.name ?? "") ||
    /failed to fetch|fetch failed|network|load failed|timeout|tempo limite|falha de conexão/i.test(
      message,
    )
  )
    kind = "connection";
  const messages: Record<ErrorKind, string> = {
    session: "Sua sessão expirou ou não é mais válida. Entre novamente para continuar.",
    permission:
      "Você não tem permissão para esta operação na empresa selecionada. Solicite acesso ao responsável.",
    missing:
      "Registro não encontrado ou indisponível para seu acesso. Ele pode ter sido arquivado ou eliminado.",
    connection: "Falha de conexão com o serviço. Confira sua internet e tente novamente.",
    conflict:
      "O registro mudou desde a última consulta. Confira a versão atual antes de salvar novamente.",
    limit:
      value.code === "P5401"
        ? "Limite mensal de envios da empresa atingido."
        : "Limite mensal de análises da empresa atingido.",
    unknown: fallback,
  };
  return { kind, message: messages[kind], retryable: kind === "connection" || kind === "unknown" };
}
export const retryQuery = (failures: number, error: unknown) =>
  failures < 1 && errorFeedback(error).retryable;

export function processingLabel(status: string | null | undefined) {
  switch (status) {
    case "processando":
      return { label: processingStates.processando, variant: "secondary" as const };
    case "revisao_manual":
      return { label: processingStates.revisao_manual, variant: "outline" as const };
    case "erro":
      return { label: processingStates.erro, variant: "destructive" as const };
    case "concluido":
      return { label: processingStates.concluido, variant: "default" as const };
    default:
      return { label: "Situação da leitura não confirmada", variant: "outline" as const };
  }
}
export function displayDate(value: string | null | undefined) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data inválida — conferir registro"
    : date.toLocaleString("pt-BR");
}
// A null/malformed RPC result is not evidence that a save was confirmed.
export function requireSavedId(value: unknown) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(
      "O serviço não confirmou o salvamento. Confira o histórico antes de tentar novamente.",
    );
  return value;
}
