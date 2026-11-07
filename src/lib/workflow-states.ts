export const candidateStates = {
  novo: "Novo",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  contratado: "Contratado",
};
export const vacancyStates: Record<string, string> = {
  aberta: "Aberta",
  encerrada: "Encerrada",
  indefinida: "A conferir",
};
export const processingStates = {
  processando: "Processando",
  concluido: "Dados extraídos",
  revisao_manual: "Revisão manual",
  erro: "Erro na leitura",
};
export const documentInProgress = (doc: { state: string }) =>
  ["receiving", "uploaded", "reading", "cleaning"].includes(doc.state);
export const jobLabels: Record<string, string> = {
  queued: "Na fila",
  running: "Em leitura",
  retry_wait: "Aguardando nova tentativa",
  succeeded: "Concluído",
  review: "Revisão do RH necessária",
  failed: "Tentativas esgotadas",
  blocked: "Configuração necessária",
  cancelled: "Cancelado",
};
export const phaseLabels: Record<string, string> = {
  downloading: "Obtendo original",
  validating: "Conferindo documento",
  reading: "Extraindo informações",
  saving: "Salvando resultado",
};
export const isActiveJob = (job?: { state: string } | null) =>
  !!job && ["queued", "running", "retry_wait"].includes(job.state);
