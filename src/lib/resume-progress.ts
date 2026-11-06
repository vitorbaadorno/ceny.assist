export type UploadState =
  "aguardando" | "enviando" | "enviado" | "lendo" | "ok" | "revisao" | "erro" | "desconhecido";
export function documentState(state: string): UploadState {
  return (
    (
      {
        receiving: "enviando",
        uploaded: "enviado",
        reading: "lendo",
        completed: "ok",
        concluido: "ok",
        review: "revisao",
        revisao_manual: "revisao",
        error: "erro",
        erro: "erro",
        cleaning: "erro",
      } as Record<string, UploadState>
    )[state] ?? "desconhecido"
  );
}
export function uploadSummary(items: { state: UploadState; duplicate?: boolean }[]) {
  return {
    completed: items.filter((i) => i.state === "ok").length,
    unknown: items.filter((i) => i.state === "desconhecido").length,
    review: items.filter((i) => i.state === "revisao").length,
    failed: items.filter((i) => i.state === "erro").length,
    pending: items.filter((i) => ["aguardando", "enviando", "enviado", "lendo"].includes(i.state))
      .length,
    duplicates: items.filter((i) => i.duplicate).length,
  };
}
