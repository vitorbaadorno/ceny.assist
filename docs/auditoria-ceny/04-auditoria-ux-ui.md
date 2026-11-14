# Fluxos operacionais — design fora do escopo

Referências E01–E28: [catálogo de evidências](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>). Para escopo e limites, consulte o [resumo executivo](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>).

Não foi avaliada estética, identidade visual, responsividade renderizada ou conformidade visual de acessibilidade. A avaliação abaixo é do comportamento implementado nos componentes. Não houve sessão de navegador com a aplicação: faltam dependências e ambiente de testes conectado. Não se afirma ter clicado nas telas.

## Avaliação por jornada

| Jornada | O que existe | Falha/risco observável no código | Melhoria funcional | Prioridade |
|---|---|---|---|---|
| Primeiro acesso | login, criar conta, recuperação | acesso não depende de empresa/convite; frase de proteção LGPD sem controles correspondentes | associar conta a empresa autorizada e indicar estado de aprovação | P0/P1 |
| Configurar empresa | nenhuma tela | sem dados empresariais, papéis ou seleção de organização | onboarding B2B com administrador, convite e contexto da empresa | P1 |
| Criar vaga | título, descrição, obrigatórios/desejáveis, experiência/formação/local/categoria | vagas vazias de critérios são pontuáveis; sem edição posterior; duplicação muda peso | validar mínimo de critérios, explicar obrigatórios, editar/versionar | P0/P1 |
| Enviar currículos | seleção múltipla, status por arquivo | sem limite, cancelar/retomar/repetir só falhos; feedback final de sucesso mesmo com erro total | resumo de sucessos/falhas, tarefas persistidas e reenvio idempotente | P0/P1 |
| Acompanhar processamento | tela de upload e polling da lista | fechar aba interrompe orquestração de próximos itens; detalhe não faz polling; sem recuperação de tarefa | acompanhamento por lote/documento com estados reais no servidor | P1 |
| Revisar dados | campos incertos, notas, cidade e nascimento | nome/contatos/formação/skills não editáveis; não há concluir revisão | editor com evidência, salvamento explícito e versão humana | P1 |
| Ver ranking | percentuais, requisitos atendidos/faltantes, filtros | linguagem sugere certeza sem evidência; erro/vazio/filtro conflitados | sem evidência ≠ não atende; mostrar data/versão/status e trecho de suporte | P0/P1 |
| Avaliar candidato | status global e observações | decisão para uma vaga afeta visão global; notas sem autor | decisão por candidato/vaga, autoria, histórico | P1 |
| Comparar | não existe | só lista ordenada | comparação dos mesmos critérios e shortlist, após score confiável | P2 |
| Buscar/filtrar | texto/status/cidade/experiência | filtros apenas no conjunto carregado; ausência de resultados sugere reenviar currículo | consulta paginada, limpar filtros, distinguir base vazia e busca vazia | P1 |
| Gestão de currículos | original, reprocessar, excluir | reprocessar sobrescreve correções; exclusão não informa retenção estruturada | versões, revisão e semântica separada de arquivar/eliminar | P0/P1 |
| Administração | ausente | sem controle de usuários, consumo ou logs | administração mínima para RH e operação | P1 |

## Falhas específicas por tela

**Candidatos — E13:** consulta usa data=[] em falha; isError não é renderizado. “Nenhum candidato encontrado. Envie currículos” é usado inclusive quando filtros eliminam todos os resultados. O contador mostra o tamanho da resposta, não uma contagem integral da base. ProcessingLabel interpreta qualquer estado não reconhecido como sucesso. Corrigir estados não é redesenho visual.

**Detalhe — E12:** isLoading || !candidate retorna “Carregando candidato...” também após erro ou UUID inexistente. Original continua com botão mesmo sem path, porém o handler apenas retorna. window.open ocorre após await; bloqueio de popup é risco a verificar em navegador, não falha reproduzida aqui. Cidade digitada não persiste, pois apenas onSelect chama mutation. Data de nascimento e notas usam defaultValue, exigindo testes de atualização externa e navegação entre candidatos sem remontagem. Persistência por onBlur não informa salvamento pendente/último salvo de modo contínuo. Reprocessamento sem invalidação de scores deixa avaliação anterior parecer atual.

**Upload — E10:** cada item aparece “enviando” antes de começar efetivamente. Há estados de leitura/revisão/erro, mas nenhum progresso durável. Toast final incondicional reproduzido em U02. Após upload não há invalidation de candidates; a lista pode depender do refetch/polling.

**Vagas — E14:** quando existem vagas mas a categoria selecionada não possui itens, a grade fica vazia sem explicação. Cadastro não tem edição posterior. Requisitos são strings separadas por vírgula/linha/ponto e vírgula; sem tipagem, prioridade individual ou aviso de repetição.

**Ranking — E15:** ausência de scores, falha de consulta e zero resultados após filtro acabam em mensagem “Clique em Calcular aderência”. Não mostra análise obsoleta, versão ou motivo de exclusão de candidatos. Falta filtro por qualidade da extração. Mais campos aparecem ao expandir candidato, mas não há comparação dos critérios lado a lado.

**Autenticação — E16/E17/E18:** cadastro aceita mínimo de seis caracteres; redefinição exige oito. Fluxos reais de e-mail e sessão não testados. Falta tratamento explícito de falha de logout e limpeza de dados da sessão anterior. Configuração de empresa não existe.

## Estados a exigir nos testes de interface futuros

Carregando; vazio inicial; filtro sem resultado; erro de rede; sem permissão; sessão expirada; registro removido; processamento em fila/em execução/com erro/revisão/concluído; análise obsoleta; salvamento pendente; falha parcial de exclusão. Cada estado deve oferecer ação coerente, sem prometer sucesso quando não houve persistência.

Sem propor nova identidade visual: preservar navegação simples de candidatos/upload/vagas e completar os estados e operações. Testes de teclado/foco/leitor de tela são necessários para formulários, autocomplete e diálogos, mas permanecem não executados.

