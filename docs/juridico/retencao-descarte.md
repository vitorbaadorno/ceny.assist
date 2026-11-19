# Política Interna de Retenção e Descarte

**MINUTA — NÃO VALIDADA JURIDICAMENTE**

Versão: 0.1 · Data: 18/11/2026 · Publicação/vigência: PENDENTE_VALIDACAO

## Aprovação por categoria
Candidatos/originais/versões; extrações/avaliações/notas; relatórios/exportações; contas e associações; convites; pedidos de titulares; auditoria; tombstones; backups e manifestos: prazo, fundamento, responsável, gatilho e revisão são PENDENTE_VALIDACAO para cada categoria.

## Execução técnica
Reusar scripts/run-retention.mjs e o procedimento de docs/seguranca/governanca-lancamento.md. Simulação é o padrão. A execução exige política aprovada e autorização operacional; não existe cron novo nesta entrega. Retenções justificadas bloqueiam eliminação até decisão documentada.

## Eliminação e recuperação
A saga remove dados relacionais e depois objetos, com retomada de falhas. Só concluir após confirmação. Manifestos de eliminações/revogações precisam ficar fora do conjunto restaurado. Após restauração isolada, reconciliar tombstones e acessos antes da reabertura. Backups não são apagados instantaneamente por pedido individual.

## Encerramento e inatividade
Receber solicitação, conferir contrato/identidade/autoridade, definir conjunto e retenções, oferecer devolução autorizada, revogar acessos e executar descarte aprovado. Prazos, tratamento de conta compartilhada entre empresas e prova de encerramento: PENDENTE_VALIDACAO. Arquivamento não resolve anonimização nem autoriza guarda indefinida.

Validação por profissional habilitado e responsável pela aprovação: PENDENTE_VALIDACAO.
