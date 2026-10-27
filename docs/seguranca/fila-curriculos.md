# Fila persistente de currículos

Implementada na branch `ceny-versaonova` e no Supabase `wikerxujjvmoksrmjywo`. A `main` foi preservada. Esta etapa substitui a leitura síncrona descrita no histórico de envio de currículos.

## Comportamento

- Confirmar o armazenamento cria o trabalho na mesma transação. A leitura independe da página, da aba e da sessão de login. Arquivos ainda não recebidos precisam ser selecionados novamente; o servidor não consegue recuperar bytes que ficaram no computador.
- Cada lote guarda nomes, posições, recebimentos, recusas, cancelamentos e documentos associados. Envios não recebidos expiram após uma hora. O histórico mostra os últimos 20 lotes, sem apagar lotes anteriores do banco.
- O RH pode repetir somente leituras `failed`/`blocked`, individualmente ou por lote. Resultados concluídos ou em revisão só são reprocessados por ação explícita no candidato. Enviar bytes idênticos novamente reutiliza o documento e não inicia outra leitura.
- Trabalhos na fila ou no intervalo entre tentativas podem ser cancelados; uma tentativa já iniciada não é cancelável pela interface.
- Até **2 leituras simultâneas por empresa**, **3 tentativas por ciclo**, **120 segundos por tentativa** e **90 segundos para a chamada à IA**. Persistir a falha pode exigir até 30 segundos adicionais de comunicação com o banco. Retentativas usam intervalos de 1 e 5 minutos, além do intervalo do agendador.
- Rede, timeout, HTTP 429 e erros temporários do provedor recebem retentativa. Documento recusado ou resposta inválida vai para revisão do RH. Credenciais/créditos ausentes bloqueiam o trabalho até correção administrativa e repetição manual.
- Reservas de execução duram 4 minutos. Após reinício/interrupção, o agendador recupera reservas expiradas, respeitando o limite de tentativas e o intervalo. O token da tentativa antiga deixa de autorizar gravação.
- O detalhe do candidato mostra fase, ciclo de reprocessamento, tentativa, motivo e próximo horário de repetição. As consultas de fila ocorrem a cada 5 segundos; a lista de candidatos consulta a cada 8 segundos.

## Autorização e consistência

`resume_jobs`, `resume_job_attempts` e `resume_batch_entries` têm RLS. Usuários consultam somente dados da empresa autorizada; gestores de consulta não alteram trabalhos. Convites, remoções e papéis continuam nas regras anteriores. Entrada, execução e persistência revalidam a empresa, o papel e o arquivamento do candidato.

Bloqueios transacionais por empresa serializam aquisição, cancelamento e reprocessamento. Um índice parcial impede dois trabalhos ativos para o mesmo documento. Chaves compostas impedem que documento, candidato e empresa sejam misturados. Nenhum bloqueio do banco permanece aberto durante a chamada externa.

O endpoint `ceny-queue` autentica um token aleatório guardado no Vault, acessível apenas ao agendador e à verificação interna. A configuração e o disparo ficam no schema privado. Usuários não podem adquirir reservas, gravar resultados ou consultar a credencial. `ceny-worker` mantém autenticação de usuário para receber arquivos; a ação antiga `extract` apenas enfileira.

Se a confirmação do upload se perder, o original permanece vinculado e é conciliado depois. A limpeza ignora documentos que possuem trabalhos; isso evita apagar um original cuja confirmação já tenha sido gravada. A limpeza de armazenamento continua oportunística/manual e usa a API do Storage, não exclusão de metadados por SQL.

## Operação e limites

O job `ceny-resume-queue` roda a cada minuto com `pg_cron` e `pg_net`. Cada chamada adquire até 2 trabalhos, respeitando também a concorrência por empresa. O limite global por disparo mantém o consumo previsível, mas reduz a vazão em filas grandes.

O serviço requer `LOVABLE_API_KEY` válido e créditos do provedor. Sem eles, o histórico apresenta bloqueio de configuração; nenhuma configuração secreta foi inventada ou contratada. A verificação real da extração com o provedor depende dessa configuração.

Reservas e deduplicação evitam processamento simultâneo e duplicação por reenvio. Não se promete cobrança exatamente uma vez no provedor: uma resposta perdida após processamento externo pode resultar em outra cobrança na retentativa autorizada. O histórico preserva cada tentativa e o reprocessamento explícito.

## Verificação

- 37 testes de código: classificação de falhas, timeout, token expirado, autorização, extração validada, documentos hostis, autenticação e resumos de lote.
- 37 verificações SQL da fila: concorrência, isolamento, retentativas, cancelamento, recuperação, resultados tardios e revogação. Mais 28 verificações de recebimento, além das suítes anteriores de empresa e contas.
- TypeScript da aplicação, Deno das duas funções e build de produção verificados localmente.
- Integração descartável no GitHub testa envio/Storage reais, três aquisições concorrentes e execução por cron depois de logout, sem credencial de IA.
- Advisor de segurança: somente 4 avisos informativos de tabelas privadas intencionalmente fechadas, incluindo a configuração do agendador. [Descrição do aviso](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Referências: [agendamento de Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [limites Edge](https://supabase.com/docs/guides/functions/limits), [Vault](https://supabase.com/docs/guides/database/vault).
