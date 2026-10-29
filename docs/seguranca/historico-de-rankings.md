# Rankings completos, reproduzíveis e com histórico

Implementação na branch `ceny-versaonova`, usando exclusivamente o projeto Supabase `wikerxujjvmoksrmjywo`. A `main` permanece preservada.

## Comportamento

- Só recebem avaliação final candidatos com processamento `concluido` ou `revisao_manual` e revisão humana `completed`. Leitura falha, processamento incompleto e revisão pendente possuem motivos distintos, sem nota final.
- A tela separa pendências atuais das pendências registradas em cada avaliação histórica. Mostra data, critérios aprovados, dados usados, extração original da IA, correções humanas, versões, documentos identificados pelo hash e responsáveis registrados.
- O banco captura toda a base ativa da empresa numa única consulta. O servidor calcula páginas de 200 itens por chave estável, sem o limite implícito de 1.000 registros da API. Todas as páginas usam a mesma avaliação e os mesmos dados capturados.
- O resultado anterior permanece publicado durante o cálculo. Somente a conclusão completa troca as notas e publica o histórico, na mesma transação. Falhas de gravação desfazem a troca inteira.
- Há uma avaliação em andamento por vaga. Pedidos com o mesmo identificador e responsável reutilizam a tentativa, inclusive após a conclusão. Pedidos concorrentes diferentes são recusados. Repetir uma tentativa na tela reutiliza seu identificador; iniciar outro cálculo é uma ação separada.
- Antes de publicar, o banco reconfere autorização, aprovação e versão da vaga, composição da base, versões dos currículos e revisões e andamento das leituras. Uma mudança durante o cálculo impede a publicação e preserva o resultado anterior.
- Mudanças na base, na revisão ou na vaga sinalizam as avaliações como desatualizadas. A interface consulta esse estado, inclusive ao visualizar uma avaliação antiga.

## Persistência e acesso

`ranking_runs` guarda a solicitação, responsável, critérios aprovados, fórmula, contagens, estado e horários. `ranking_entries` guarda a fotografia de cada candidato, documentos, motivo de pendência ou pontuação com evidências. Os clientes só podem consultar por RLS; a escrita ocorre exclusivamente nas funções do servidor, com autorização revalidada.

As notas atuais em `candidate_scores` são uma projeção da última publicação. As fotografias anteriores não são sobrescritas. Arquivamento retira candidatos e vagas do acesso normal ao histórico; exclusão definitiva aplica as relações de exclusão do cadastro, sem criar uma cópia acessível de dados apagados. O histórico não é uma cópia de segurança permanente de arquivos originais: registra sua identificação e conteúdo extraído.

Tentativas sem atividade expiram após 15 minutos e não substituem o resultado publicado. Uma nova solicitação pode substituir uma tentativa expirada. O cálculo ainda é executado pela chamada do servidor, sujeito ao tempo máximo do ambiente; ultrapassar esse tempo não publica um ranking parcial. O mesmo pedido pode retomar uma tentativa ainda válida. O processamento de currículos continua usando a fila persistente já existente.

O antigo escritor de notas `replace_job_scores_v2` permanece disponível somente ao serviço para compatibilidade com verificações anteriores; a aplicação usa exclusivamente `begin_ranking`, `stage_ranking` e `finish_ranking`. Uma proteção adicional no banco impede o escritor anterior de inserir classificação de candidatos sem revisão concluída.

## Validação

- 20 verificações SQL executadas no Supabase novo em transação desfeita, sem manter contas ou candidatos de teste. Incluem 1.004 candidatos, 1.002 notas publicadas, concorrência lógica, autorização, repetição, mudanças de versão e falha provocada depois da exclusão das notas antigas para comprovar a reversão completa.
- Regressões de autorização, cálculo, arquivos e leitura; verificação de tipos, código do servidor e compilação da aplicação.
- Integração HTTP em Supabase descartável: pedidos simultâneos, repetição de pedido concluído, 1.201 candidatos elegíveis e duas pendências, além de conflito de revisão durante o cálculo. Resultados ficam nos artefatos do fluxo `Accounts and company isolation`.
- Nenhuma chamada real de IA nesta etapa, conforme a orientação do usuário.

O auditor de segurança não apontou novos problemas nas tabelas de ranking. Permanecem os avisos anteriores sobre tabelas privadas intencionalmente sem políticas de leitura e a [proteção de senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), fora do escopo desta etapa.
