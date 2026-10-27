# Revisão humana dos currículos

Etapa de 27/10/2026 na branch `ceny-versaonova`, no Supabase `wikerxujjvmoksrmjywo`. A `main` permanece preservada.

## Uso

No detalhe do candidato, a seção **Revisão do currículo** permite corrigir nome, e-mail, telefone, cidade/localização, nascimento, formação, experiências, períodos, competências, idiomas e certificações. Cidade é texto livre: salvar não depende de mapas nem de sugestões externas. Status no funil e observações também usam o salvamento com controle de versão.

Listas de formação e trabalho possuem ações para adicionar e remover itens. Editar períodos recalcula a união dos meses de trabalho, sem somar sobreposições. Datas com apenas o ano são aceitas, mas não geram um total definitivo. O RH pode informar o tempo total manualmente, entre zero e cem anos. Ausência continua sendo ausência, não zero.

O formulário mostra campos a conferir e os motivos apontados pela leitura, alterações pendentes, salvamento em andamento, sucesso ou falha. A saída por fechamento/recarregamento da página com rascunho dispara o aviso do navegador; o rascunho não é armazenado no dispositivo e não sobrevive à saída. Salve antes de navegar ou trocar de empresa.

**Concluir revisão** exige confirmação explícita de que o original e os campos pendentes foram conferidos. A ação registra responsável e data, além das alterações. Não transforma ausência de informação em dado inventado e não altera o estado técnico da leitura da IA. Uma nova leitura reabre a conferência, mantendo as correções e as confirmações anteriores.

O original pode ser aberto ao lado do formulário (PDF/imagem) ou em outra aba. DOCX deve ser aberto no editor de documentos do usuário. O acesso continua usando autorização do servidor e link de 60 segundos; é possível renovar o acesso na tela. Não há edição do arquivo original.

## Dados, histórico e concorrência

- `dados_extraidos` guarda a última extração da IA, enquanto as tentativas preservam extrações anteriores. `correcoes_rh` contém as substituições humanas e `dados_efetivos` reúne a informação usada no cadastro e nas avaliações. O original continua no Storage privado.
- Ao salvar um rascunho, apenas campos alterados são protegidos. Ao concluir a revisão, todos os campos revisáveis ficam confirmados, incluindo valores nulos e listas vazias. Corrigir uma lista protege a lista inteira nas leituras seguintes. Resumos, projetos e evidências da IA continuam identificados como parte da extração, não como correções humanas.
- Valores antigos que diferiam da extração foram preservados como base histórica, sem atribuir um revisor desconhecido. Eles aparecem como valores anteriores, com responsável não confirmado.
- `candidate_revisions` registra ator, nome de identificação, horário do servidor, versão, ação e valores antes/depois. A consulta é paginada. RLS limita o histórico à empresa autorizada e a candidatos não arquivados; clientes não podem alterar ou apagar esse histórico.
- `save_candidate_review` valida campos e permissões dentro da transação, bloqueia a empresa/candidato e compara a versão esperada. A API pública usa `security invoker`; o escritor privilegiado fica no schema privado e confere o usuário e o papel. A edição direta das antigas colunas foi revogada para impedir contornar histórico e versão.
- Se outra pessoa ou uma nova leitura modificar o registro, salvar com a versão antiga resulta em conflito. O rascunho permanece na tela, com comparação dos campos alterados. Carregar a versão atual exige descartar explicitamente o rascunho; não há sobrescrita forçada ou mesclagem silenciosa.
- Uma mudança nos dados efetivos marca avaliações e relatórios anteriores como desatualizados. O ranking exibe esse aviso. O cálculo usa os dados corrigidos pelo RH e envia a versão lida; o banco recusa a gravação se uma correção ocorrer durante o cálculo. Resultados sem versão, produzidos por clientes antigos do serviço, permanecem marcados como desatualizados.

## Verificação

- 29 verificações SQL da revisão passaram no banco novo dentro de uma transação revertida, cobrindo autorização, validação, histórico, conflito, conclusão, reprocessamento, nulidade confirmada e avaliações desatualizadas.
- TypeScript, build de produção e Deno da função atualizada passaram localmente. A suíte de código também passou.
- O teste `tests/isolated-reviews.mjs` executa duas gravações simultâneas, preservação de correções após uma extração sintética e retirada de acesso, no Supabase descartável do CI. Não chama o provedor de IA.
- Migration aplicada: `20261027172744_candidate_human_review.sql`. Função publicada: `ceny-worker` versão 6. A fila existente utiliza as novas regras de persistência do banco.
- A criação de uma conta temporária para teste visual no Supabase remoto foi bloqueada pela revisão automática, por criar dados persistentes e credenciais. Essa operação não foi executada. Os testes de gravação usam transação revertida ou ambiente descartável.
- O advisor não apontou novos problemas de segurança. Permanecem os quatro avisos informativos das tabelas privadas fechadas e o aviso preexistente de [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Referência: [RLS e privilégios do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security). A avaliação de precisão com IA real continua adiada conforme a orientação anterior do usuário.
