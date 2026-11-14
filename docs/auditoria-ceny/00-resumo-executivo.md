# Auditoria funcional da Ceny — 23/10/2026

## Conclusão

A Ceny é um protótipo com implementação real dos fluxos básicos, mas **não está pronta para operar como SaaS multiempresa nem para apresentar o ranking como triagem confiável**. A stack pode ser preservada. Os bloqueadores estão nas permissões, na qualidade das regras de pontuação e na integridade das operações.

Esta avaliação cobre o material de D:/Projetos/Ceny/ceny.assist-main, orientada por D:/Projetos/Ceny/objetivos-da-ceny.md. O pedido atual prevalece: somente auditoria, foco em funções internas, sem avaliação estética ou implementação de integrações.

Foram criados somente documentos nesta pasta do workspace. Nenhum arquivo da aplicação, configuração Git, branch, commit, migração ou dado de produção foi alterado. A referência oficial indicada pelo usuário é [vitorbaadorno/ceny.assist](https://github.com/vitorbaadorno/ceny.assist); identidade reservada para futuras alterações: Vitor Adôrno <vbatistaadorno@gmail.com>. Consulta somente de leitura encontrou HEAD/main em 58df482099e187f25ef2c154789321df8b0b1815. A pasta anexada não contém .git: sua equivalência a esse commit **não foi comprovada**.

## O que foi validado

Foram executadas **47 verificações isoladas, com 47 comportamentos confirmados**, incluindo defeitos reproduzidos. Isso não significa 47 funcionalidades aprovadas. O código de pontuação, idade e parser de IA foi executado diretamente. Upload e handlers foram executados com adaptadores simulados, sem serviços externos. O código e a metodologia estão no documento 10.

Funcionam nos testes locais: normalização de acentos/caixa, correspondência textual exata, determinismo da fórmula, cálculo de aniversários válidos, leitura de SSE em chunks, mensagens 402/429, rejeição de token ausente/malformado e caminhos sintéticos de persistência e upload em lote.

**Não há fluxo completo validado de ponta a ponta.** Autenticação real, banco, storage e extração por IA não foram acessados. A cópia não contém node_modules; build e lint não iniciaram por ausência de Vite e ESLint. Não há script de teste no projeto. Não se conclui, a partir disso, que a aplicação publicada não compila.

## O que pode ser aproveitado

- React + TanStack Start, rotas e React Query.
- Integração com Supabase Auth e encaminhamento do JWT, proteção CSRF e tipos gerados. [E19](<D:/Projetos/Ceny/ceny.assist-main/src/integrations/supabase/auth-middleware.ts:34>) [E20](<D:/Projetos/Ceny/ceny.assist-main/src/start.ts:21>)
- Separação inicial de leitura, pontuação e exclusão em funções de servidor.
- Schema estruturado de extração, representação de null, sinalização de baixa confiança e arquivo original com URL temporária. [E08](<D:/Projetos/Ceny/ceny.assist-main/src/lib/resumes.functions.ts:93>)
- Formulários de vagas, lista/detalhe de candidatos, notas, estados de processamento e confirmações de exclusão.
- Tabelas relacionais e índices existentes, como base para evolução; as políticas precisam ser substituídas por isolamento real.

## Dez problemas principais

| # | Gravidade | Problema e impacto | Evidência |
|---|---|---|---|
| 1 | P0 | Não há empresa, associação de usuários ou isolamento. As políticas permitem acesso compartilhado entre autenticados; storage e RPCs também. Se essas migrações estiverem em produção, empresas não estão isoladas. Não foi demonstrado incidente real. | E01–E05, E19, E26 |
| 2 | P0 | Score confunde substrings, negações e dados pessoais com competências: JavaScript atende Java; nome “Ana Java” atende Java; negação de Excel atende Excel. | E06; S03–S06, S13 |
| 3 | P0 | Currículo com erro ou revisão entra no ranking; candidato e vaga vazios chegam a 100%. | E06–E07; S07, R01 |
| 4 | P0 | Recálculo apaga o ranking antes de salvar o novo; falha posterior deixa perda de resultado. | E07; R02 |
| 5 | P0 | Exclusão pode apagar o arquivo e falhar ao arquivar; apagar na tela não elimina os dados pessoais estruturados. | E05, E11; D01 |
| 6 | P0 | IA aceita JSON incompatível com o schema localmente e ignora evento de falha após texto válido. | E09; I03, I04, I09 |
| 7 | P0 | Upload sem limite/validação no código; falha de cadastro deixa arquivo órfão. Limites efetivos do bucket não verificados. | E08, E10; U01, U03 |
| 8 | P1 | “Revisão manual” não permite corrigir nome, contato, competências, experiências e formação nem concluir revisão; reprocessar sobrescreve correções existentes. | E08, E12; P02, P04 |
| 9 | P1 | Filtro de aprendizagem exclui nascimento desconhecido e inclui 24 anos completos; falta tratamento de exceções. Requer revisão funcional e jurídica. | E21; A03–A05; documento 05 |
| 10 | P1 | Falhas de consulta aparecem como vazio/carregamento; não há paginação, limpeza de cache por sessão, testes de projeto ou trilha de alterações. | E12–E18, E24 |

Os limites, a origem e os testes de cada achado estão nos documentos técnicos; não se confundem riscos inferidos com exploração comprovada.

## Ausências relevantes para o produto desejado

Multiempresa e papéis; revisão humana completa; versões de currículo e extrações; deduplicação; DOCX; critérios/versões de vagas; evidências rastreáveis de matching; processamento recuperável; comparação, favoritos e shortlists; relatórios; busca semântica; histórico por candidato/vaga; auditoria de acesso e consumo. Assistente de IA deve vir depois de uma base confiável. Portal de candidatos e ATS completo não são necessários.

## Maturidade (0–5)

As notas abaixo avaliam **a implementação examinada**, não certificam ambiente publicado ou qualidade empírica da IA.

| Dimensão | Nota | Fundamento |
|---|---:|---|
| Arquitetura | 2 | Estrutura modular inicial; operações distribuídas e regras em componentes. |
| Qualidade de código | 2 | TypeScript estrito e schemas de entrada; casts, duplicação e ausência de testes do projeto. |
| Segurança | 1 | Autenticação/CSRF existem, autorização por empresa não. |
| Banco de dados | 1 | Entidades/índices úteis, mas sem tenants e sem histórico/versionamento. |
| Triagem de currículos | 1 | Falsos positivos reproduzidos e inclusão de falhas no ranking. |
| Qualidade da IA | Não avaliado | Nenhum corpus real/sintético foi enviado ao modelo; confiança não calibrada. |
| UX/UI visual | Não avaliado | Design excluído pelo pedido; sem navegação renderizada. |
| Funcionalidades de RH | 2 | Cadastro/lista/status/notas/ranking implementados, revisão e comparação incompletas. |
| Integrações externas | Não avaliado | Fora do escopo; dependências existentes apenas inventariadas. |
| Escalabilidade | 1 | Listas completas, polling, processamento por requisição, sem fila/cotas. |
| Preparação comercial | 1 | Faltam isolamento, governança, medição de qualidade e operação confiável. |

## Arquitetura e ordem recomendada

Evoluir como monólito modular: frontend atual, funções de servidor, Postgres/Supabase, storage privado por empresa e worker simples com tarefas persistidas. Não é necessário reescrever tudo. Separar candidato, documento, extração, avaliação e decisão humana evita perda de histórico.

As dez primeiras tarefas propostas são: CENY-001 isolamento; CENY-002 ambiente reproduzível e testes; CENY-003 membros/papéis/cache; CENY-004 matching verificável; CENY-005 elegibilidade e ranking atômico; CENY-006 contrato da IA; CENY-007 upload seguro; CENY-008 exclusão recuperável; CENY-009 revisão humana; CENY-010 edição/versionamento de vagas. As dependências e critérios constam no backlog.

**Primeira implementação recomendada: CENY-001 — estabelecer isolamento entre empresas no banco, storage e RPCs, com testes negativos entre duas empresas fictícias.** É a condição para proteger qualquer dado que os demais fluxos manipulam. Não foi iniciada.

## Documentos

- [00-resumo-executivo.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>)
- [01-inventario-funcional.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/01-inventario-funcional.md>)
- [02-auditoria-tecnica.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>)
- [03-auditoria-ia-triagem.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/03-auditoria-ia-triagem.md>)
- [04-auditoria-ux-ui.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/04-auditoria-ux-ui.md>)
- [05-seguranca-lgpd.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/05-seguranca-lgpd.md>)
- [06-gap-analysis.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/06-gap-analysis.md>)
- [07-arquitetura-proposta.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/07-arquitetura-proposta.md>)
- [08-roadmap.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/08-roadmap.md>)
- [09-backlog-codex.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/09-backlog-codex.md>)
- [10-plano-de-testes.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/10-plano-de-testes.md>)
- [11-integracoes.md](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/11-integracoes.md>)

