# Roadmap priorizado

Referências E01–E28: [catálogo de evidências](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>). Para escopo e limites, consulte o [resumo executivo](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>).

Este é um plano de engenharia, não autorização de implementação. As estimativas são pontos relativos: 1 = muito pequeno; 3 = pequeno; 5 = médio; 8 = grande; 13 = grande e incerto, a decompor. Não equivalem a dias, não são somadas para prometer prazo e devem ser recalibradas após acesso ao ambiente de testes.

## Fases e gates

| Fase | Escopo | Tarefas | Gate de saída |
|---|---|---|---|
| 0 — Segurança e correção | isolamento, ambiente reproduzível, autorização, score, integridade e contratos | 001–008 | duas empresas isoladas; casos adversos de score/IA/upload/exclusão corrigidos; sem perda sob falha |
| 1 — Consolidar triagem | revisão, edição de vaga, fila, versões, deduplicação, DOCX, qualidade de dados e aprendizagem | 009–014, 017, 020 | fluxo documento→extração→revisão→avaliação repetível, rastreável e recuperável |
| 2 — Operação comercial | erros/paginação/cache, observabilidade, retenção, decisões por vaga e consumo | 015–019, 021 | piloto controlado com qualidade medida, restore validado e limites de uso |
| 3 — Inteligência avançada | comparação, relatórios, busca semântica, assistente fundamentado | 022–024 | valor medido pelo RH; nenhum resultado sem fonte/permissão |
| 4 — Ecossistema | API, integrações e automações externas | deliberadamente adiado | nova decisão de escopo após núcleo confiável |

Algumas tarefas atravessam fases: 015 (erros/paginação) pode começar na fase 1; 017 (benchmark) começa cedo e só fecha com motor estabilizado; 020 (regra de aprendizagem) deve ser antecipada antes de qualquer piloto desse tipo de vaga.

## Primeira sequência de execução

1. **CENY-001:** isolamento de organizações, RLS, storage e RPCs. Primeiro bloqueador de uso multiempresa.
2. **CENY-002:** ambiente de testes reprodutível e checks automáticos; pode começar junto com 001, sem dados reais.
3. **CENY-003:** convidados, papéis e limpeza de cache de sessão.
4. **CENY-004:** matching verificável, ausência/negação/sinônimos/deduplicação de critérios.
5. **CENY-005:** elegibilidade de extração e publicação atômica de ranking.
6. **CENY-006:** validação local e conclusão segura de resposta IA.
7. **CENY-007:** upload validado, cotas iniciais e compensação.
8. **CENY-008:** arquivamento/exclusão recuperáveis.
9. **CENY-009:** revisão humana completa, preservada no reprocessamento.
10. **CENY-010:** editar/versionar vagas e invalidar avaliações antigas.

“Pode começar junto” é uma possibilidade de planejamento para a equipe, não delegação executada nesta auditoria.

## Dependências principais

001 → 003/007/008/010/012/016/018.
002 → 004/006 e validações das demais.
004 → 005/009/010.
006+007 → 011 (fila) e 012 (documentos/versões).
009+010+012 → 017 (benchmark final), 019 (decisões) e 022 (comparação).
011+016 → 021 (controle de consumo).
017+022 → 023 (busca semântica).
017+023 → 024 (assistente).

## Priorização e esforço

| ID | Prioridade | Impacto no negócio / técnico | Complexidade / pontos | Risco principal |
|---|---|---|---|---|
| 001 | P0 | proteção dos clientes / autorização transversal | alta, 13 | atribuição incorreta de legado |
| 002 | P0 | confiabilidade de entrega / build e regressões | média, 5 | configuração divergir do deploy |
| 003 | P0 | acesso só de RH autorizado / papéis e sessão | alta, 8 | bloquear acesso legítimo |
| 004 | P0 | evitar rankings enganosos / regra de domínio | alta, 13 | perda de recall ao restringir match |
| 005 | P0 | não perder avaliações / atomicidade/versionamento | média, 8 | concorrência e locks |
| 006 | P0 | impedir saída inválida / contrato do gateway | média, 5 | rejeitar resposta válida por contrato errado |
| 007 | P0 | proteger documentos e custo / ingestão | alta, 8 | rejeitar arquivos legítimos |
| 008 | P0 | evitar perda parcial / lifecycle de exclusão | alta, 8 | retenção/remoção equivocada |
| 009 | P1 | RH corrigir e confiar / revisão versionada | alta, 13 | conflito IA × correção humana |
| 010 | P1 | ajustar vagas / critérios e versões | média, 8 | scores antigos parecerem atuais |
| 011 | P1 | lote recuperável / tarefas e retries | alta, 13 | execução duplicada |
| 012 | P1 | acervo íntegro / documento separado e hash | alta, 13 | mesclar pessoas diferentes |
| 013 | P1 | suporte DOCX / extração de formato | média, 8 | parser/conversor malicioso |
| 014 | P1 | dados consistentes / validação e constraints | média, 5 | rejeição do legado |
| 015 | P1 | operação compreensível / consultas e estados | média, 8 | quebra de busca/ordenação |
| 016 | P1 | diagnosticar/operar / logs e eventos | média, 5 | PII nos logs |
| 017 | P1 | provar valor / benchmark e estabilidade | alta, 13 | avaliar com corpus tendencioso |
| 018 | P1 | privacidade operável / retenção e restore | alta, 8 | apagar dado sob obrigação de retenção |
| 019 | P1 | decisões por vaga / notas e histórico | média, 8 | migrar status global ambiguamente |
| 020 | P1 | evitar exclusão inadequada / regras de elegibilidade | média, 5 | codificar regra jurídica incompleta |
| 021 | P1 | viabilidade comercial / cotas e consumo | média, 8 | cobrar/limitar duplicado |
| 022 | P2 | entrega ao gestor / comparação e relatórios | alta, 13 | exposição em exportações |
| 023 | P2 | redescoberta de talentos / busca semântica | alta, 13 | recall baixo/vazamento por índice |
| 024 | P2 | assistência contextual / respostas com fontes | alta, 13 | alucinação e prompt injection |

P3: integrações/ecossistema somente após nova autorização de escopo. Critérios de conclusão e testes por tarefa estão no documento 09; não repetir estimativas como datas.

## Estratégia para equipe pequena

Entregar fatias verificáveis: duas empresas fictícias isoladas; um documento processado com revisão; uma vaga com score rastreável; um lote retomável. Evitar implantar ao mesmo tempo novo modelo, novo esquema de dados e nova fórmula sem comparação de resultados. Usar assistência de IA no desenvolvimento com revisão humana das políticas, migrações e regras de avaliação.

