# Buscas, filtros e paginação por empresa

Implementado na `ceny-versaonova`, preservando a `main`. Banco exclusivo: `wikerxujjvmoksrmjywo`.

## Comportamento

- Candidatos, vagas, busca do acervo e ranking aplicam filtros no banco antes de limitar a página a 25 itens. Total da base, total encontrado e quantidade exibida são retornados pela mesma consulta. Páginas fora do intervalo voltam à última disponível.
- As consultas usam os privilégios do solicitante e as políticas RLS existentes. Não há acesso a contagens ou resultados de outras empresas, inclusive depois da retirada do acesso.
- A busca normaliza maiúsculas e acentos latinos comuns. Exige todos os termos e reconhece equivalências de competências: JS/JavaScript/ECMAScript, TS/TypeScript, Microsoft Excel/MS Excel/Excel, Power BI/PowerBI, Postgres/PostgreSQL, RH/Recursos Humanos, gestão/gerenciamento de projetos/Project Management, inglês/English e administração/Administration.
- Expressões como “buscar candidatos com JS em São Paulo” são convertidas em termos de pesquisa. Não é uma busca semântica aberta nem usa IA. Os limites e exemplos aparecem na interface.
- Java não corresponde a JavaScript; C não corresponde a C++. O filtro de competências considera somente a lista de competências, não contatos ou chaves internas. Competências com negação explícita são omitidas conservadoramente da busca positiva; a avaliação contextual continua sendo responsabilidade do mecanismo de aderência e do RH.
- Filtros de candidatos: funil, leitura, revisão humana, competências, localização e experiência mínima. Informação ausente não satisfaz um filtro positivo, nem comprova zero anos.
- Filtros de vagas: palavras, local, categoria e situação. A ausência de vagas na categoria possui mensagem específica.
- Filtros de ranking: palavras, local, experiência, aderência mínima, com/sem avaliação final, obrigatórios atendidos, requisito e situação da evidência desse requisito. As conclusões vêm da avaliação salva, sem recalcular notas durante a busca.
- Base vazia, nenhuma correspondência, carregamento e falha de consulta possuem mensagens distintas. O ranking diferencia ausência de cálculo de cálculo sem correspondências. A limpeza dos filtros mantém o texto da pesquisa.
- As páginas de vínculos continuam limitadas a 20 e agora mostram contagens completas.
- Correções, envios, versões, arquivamentos e mudanças de vaga invalidam as consultas relacionadas. As listas ativas são atualizadas a cada cinco segundos e ao retornar à janela. Consultas são separadas por empresa, filtros, página e avaliação, com cancelamento das requisições antigas. Durante a digitação, não se apresentam resultados de outra busca como atuais.
- Avaliações históricas continuam mostrando o retrato que foi avaliado, com o aviso de desatualização quando o cadastro muda. A busca atual de candidatos usa os dados corrigidos.

## Validação

- `supabase/tests/company_search.sql`: 29 verificações no banco novo, com 1.104 candidatos na empresa de teste, 1.102 vagas e registros em outra empresa. Inclui paginação além do limite de mil, equivalências, negações, campos ausentes, filtros combinados, requisitos de ranking, correção humana, arquivamento e revogação. Tudo em transação revertida, sem contas persistentes ou chamadas de IA.
- 110 testes unitários aprovados; TypeScript e compilação aprovados.
- Conferência visual dos componentes reais com API simulada local: segunda página; busca sem resultado; limpeza preservando texto; base vazia; erro com nova tentativa; categoria Jovem Aprendiz vazia; ranking sem cálculo e ranking filtrado sem resultados.
- Imagem: `busca-candidatos-interface.png` (dados fictícios).
- Supabase Advisors: nenhum novo alerta desta alteração. Permanecem os avisos previamente conhecidos de tabelas privadas com RLS sem políticas e proteção de senhas vazadas desativada. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

A consulta usa índices de empresa/ordenação e índices de texto. Contagens exatas exigem consultar toda a seleção; o teste funcional com mais de mil registros não constitui uma medição de carga em escala de produção. A comparação semântica aberta e testes reais de IA continuam fora desta etapa, conforme a orientação anterior.
