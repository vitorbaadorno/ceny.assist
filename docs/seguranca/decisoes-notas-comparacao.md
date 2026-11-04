# Decisões por vaga, notas internas, favoritos e comparação

Implementado em `ceny-versaonova`, exclusivamente no Supabase `wikerxujjvmoksrmjywo`. A `main` permanece preservada.

## Decisões e listas

Cada vínculo pessoa/vaga possui situação própria: não decidido, em análise, aprovado, não aprovado ou contratado. A mesma pessoa pode ter decisões diferentes nas vagas. A seleção para a lista da vaga é independente de aprovação e de favoritos pessoais. O RH filtra toda a lista por seleção ou situação, com contagem completa e páginas de 20.

Salvar uma alteração exige justificativa de 5 a 2000 caracteres, acesso de proprietário/administrador/RH, vínculo ativo, candidato disponível e vaga aberta. O banco registra autor identificado, nome do autor na ocasião, data, situação e seleção anteriores e novas. O histórico é consultável na vaga e no cadastro da pessoa. Uma versão esperada impede a sobrescrita concorrente; a chave de solicitação impede duplicação em tentativas repetidas.

Retirar e reativar um vínculo não apaga decisões ou notas. A opção de exibir vínculos retirados permite consultar o histórico. Vagas encerradas mantêm consulta e notas, mas exigem reabertura para novas decisões.

O antigo status geral foi preservado como registro anterior, sem atribuí-lo automaticamente às vagas. Sua edição foi retirada da tela e recusada pela API de revisão. Decisões e notas não alteram a pontuação calculada por IA.

## Notas e favoritos

As notas gerais ficam no cadastro da pessoa. Notas específicas de uma vaga ficam no respectivo vínculo. Cada nota é acrescentada com autoria, data e texto próprio; não há substituição ou exclusão pela API do navegador. Uma correção é outra nota, identificando o que corrige. A interface informa quando está salvando, confirma o sucesso ou apresenta uma falha sem expor detalhes internos.

As observações antigas permanecem identificadas como anteriores, com acesso ao histórico de revisão existente. Não foi inventada autoria ou data para os valores antigos sem procedência confirmada.

Favoritos são pessoais dentro da empresa: outra pessoa não consegue consultar seus favoritos. Podem ser marcados na lista, no detalhe e na busca do acervo. O filtro “Meus favoritos” considera a base completa. Também é permitido ao gestor salvar favoritos pessoais, sem conceder edição de candidatos, avaliações, notas ou decisões.

Ao reunir cadastros após confirmação administrativa, notas e decisões anteriores são preservadas na auditoria da união. Não substituem decisões da pessoa de destino. A tela explica que as decisões precisam ser conferidas novamente.

## Comparação e controle de acesso

A comparação aceita de 2 a 4 pessoas autorizadas, escolhidas nos vínculos da vaga ou no acervo. Uma única consulta retorna a mesma avaliação publicada para todas as colunas. As linhas usam os mesmos critérios, pesos e obrigatoriedades daquela avaliação. Trechos de evidência ficam disponíveis junto às conclusões.

São mostrados dados não informados, leitura/revisão pendente, ausência de avaliação e desatualização por mudanças no currículo, revisão, original ou vaga. Resultados históricos permanecem identificados como históricos. Os dados profissionais exibidos junto à nota são os do retrato avaliado, não substituídos silenciosamente pelos dados atuais. Sem avaliação, o cadastro atual aparece sem pontuação presumida. Nome identifica as colunas; características pessoais sensíveis não são adicionadas à comparação.

Gestores com vínculo autorizado na empresa consultam candidatos, avaliações, notas e históricos. Não podem escrever notas nem alterar decisões. As políticas RLS e os comandos privados verificam o vínculo da empresa também no acesso direto; retirar a permissão bloqueia consultas e comandos, mesmo com um JWT anterior. Outra empresa não acessa os dados nem os favoritos. Novas tabelas possuem RLS e não concedem escrita direta ao navegador.

## Validação desta etapa

- 40 testes SQL no banco novo, em transação revertida: decisões independentes, histórico, justificativas, concorrência, repetição, isolamento das notas, escrita direta bloqueada, retirada/reativação, união de cadastros, favoritos privados, comparação, gestores e revogação.
- 58 verificações da suíte geral de isolamento passaram no banco novo. O teste antigo de substituição de observação foi atualizado para conferir a correção de dados profissionais e o acréscimo de notas com autoria; gestores continuam impedidos de executar ambos os comandos.
- 115 testes unitários, incluindo 5 novos sobre critérios idênticos, dados ausentes, revisão pendente, retratos históricos e desatualização.
- 6 testes de renderização dos componentes reais, com 27 verificações de conteúdo e permissões dos controles (`bun run test:interface`). Eles não substituem a inspeção visual nem interações no navegador.
- TypeScript, compilação de produção e verificação das Edge Functions com Deno.
- A inspeção visual desta etapa ficou pendente: tanto o navegador integrado quanto o controle do computador falharam ao inicializar o ambiente de automação (“failed to write kernel assets”). A prévia local usa apenas dados fictícios e não altera o banco.
- Nenhum teste real de IA foi executado, conforme a orientação anterior.

Supabase Advisors não apontou novos alertas desta alteração. Permanecem os avisos anteriores de tabelas privadas com RLS sem políticas e proteção de senhas vazadas desativada. [Orientação sobre proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Migração aplicada: `20261030130227_job_candidate_collaboration`.

## Integração concluída em 4 de novembro de 2026

A [execução completa no GitHub Actions](https://github.com/vitorbaadorno/ceny.assist/actions/runs/41904564350), no commit `f9f42bcfb557e453e14117ec23cd60977394314c`, terminou com sucesso. O ambiente descartável recriou o banco pelas migrações e passou pelas suítes SQL (incluindo colaboração), arquivos e Storage, cadastro/confirmação/login/recuperação/links expirados, revisão concorrente, preservação das correções humanas, governança de vagas, rankings e compilação de produção. Os 115 testes unitários e 6 testes de renderização também passaram nessa execução. A verificação de preservação das correções usa resultados simulados, sem chamada real de IA.

O teste de isolamento anterior ainda tentava substituir `observacoes` pela API de revisão e foi corrigido para os comandos atuais, sem flexibilizar as permissões. A `main` remota permaneceu em `58df482099e187f25ef2c154789321df8b0b1815`.
