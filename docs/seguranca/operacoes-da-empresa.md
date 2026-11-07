# Configurações e operações da empresa

Proprietários e administradores consultam o histórico, conciliam valores e administram limites. As regras de convites, remoção e transferência de responsabilidade continuam na gestão de membros. Cada consulta administrativa verifica a associação no banco. Os demais membros recebem o aviso de uso da empresa em que trabalham.

## Cotas e consumo

Os limites mensais usam UTC. Vazio permite uso ilimitado, zero bloqueia, e o aviso começa em 80% por padrão. Uma transação reserva a entrada do documento e a primeira geração de análise sob um bloqueio por empresa. Confirmar o envio aproveita essa reserva. Se a limpeza descartar uma reserva que nunca recebeu arquivo nem trabalho, devolve as unidades. Remover um original já aceito mantém o consumo ocorrido. Reprocessar gera outra unidade quando cria uma geração. Repetir uma solicitação identificada ou retomar tentativas automáticas da mesma geração preserva a contagem.

A competência usa a data de recebimento para enviados, a data da recusa para posições de lote recusadas e o início da tentativa para os resultados e tempos. Currículos concluídos e encaminhados para revisão são distintos dentro de cada grupo. Um currículo pode ter dois desfechos após reprocessamento. O histórico anterior só contribui com medições ainda existentes no momento da migração.

## Conciliação de custos

Na seção Consumo, selecione o mês UTC e abra uma análise. Registre em USD o valor efetivamente atribuído pelo fornecedor a cada tentativa concluída. Confira inclusive tentativas com erro. Uma tentativa gratuita pode receber zero confirmado. Falta de recibo, tokens ou preço exige conciliação e nunca autoriza presumir gratuidade.

Após o fim do mês, registre somente a parte da fatura correspondente ao armazenamento dos currículos dessa empresa. O rateio usa bytes multiplicados por segundos de permanência no mês. Cada documento distribui sua parcela igualmente entre as análises já criadas até o fim da competência. Armazenamento de documentos sem análise aparece como saldo sem associação. O total mensal da análise soma as tentativas do mês e essa parcela. Valores medidos e valores faturados usam campos distintos. O produto ainda não emite cobrança comercial.

## Histórico operacional

Atividades ficam inicialmente 90 dias e erros 30 dias. O administrador pode configurar de 1 a 730 dias para atividades e de 1 a 365 dias para erros. A limpeza roda diariamente às 03h19 UTC e alcança eventos já registrados. Essas regras valem para o histórico operacional desta área. A política de retenção dos currículos e os registros de origem seguem a governança de privacidade do projeto.

O banco registra efeitos confirmados, o ator conhecido, a empresa, a referência da operação e a data. As tentativas de processamento também registram seu número. Erros de transporte enviados pelo aplicativo são diagnósticos declarados pelo cliente. Só entram no histórico mediante verificação da associação do usuário com a empresa. O diagnóstico contém categorias fechadas e identificadores, sem anexos, mensagens de exceção, parâmetros, URLs, senhas ou cabeçalhos. Falhas anteriores à identificação da empresa e falhas offline podem gerar apenas um identificador técnico local. O novo histórico inicia na implantação.
