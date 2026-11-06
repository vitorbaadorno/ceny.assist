# Privacidade e ciclo de vida dos dados

Etapa iniciada em 5 de novembro de 2026, na `ceny-versaonova`, exclusivamente no Supabase `wikerxujjvmoksrmjywo`. A `main` permanece preservada.

## Decisões explicitamente adiadas pelo responsável

Em 5/11/2026, o usuário pediu para registrar as duas perguntas de governança como pendências, sem defini-las nesta etapa:

| Pendência | Situação e efeito |
| --- | --- |
| Prazo de retenção dos currículos, versões, análises, resultados, relatórios, pedidos e auditoria | **Sem prazo aprovado.** Não há eliminação automática por idade. Não interpretar arquivamento como autorização para guarda ilimitada. |
| Responsáveis pelo tratamento, controlador/operadores, encarregado e apoio jurídico | **A definir.** O perfil técnico owner não comprova esses papéis jurídicos. |
| Finalidades, bases de tratamento, hipóteses de conservação e prazos legais dos pedidos | **Validação jurídica pendente.** A data de acompanhamento de um pedido é operacional. |
| Contrato/DPA e configuração efetiva do gateway/fornecedor de IA | **Pendente.** Não há alegação de retenção zero nem garantia de não treinamento específica para esta conta. |
| Política de backup, chaves, acessos, retenção e evidências de recuperação hospedada | **Pendente.** Não foi restaurado nem apagado um backup de produção. |
| Registro externo contínuo de eliminações e revogações | **Destino, frequência, monitoramento e custódia a definir.** O utilitário de manifesto não equivale a um serviço de replicação implantado. |

Não preencher essas lacunas com consentimento presumido, bases legais inventadas ou prazos arbitrários. Revalidar juridicamente as mensagens antes do uso operacional com titulares reais.

## Arquivar e eliminar

Arquivar oculta o cadastro e o original da equipe. Mantém dados, documentos, versões e histórico; invalida pontuações atuais e relatórios legados, conforme o comportamento anterior. Relatórios novos ficam inacessíveis quando qualquer cadastro incluído está arquivado. O ato agora também tem auditoria administrativa e usa o mesmo bloqueio transacional de outras operações da empresa.

Eliminar é uma operação separada, restrita a owner/admin, com prévia obtida do banco, confirmação do conjunto exato de identificadores e justificativa. Reuniões de cadastros formam um único conjunto: todos os registros conectados por `candidate_merges` entram no alcance, inclusive fontes arquivadas. Se esse conjunto mudar, a confirmação é rejeitada.

São removidos originais/versões, extrações/tentativas, revisões, notas, decisões, favoritos, vínculos, retratos nos rankings e os relatórios completos que incluam os cadastros. Os relatórios legados da empresa são invalidados por inteiro porque seu JSON não tem associação individual confiável. Contagens de rankings permanecem históricas e o ranking fica desatualizado. Busca usa dados atuais e deixa de retornar o candidato assim que a operação é solicitada.

Dados legados em quarentena sem identidade segura e relatórios legados com arquivo externo bloqueiam a solicitação, exigindo mapeamento administrativo prévio. Não se infere propriedade de arquivo ou pessoa. Notas livres de outros cadastros, arquivos já exportados e sistemas externos não podem ser localizados automaticamente por este fluxo.

O registro mínimo da operação conserva identificadores, ator, motivo, datas e estado; pedidos e justificativas de retenção também permanecem sob acesso administrativo. Esses registros ainda são dados pessoais ou pseudonimizados: sua base e prazo de guarda estão pendentes. Não incluir conteúdo do currículo nesses campos.

## Consistência e retomada

1. A solicitação trava a empresa, confere papéis atuais, retenções e alcance, guarda um manifesto privado de caminhos, oculta os candidatos e cancela reservas da fila. Envios/limpezas ainda ativos impedem iniciar. Uma análise já em execução tem sua reserva invalidada; a eliminação aguarda o prazo da reserva mais um minuto. Uma chamada já enviada ao fornecedor não pode ser recolhida.
2. O scheduler chama `claim_privacy_erasure`. A remoção relacional ocorre em uma única transação. Se falhar, ocorre rollback, persiste erro administrativo e nenhum caminho é entregue para remoção no Storage.
3. Somente após esse commit o worker remove os objetos pelo **Storage API**. A falha ou interrupção preserva manifesto, etapa e próxima tentativa. A lease expira em cinco minutos; os objetos ausentes podem ser removidos novamente sem recriar dados.
4. `finish_privacy_erasure` exige o token corrente e ausência dos objetos no catálogo antes de marcar `completed`. Falhas não são exibidas como conclusão. Os caminhos gerados (somente identificadores de objetos, sem conteúdo ou nome original) permanecem privados como tombstones de recuperação, inclusive após concluir.

O scheduler existente verifica a fila a cada minuto; tentativas com erro aguardam cinco minutos. A tela permite adiantar a retomada de arquivos pendentes, sem encurtar a espera de análises em voo. Falhas repetidas permanecem visíveis; monitoramento/alertas operacionais externos ainda precisam ser definidos. Não há transação distribuída entre PostgreSQL e Storage; a sequência e a recuperação persistente tratam essa separação.

RPCs privilegiadas de processamento são exclusivas de `service_role`. Comandos administrativos usam funções privadas com `search_path` vazio, autorização corrente e wrappers públicos invoker. Nenhuma chave de serviço vai para o navegador. Repetição de solicitação retorna a operação existente, inclusive concluída.

## Pedidos e retenções justificadas

“Privacidade e dados” lista registros ativos e arquivados, permite registrar consulta, correção, exportação e eliminação, verificar identidade por referência interna e concluir/recusar com justificativa. Controle de versão evita sobrescrever o tratamento concorrente. Um pedido de eliminação só pode ser concluído após a operação efetivamente terminar.

Consulta/correção usa a revisão do RH; exportação de acesso entrega JSON administrativo após verificação de identidade, incluindo os dados do candidato, documentos, revisões, decisões, notas e avaliações. O pacote exige revisão humana de terceiros e complemento de originais/itens eventualmente faltantes antes de entrega por canal autorizado. Não é um envio automático nem uma declaração de atendimento jurídico completo. O arquivo usa identificador de pedido, cabeçalhos `private, no-store` e não inclui chaves, caminhos Storage ou identificação dos autores das notas. Solicitações de exportação são auditadas, sem presumir que o dispositivo salvou o arquivo.

Retenções exigem justificativa, criador e data de revisão. Não expiram silenciosamente. A liberação exige nova justificativa e ator. Não é possível adicionar uma retenção depois de aceita uma eliminação irreversível. A tela e o banco restringem todos esses dados a owner/admin.

## IA e minimização

O gateway continua sendo `https://ai.gateway.lovable.dev/v1/responses`, modelo definido no código. `store:false` foi mantido, mas **não prova retenção zero de gateway, logs ou subprocessadores**.

O envio fica bloqueado enquanto `CENY_AI_PRIVACY_REVIEW_REFERENCE` estiver ausente. Esse secret só deve ser configurado após resolução documentada da pendência contratual; sua presença não é uma validação jurídica automática. Trabalhos ficam bloqueados para intervenção, sem novas cobranças automáticas. Nenhuma análise real foi autorizada nesta etapa.

DOCX é convertido localmente em texto. A preparação descarta cabeçalho de identificação anterior à seção profissional, contatos, links, números identificadores e linhas explicitamente pessoais/sensíveis, preservando posições dos parágrafos para conferir evidências. Nome original do arquivo, binário e imagem não são enviados. A regra é conservadora, pode omitir conteúdo útil e não garante anonimização; texto profissional pode ainda identificar pessoas. Cabe ao RH conferir o original. PDFs e imagens integrais não são enviados: permanecem em revisão manual até existir minimização apropriada. Não há um caminho automático que ignore esse bloqueio.

Documentação pública consultada em 5/11/2026: [Lovable Security](https://lovable.dev/security) descreve controles e condições por plano; [Lovable AI](https://docs.lovable.dev/features/ai) distingue o gateway usado pelo aplicativo do agente de construção. Falta comprovar plano, DPA aplicável, subprocessadores, regiões, retenção de logs/arquivos, exclusão e configuração efetiva da conta Ceny. As declarações públicas não substituem essa comprovação.

## Backup e restauração

O projeto consultado está em `us-west-2`. A documentação do [Supabase sobre backups](https://supabase.com/docs/guides/platform/backups) explica as janelas por plano e que backup de banco não contém os bytes dos objetos Storage. Não foi possível comprovar aqui o plano, as cópias existentes, custódia das chaves, controle de acesso a dumps externos nem a recuperação integral hospedada. Esses itens ficam pendentes, como solicitado.

Procedimento implementado em `scripts/privacy-recovery.mjs` e `scripts/privacy-ledger.mjs`:

1. Antes de qualquer incidente, exportar `export-ledger arquivo.json` usando credencial de serviço e `CENY_RECOVERY_SIGNING_KEY` independente (mínimo 32 caracteres), com `CENY_RECOVERY_SOURCE_PROJECT` correto. Guardar manifestos em destino externo protegido, fora do conjunto restaurado; manter a chave separada. O arquivo não substitui o backup dos dados e bytes.
2. Restaurar somente em ambiente isolado de aplicação, APIs públicas, Storage e workers. Suspender acessos na infraestrutura **antes** da restauração; nenhum código dentro de um backup antigo pode garantir isso por si só.
3. Aplicar todas as migrações atuais. Recuperar o manifesto externo mais recente, verificar integridade, origem e completude com a equipe responsável. Não liberar o ambiente se houver lacunas ou registro externo indisponível.
4. Executar `reconcile-restored arquivo.json` com destino restaurado e `CENY_RESTORE_ISOLATED=confirmed` somente após o isolamento real. O utilitário verifica HMAC/origem, retira **todos** os vínculos de acesso restaurados, revoga convites e códigos de recuperação e reenfileira os identificadores eliminados. Assim, não confia em concessões antigas que possam ter sido revogadas depois do backup.
5. Concluir a fila e remover os bytes restaurados. Verificar que os candidatos eliminados não aparecem nas tabelas, busca, relatórios ou Storage. Tokens antigos não autorizam acesso sem vínculo atual. Rotacionar credenciais/scheduler e revogar sessões conforme o procedimento de incidente.
6. Somente após conferência independente, aprovar novamente os acessos necessários e reabrir a infraestrutura. Cópias baixadas anteriormente não são revogadas por esse procedimento.

Garantia operacional contra ressurreição depende desse isolamento e de um manifesto externo completo. A infraestrutura de replicação contínua e o ensaio hospedado não foram implantados ou certificados nesta etapa. Testes com dados sintéticos cobrem retomada e reconciliação; registrar separadamente a futura evidência do ensaio de backup completo (banco, Storage, credenciais e acesso), com RPO/RTO aprovados.

## Evidências da entrega — 6 de novembro de 2026

- Código validado: `4fa853017468c095f54817ccdbf5f24596776fba`, após implementação inicial `06e5b56`. [CI concluída com sucesso](https://github.com/vitorbaadorno/ceny.assist/actions/runs/42192062094).
- 131 testes unitários, 12 de renderização, TypeScript, lint dos novos arquivos de aplicação e build aprovados. Os testes anteriores de contas, isolamento, revisão concorrente, documentos, vagas, rankings e relatórios também passaram.
- 49 verificações SQL de privacidade em transação com rollback no Supabase descartável da CI: papéis, identidade, retenção, idempotência, revogação da reserva da análise, falha de banco, falha de Storage, leases vencidas e reconciliação de restauração. A simulação SQL usa somente metadados sintéticos; não executá-la como manutenção de Storage em produção.
- Teste separado com Storage API real no ambiente descartável: backup lógico de registro e cópia de bytes sintéticos, eliminação, restauração isolada, remoção dos vínculos de acesso, rejeição do token antigo e nova eliminação. Incluiu uma versão de arquivo ausente do backup antigo do banco, removida a partir do manifesto externo assinado. O resultado está no artefato `privacy-recovery-results.json` da CI. Isso não certifica backup hospedado de produção.
- Interface real conferida em navegador com serviços simulados: seleção de cadastro, alcance apresentado, confirmação obrigatória, andamento e bloqueio do gestor. Nenhum pedido real de titular foi criado e nenhum dado real foi eliminado.
- Migrações aplicadas no Supabase novo: `20261105231446_privacy_lifecycle`, `20261105232501_privacy_recovery_controls` e `20261105235911_privacy_restore_object_manifest`. `ceny-queue` versão 5 e `ceny-worker` versão 14 publicadas. Ambas rejeitaram chamadas sem autenticação com HTTP 401.
- Nenhuma chamada real ao fornecedor de IA. O frontend está na branch e ainda depende do fluxo de publicação do projeto; esta etapa não publicou um novo site público.
- Advisors: nenhum novo alerta de segurança além do registro informativo da tabela privada de manifestos intencionalmente sem políticas para clientes. A [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) continua desativada, como já registrado. O relatório de desempenho ainda indica dois índices de FKs anteriores ausentes (`resume_documents` e `resume_jobs`); não são bloqueios desta entrega.
