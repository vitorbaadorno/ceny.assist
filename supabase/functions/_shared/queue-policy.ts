export type FailureKind = "transient" | "permanent" | "configuration" | "authorization";
export function classifyFailure(error: unknown): { kind: FailureKind; message: string } {
  const e = (error ?? {}) as { name?: string; status?: number; message?: string };
  if (e.name === "FileRejected")
    return {
      kind: "permanent",
      message: e.message ?? "Arquivo incompatível. O RH precisa revisar o original.",
    };
  if (e.name === "AuthorizationError")
    return { kind: "authorization", message: "Acesso retirado ou candidato arquivado." };
  if (e.status && [401, 402, 403].includes(e.status))
    return {
      kind: "configuration",
      message:
        "A leitura está bloqueada pela configuração ou pelos créditos da IA. Solicite ao administrador e repita somente este trabalho.",
    };
  if (e.status && e.status >= 400 && e.status < 500 && ![408, 409, 425, 429].includes(e.status))
    return {
      kind: "permanent",
      message: "O provedor recusou o documento. O RH precisa revisar ou substituir o original.",
    };
  if (e.name === "ZodError" || e.name === "SyntaxError")
    return {
      kind: "permanent",
      message: "A IA retornou dados inválidos. É necessária conferência do RH.",
    };
  return {
    kind: "transient",
    message:
      e.name === "TimeoutError" || e.name === "AbortError"
        ? "A tentativa atingiu o tempo máximo."
        : "Serviço temporariamente indisponível.",
  };
}
