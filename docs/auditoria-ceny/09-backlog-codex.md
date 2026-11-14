# Backlog executável para implementação posterior

Referências E01–E28: [catálogo de evidências](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>). Para escopo e limites, consulte o [resumo executivo](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>).

Nenhuma tarefa foi implementada nesta auditoria. Os IDs referenciam o catálogo de evidências do documento 02 e os testes do documento 10. Esforço em pontos relativos, não dias. Prioridade e impacto consolidados no documento 08. Integrações externas e design permanecem fora do escopo.

## CENY-001 — Implementar isolamento entre empresas

- **Prioridade / esforço:** P0; 13 pontos. Complexidade alta: envolve schema, legado, storage e todas as permissões.
- **Problema:** Todos os usuários autenticados compartilham acesso aos registros ativos e arquivos, sem entidade empresa.
- **Evidência:** E01–E05, E19, E26.
- **Objetivo:** Cada recurso pertence a uma empresa e nenhum usuário sem vínculo consegue acessá-lo.
- **Escopo:** Criar organizations/memberships; definir estratégia de atribuição do legado; adicionar organization_id e FKs/constraints de escopo; substituir políticas em todas as tabelas, storage e RPCs; guardar documento/arquivo em prefixo validado. Não inferir ownership pelo e-mail. Inventariar configuração real somente em ambiente autorizado.
- **Arquivos/módulos:** supabase/migrations; src/integrations/supabase/auth-middleware.ts; funções em src/lib; rotas CRUD; tipos Supabase.
- **Dependências:** Nenhuma; ambiente de teste necessário e checks da CENY-002 podem ser preparados em paralelo.
- **Critérios de aceite:** Duas empresas fictícias A/B com usuários distintos: A não lê/insere/edita/exclui dados B por REST, RPC, Server Function, associação de score ou storage; usuário sem membership não acessa dados; URLs só são emitidas para documento autorizado; registros sem ownership ficam inacessíveis até revisão.
- **Testes:** Integração SQL/RLS e storage com anônimo, A, B e membro revogado; testar troca de organization_id, candidate_id/job_id e chamada direta de archive RPC; verificar legado e contagens.
- **Riscos:** Atribuir legado ao tenant errado ou bloquear acesso legítimo; migração deve ser aditiva e falhar fechada.

## CENY-002 — Estabelecer ambiente reproduzível e testes de projeto

- **Prioridade / esforço:** P0; 5 pontos. Complexidade média: configuração e automação, com incerteza de deploy.
- **Problema:** Não há baseline compilada e testada reproduzível; checklist do roadmap não é evidência.
- **Evidência:** E24/E25/E28; build/lint sem executáveis; ausência de test script.
- **Objetivo:** Qualquer alteração posterior tem build, tipos, lint e testes verificáveis sem usar produção.
- **Escopo:** Escolher package manager e lock consistente; documentar Node e variáveis por nome; preparar Supabase de teste e bucket privado; adicionar typecheck/test/CI; portar testes relevantes da auditoria como testes de comportamento esperado corrigido, sem transformar bugs atuais em contrato desejado.
- **Arquivos/módulos:** package.json, bun.lock ou lock adotado, tsconfig.json, configuração CI, documentação de desenvolvimento, nova pasta de testes.
- **Dependências:** Nenhuma; usar dados sintéticos e configuração isolada.
- **Critérios de aceite:** Instalação congelada reproduzível; build/lint/typecheck aprovados; testes de domínio e smoke rodando no CI; nenhum endpoint/segredo de produção em testes.
- **Testes:** Instalação limpa em ambiente suportado; testar detecção de regressão de Java/JavaScript e negação; confirmar execução real de test e erros de configuração claros.
- **Riscos:** Mudança de lock pode resolver versões diferentes; não atualizar stack inteira junto.

## CENY-003 — Controlar membros, papéis e dados de sessão

- **Prioridade / esforço:** P0; 8 pontos. Complexidade alta: autorização atravessa auth, backend e cache.
- **Problema:** Criar conta não comprova autorização de RH; não há gestão de membros/papéis e cache não é limpo ao sair.
- **Evidência:** E16/E18/E19; queryKeys globais.
- **Objetivo:** Acesso depende de membership ativo e papel apropriado, com sessão sem dados residuais.
- **Escopo:** Fluxo de convite/aprovação; papéis administrador/RH/leitor; autorização backend de ações sensíveis; contexto de organização em queries; cancelamento/limpeza de cache ao sair/trocar contexto; tratar falha real de signOut; alinhar política de senha e testar recuperação.
- **Arquivos/módulos:** src/routes/auth.tsx, reset-password.tsx, _authenticated/route.tsx; useAuth.tsx; router.tsx; auth-middleware.ts; memberships.
- **Dependências:** CENY-001.
- **Critérios de aceite:** Conta nova sem convite não acessa currículo; revogação bloqueia operações; leitor não altera/exclui; logout e troca de empresa não exibem cache anterior; recuperação válida funciona e expirada falha claramente.
- **Testes:** E2E login/logout/troca/duas abas/revogação; API com papel leitor; link de recuperação válido/expirado; senha consistente.
- **Riscos:** Usuários podem ficar sem administrador; prever bootstrap seguro e recuperação administrativa.

## CENY-004 — Substituir matching por critérios verificáveis

- **Prioridade / esforço:** P0; 13 pontos. Complexidade alta: semântica de RH e calibração dos critérios.
- **Problema:** Substrings, negações, chaves JSON e nome podem produzir score máximo.
- **Evidência:** E06; S03–S13.
- **Objetivo:** Avaliação fundamentada somente em evidências relevantes, com ausência explicitada.
- **Escopo:** Separar campos de competência/experiência/formação; normalizar requisitos, remover duplicados; tratar negação, nível e sinônimos controlados; excluir PII e chaves JSON; definir obrigatórios/desejáveis e quatro estados de evidência; versionar fórmula/pesos; exigir cobertura mínima e evidências por critério.
- **Arquivos/módulos:** src/lib/scoring.ts; tipos de avaliação; scoring.functions.ts; JobDetail; schema de critérios/resultados.
- **Dependências:** CENY-002; contrato de critérios alinhado à CENY-010.
- **Critérios de aceite:** JavaScript sozinho não comprova Java; negação e nome não satisfazem competência; duplicar requisito não muda peso; candidato/vaga vazios não geram 100%; desconhecido não é apresentado como falta comprovada.
- **Testes:** Testes de domínio com S03–S13 convertidos em expectativas desejadas; pares de equivalência; invariância por nome e layout; avaliação por RH.
- **Riscos:** Excesso de rigor reduz recall; manter revisão e medir qualidade por critério antes de automação semântica.

## CENY-005 — Publicar rankings com integridade e histórico

- **Prioridade / esforço:** P0; 8 pontos. Complexidade média: transação e concorrência no banco.
- **Problema:** Candidatos em erro/revisão são classificados e DELETE precede UPSERT.
- **Evidência:** E07; R01/R02.
- **Objetivo:** Só avaliações válidas são publicadas e falhas não apagam ranking anterior.
- **Escopo:** Definir elegibilidade por estado validado; não excluir definitivamente pendentes; criar evaluation_run; gravar resultados e publicar atomicamente; preservar anterior e marcar obsolescência; paginação completa da entrada; idempotência por vaga/versões e controle de concorrência.
- **Arquivos/módulos:** scoring.functions.ts; candidate_scores/evaluation_runs; JobDetail.
- **Dependências:** CENY-001, CENY-004.
- **Critérios de aceite:** Erro/incompleto não produz score final; falha de gravação mantém versão anterior; duas execuções não intercalam resultados; todas as páginas da base autorizada são consideradas; UI mostra versão/data e pendentes.
- **Testes:** Injetar falha no meio da gravação; duas execuções simultâneas; candidatos removidos/corrigidos durante cálculo; mais registros que limite de uma página.
- **Riscos:** Locks longos e custos de grandes lotes; publicar por ponteiro/versionamento em vez de apagar previamente.

## CENY-006 — Validar contrato e conclusão de respostas de IA

- **Prioridade / esforço:** P0; 5 pontos. Complexidade média: adaptação de protocolo e validações.
- **Problema:** Schema remoto não é validado localmente; evento de falha pode ser ignorado.
- **Evidência:** E08/E09; I03/I04/I09/P02.
- **Objetivo:** Somente resposta concluída e válida vira extração persistida.
- **Escopo:** Schema runtime compartilhado; validar arrays, null, e-mail/data e faixas; tratar completed/failed/incomplete/refusal/erro de stream; timeout e limite de saída; mensagens públicas sanitizadas; rever campos incertos/needsReview; registrar modelo/schema/prompt utilizados.
- **Arquivos/módulos:** ai.server.ts; resumes.functions.ts; schema de extração.
- **Dependências:** CENY-002.
- **Critérios de aceite:** JSON fora do schema, null e conclusão falha nunca resultam em concluido; timeout finaliza tentativa de modo recuperável; campos críticos incertos vão à revisão; 402/429 preservam mensagens úteis sem detalhes sensíveis.
- **Testes:** SSE fragmentado, UTF-8 multibyte, erro terminal após texto, resposta incompleta/sem newline, JSON válido incompatível, timeout e cancelamento.
- **Riscos:** Diferença entre contrato do gateway e formato real; confirmar fixture oficial em ambiente de teste antes do deploy.

## CENY-007 — Validar uploads e eliminar órfãos

- **Prioridade / esforço:** P0; 8 pontos. Complexidade alta: fronteira cliente/storage/backend e falhas parciais.
- **Problema:** Handler aceita metadados arbitrários, não limita tamanho e não desfaz upload após falha de cadastro.
- **Evidência:** E08/E10; U01/U03.
- **Objetivo:** Ingestão segura com recursos limitados e arquivo sempre rastreável.
- **Escopo:** Definir formatos/tamanho/páginas/lote; validar conteúdo no servidor; refletir limites no bucket; paths por empresa; vínculo documento e upload com estado; compensação/limpeza idempotente; cota inicial; impedir processamento de arquivo inválido.
- **Arquivos/módulos:** UploadPage; resumes.functions.ts; storage policies/config; documentos/tarefas de limpeza.
- **Dependências:** CENY-001, CENY-002.
- **Critérios de aceite:** Arquivo vazio, incompatível, disfarçado ou excessivo é rejeitado antes de IA; falha de INSERT não deixa órfão permanente; retries não duplicam documento; envio direto ao bucket obedece limites.
- **Testes:** MIME/extensão divergentes, limite exato/+1, lote excedente, falha após upload, falha de limpeza e recuperação; apenas arquivos sintéticos.
- **Riscos:** Falsas rejeições e custo de antivírus/conversão; começar com formatos declarados e limites explícitos.

## CENY-008 — Separar arquivamento e eliminação recuperável

- **Prioridade / esforço:** P0; 8 pontos. Complexidade alta: consistência entre banco e storage.
- **Problema:** Arquivo pode desaparecer antes do arquivamento; ação de excluir mantém dados pessoais sem política explícita.
- **Evidência:** E05/E11; D01.
- **Objetivo:** Sem perda parcial silenciosa e sem promessa falsa de eliminação.
- **Escopo:** Separar arquivar de eliminar; autorização de papel/tenant; registrar intenção/estado e tarefas idempotentes; definir compensação e confirmação do storage; preservar histórico permitido e eliminar/anônimizar conforme política; coordenar reprocessamento concorrente.
- **Arquivos/módulos:** records.functions.ts; archive RPCs; CandidateDetail/JobDetail; schema de lifecycle.
- **Dependências:** CENY-001; regras de retenção detalhadas em CENY-018.
- **Critérios de aceite:** Falha em qualquer etapa resulta em estado recuperável visível; arquivo não é perdido em uma operação que se declara cancelada; retry converge; eliminação remove dados definidos pela política e preserva apenas auditoria minimizada.
- **Testes:** Falha no storage, DELETE scores e RPC; timeout ambíguo; chamadas duplicadas; exclusão simultânea ao reprocessamento; verificação pós-processo.
- **Riscos:** Retenção indevida ou remoção irreversível; usar staging e política de retenção validada.

## CENY-009 — Completar revisão humana de dados extraídos

- **Prioridade / esforço:** P1; 13 pontos. Complexidade alta: editor, versionamento e conflitos.
- **Problema:** Campos relevantes não são editáveis e reprocessar apaga correções.
- **Evidência:** E08/E12; P02/P04.
- **Objetivo:** RH corrige, confirma e rastreia os dados usados no ranking.
- **Escopo:** Editor de nome/contato/localização/formação/experiências/skills/idiomas; evidência e ausências; salvar revisão com autor/motivo; concluir revisão quando critérios mínimos atendidos; preservar camada humana em novas extrações; marcar score obsoleto.
- **Arquivos/módulos:** CandidateDetail; serviços de revisão; candidate_revisions/extraction_runs; processing_status.
- **Dependências:** CENY-001, CENY-004, CENY-006; alinhar estrutura com CENY-012.
- **Critérios de aceite:** Correção sobrevive a reprocessamento; campo desconhecido permanece desconhecido; conclusão de revisão é auditada; conflito de dois revisores não sobrescreve silenciosamente; score usa versão selecionada.
- **Testes:** Revisar extração falha, reprocessar, comparar versões; conflito de edição; tentativa por leitor; correção invalida ranking.
- **Riscos:** Mesclar extração e revisão sem precedência clara; tornar fonte e estado explícitos.

## CENY-010 — Editar e versionar vagas e critérios

- **Prioridade / esforço:** P1; 8 pontos. Complexidade média: formulários e dependências do ranking.
- **Problema:** Vaga não pode ser editada/encerrada na UI e critérios são strings sem versão.
- **Evidência:** E14/E15; S07/S12.
- **Objetivo:** RH ajusta critérios conscientemente sem reutilizar score de configuração antiga.
- **Escopo:** Editar título/descrição/local/formação/experiência/status; critérios tipados, obrigatórios/desejáveis, pesos e deduplicação; validar conteúdo mínimo; versões; marcar avaliações obsoletas; templates simples quando base estável.
- **Arquivos/módulos:** JobsPage/JobDetail; serviços de jobs; job_versions/job_criteria.
- **Dependências:** CENY-001, CENY-004.
- **Critérios de aceite:** Vaga sem critérios suficientes não gera ranking final; alteração cria versão e invalida scores; encerrar não apaga candidatos; pesos e critérios repetidos tratados de forma explícita.
- **Testes:** Criar/editar/encerrar/reabrir; valores negativos/vazios; duplicados; concorrência de edição; comparação da avaliação antes/depois.
- **Riscos:** Alterar peso sem comunicar ao RH; guardar snapshot e histórico.

## CENY-011 — Processar lotes por tarefas persistidas

- **Prioridade / esforço:** P1; 13 pontos. Complexidade alta: execução assíncrona e recuperação.
- **Problema:** Orquestração depende da aba aberta e não há retry/lock durável.
- **Evidência:** E08/E10; U04/P04.
- **Objetivo:** Lote continua e pode ser acompanhado após navegação ou reinício.
- **Escopo:** processing_tasks com estado/tentativa/lease/idempotency_key; worker simples; concorrência limitada por empresa; timeout/backoff; cancelar/repetir só falhos; interface de progresso real; evitar duplicação de consumo.
- **Arquivos/módulos:** UploadPage; resumes.functions.ts; worker; processing_tasks.
- **Dependências:** CENY-001, CENY-006, CENY-007.
- **Critérios de aceite:** Fechar aba não perde próximos itens; reinício retoma tarefa; no máximo uma execução ativa por documento/versão; retry limitado; status do lote reflete resultados.
- **Testes:** Reiniciar worker, matar tarefa após IA antes de persistir, expirar lease, 429/402/5xx; medir duplicatas e memória.
- **Riscos:** Entrega pelo menos uma vez exige idempotência; não prometer exactly-once sem protocolo.

## CENY-012 — Separar documentos, extrações e deduplicação

- **Prioridade / esforço:** P1; 13 pontos. Complexidade alta: evolução do modelo e migração.
- **Problema:** Cada arquivo vira pessoa nova e um JSON corrente apaga histórico.
- **Evidência:** E01/E08/E10/E26.
- **Objetivo:** Acervo com versões, origem e vínculos confiáveis, sem mesclar pessoas indevidamente.
- **Escopo:** resume_documents, extraction_runs e checksum por empresa; guardar origem; permitir novo currículo do mesmo candidato com revisão; duplicado exato não reprocessa sem motivo; migrar legado preservando referência; ligar revisão humana.
- **Arquivos/módulos:** candidates; nova modelagem de documentos; upload/processResume; CandidateDetail.
- **Dependências:** CENY-001, CENY-006, CENY-007.
- **Critérios de aceite:** Mesmo arquivo repetido na mesma empresa é identificado; empresas distintas não revelam duplicatas entre si; nova versão não apaga anterior; homônimos não são unidos automaticamente; histórico consultável.
- **Testes:** Mesmo conteúdo/nome diferente, mesmo nome/conteúdo diferente, dupla submissão concorrente, documento corrigido, migração e contagens.
- **Riscos:** Erro de identidade e inferência de dados de outro tenant; chave de deduplicação sempre escopada.

## CENY-013 — Adicionar DOCX com extração segura

- **Prioridade / esforço:** P1; 8 pontos. Complexidade média: formato adicional e limites.
- **Problema:** Formato exigido pelos objetivos não tem caminho validado.
- **Evidência:** E10, accept .pdf,image/*; nenhuma biblioteca DOCX.
- **Objetivo:** DOCX aceito com segurança e qualidade mensurada.
- **Escopo:** Definir parser/conversor isolado com limite de descompactação; preservar texto/ordem/evidências; formato canônico de entrada do extrator; atualizar validações e UI; não confiar em suporte implícito do gateway.
- **Arquivos/módulos:** upload, validação de arquivo, extrator e benchmark.
- **Dependências:** CENY-007, CENY-011, CENY-012.
- **Critérios de aceite:** DOCX válido extrai campos e evidências; arquivo corrompido/disfarçado/bomba de compressão é rejeitado; suporte comunicado corretamente.
- **Testes:** DOCX com tabelas/colunas/links/imagens, zero texto, corrupção e limite; comparar contra anotação manual.
- **Riscos:** Vulnerabilidade de parser e perda de layout; isolar conversão e manter dependências verificadas.

## CENY-014 — Fortalecer contratos de dados e constraints

- **Prioridade / esforço:** P1; 5 pontos. Complexidade média: compatibilidade com dados existentes.
- **Problema:** Campos de domínio aceitam estados arbitrários, valores incoerentes e casts não validados.
- **Evidência:** E01/E08/E12/E14/E21/E26.
- **Objetivo:** Estado inválido não entra no banco nem quebra renderização.
- **Escopo:** Schemas compartilhados; enums/checks para estados; limites de experiências, scores e confiança; validação de datas/calendário e strings; autor atribuído pelo servidor; migração/triagem de legado inválido; não tratar ausência como zero.
- **Arquivos/módulos:** serviços CRUD; Supabase migrations/types; formulários e renderização do JSON.
- **Dependências:** CENY-001, CENY-006, CENY-010.
- **Critérios de aceite:** API direta rejeita estados/valores inválidos; resposta legada inválida é mostrada como revisão e não quebra tela; created_by confiável; calendário inválido rejeitado.
- **Testes:** Fuzz de payloads, limites numéricos, null/arrays malformados, acesso direto REST, fixtures legadas.
- **Riscos:** Constraints podem bloquear migração; auditar e colocar inválidos em revisão antes de ativar.

## CENY-015 — Corrigir erros, paginação e persistência operacional

- **Prioridade / esforço:** P1; 8 pontos. Complexidade média: várias telas com contratos comuns.
- **Problema:** Erro é exibido como vazio/carregamento; filtros só veem resposta parcial; cidade digitada não salva.
- **Evidência:** E12–E15/E22; U02.
- **Objetivo:** Usuário entende o estado real e opera sobre toda a base autorizada.
- **Escopo:** Estados isError/notFound/vazio/filtro vazio; paginação e filtros no servidor; selecionar colunas mínimas e count real; polling só para tarefas ativas; cidade manual salva sem serviço externo; sumário de upload com sucessos/falhas; invalidar caches corretos.
- **Arquivos/módulos:** CandidatesPage/CandidateDetail/JobsPage/JobDetail/UploadPage; CityAutocomplete; hooks de dados.
- **Dependências:** CENY-001, CENY-003; alinhar CENY-011.
- **Critérios de aceite:** Falha de rede nunca parece base vazia; UUID ausente retorna não encontrado; busca alcança última página; cidade manual persiste; lote totalmente falho não anuncia sucesso.
- **Testes:** E2E com offline/403/404/500, filtro vazio, dataset maior que página, salvar cidade sem provider e navegação após upload.
- **Riscos:** Ordenação instável/páginas duplicadas; usar ordenação determinística e contratos compartilhados.

## CENY-016 — Registrar auditoria e observabilidade minimizadas

- **Prioridade / esforço:** P1; 5 pontos. Complexidade média: eventos transversais e proteção de logs.
- **Problema:** Não é possível rastrear quem revisou, recalculou ou excluiu; custo/latência ausentes.
- **Evidência:** E27 e ausência de audit/usage no schema.
- **Objetivo:** Diagnosticar operações e responsabilizar ações sem expor currículo nos logs.
- **Escopo:** Eventos com organization_id, ator, recurso/run_id, ação, resultado e timestamp; métricas de duração/falha/usage; mensagens sanitizadas; acesso restrito; retenção de logs; correlação por requisição substitui estado global.
- **Arquivos/módulos:** handlers de negócio; audit_events/usage_events; error-capture/lovable-error-reporting; administração.
- **Dependências:** CENY-001; integrar CENY-006/CENY-011.
- **Critérios de aceite:** Operações sensíveis têm evento imutável/correlacionado; tokens e conteúdo de currículo ausentes dos logs; falhas localizáveis por run_id; consulta só por usuário autorizado.
- **Testes:** Fixtures de erro contendo credenciais fictícias; verificar redação; concorrência de duas requisições; acesso indevido a eventos.
- **Riscos:** Logs virarem segunda base de dados pessoais; persistir mínimo necessário.

## CENY-017 — Executar benchmark de extração e ranking

- **Prioridade / esforço:** P1; 13 pontos. Complexidade alta: corpus rotulado e revisão especializada.
- **Problema:** Não há medida de precisão, estabilidade, latência ou custo.
- **Evidência:** Documento 03; ausência de medições de IA; 47 verificações não avaliam modelo.
- **Objetivo:** Decisão de piloto baseada em qualidade mensurada.
- **Escopo:** Corpus sintético/autorizado estratificado; dois revisores; conjunto de ajuste separado do teste; pares adversos e contrafactuais; repetição; métricas por campo/critério/top-k; custo real e gate aprovado antes do teste.
- **Arquivos/módulos:** fixtures e avaliação; extrator; matching; relatório de benchmark.
- **Dependências:** CENY-004, CENY-006, CENY-009, CENY-010, CENY-012; coleta pode iniciar antes.
- **Critérios de aceite:** Relatório reproduzível por versão; falhas críticas e limites explicitados; thresholds aprovados e atingidos para piloto; nenhuma afirmação de qualidade baseada só na confiança do modelo.
- **Testes:** PDF textual/digitalizado/foto/DOCX suportado, negações, sinônimos, injeção, dados ausentes, trocas de nome e ordem; 3 repetições.
- **Riscos:** Corpus pequeno/tendencioso; reportar intervalos e segmentos, não apenas média.

## CENY-018 — Operacionalizar retenção, solicitações e restauração

- **Prioridade / esforço:** P1; 8 pontos. Complexidade alta: política organizacional e execução.
- **Problema:** Arquivamento retém dados indefinidamente; não há fluxo de direitos, descarte ou restore evidenciado.
- **Evidência:** E05/E11; documento 05.
- **Objetivo:** Retenção e eliminação executáveis com comprovação e recuperação controlada.
- **Escopo:** Definir política com responsável jurídico/privacidade; prazos por finalidade; atendimento interno de consulta/correção/exportação/eliminação; tarefas verificáveis; mapear fornecedores e backups; ensaio de restore sem dados reais; sem portal de candidato obrigatório.
- **Arquivos/módulos:** administração; lifecycle de documentos/candidatos; tarefas; auditoria; documentação operacional.
- **Dependências:** CENY-001, CENY-008, CENY-012, CENY-016.
- **Critérios de aceite:** Solicitação sintética percorre registro→decisão→execução→comprovação; retenção justificada é explícita; documentos/derivados tratados; restore mantém isolamento e não reintroduz eliminação sem controle.
- **Testes:** Expiração, retenção legal simulada, eliminação parcial/retry, restauração de backup e revalidação de exclusões.
- **Riscos:** Apagar antes do prazo ou reter além do necessário; decisões jurídicas não devem ser inferidas pelo código.

## CENY-019 — Registrar decisões e notas por vaga

- **Prioridade / esforço:** P1; 8 pontos. Complexidade média: nova relação e migração de status.
- **Problema:** Uma decisão global não representa avaliações diferentes em vagas distintas.
- **Evidência:** E12; status/observacoes globais em candidates.
- **Objetivo:** RH acompanha decisão humana por par candidato/vaga com histórico.
- **Escopo:** candidate_job_reviews; status por vaga, autor/motivo, notas append-only ou revisadas com histórico; preservar nota geral separada; política de compartilhamento por papel.
- **Arquivos/módulos:** CandidateDetail/JobDetail; nova tabela de revisões; serviços de notas.
- **Dependências:** CENY-001, CENY-009, CENY-010, CENY-016.
- **Critérios de aceite:** Mesmo candidato pode ser aprovado numa vaga e pendente noutra; alteração tem autoria; usuário leitor não altera; nota geral não é confundida com decisão local.
- **Testes:** Duas vagas/um candidato, concorrência de notas, permissões, migração de status global sem inventar decisão por vaga.
- **Riscos:** Interpretar status legado sem evidência; mantê-lo como geral até revisão explícita.

## CENY-020 — Corrigir elegibilidade de aprendizagem e dados ausentes

- **Prioridade / esforço:** P1; 5 pontos. Complexidade média: regra jurídica e revisão de RH.
- **Problema:** Regra binária inclui 24 completos, exclui desconhecido e não trata exceções.
- **Evidência:** E21; A03–A05; fontes oficiais no documento 05.
- **Objetivo:** Apoiar verificação de elegibilidade sem exclusão opaca.
- **Escopo:** Validar regra e exceções com responsável competente; estado pendente para ausência; data de referência; validar calendário; fluxo de revisão sem inferir atributos sensíveis; mostrar justificativa e permitir revisão autorizada.
- **Arquivos/módulos:** age.ts; scoring.functions.ts; badges/lista/detalhe; critérios de vaga.
- **Dependências:** CENY-004, CENY-009, CENY-014.
- **Critérios de aceite:** Limites de idade correspondem à regra aprovada; nascimento ausente não remove candidato da lista de revisão; exceções não são rejeitadas automaticamente; versão/regra/motivo registrados.
- **Testes:** Aniversários, ano bissexto, datas inválidas/futuras, 14/24 limites, mudança de data e cenários de exceção com dados sintéticos.
- **Riscos:** Codificar simplificação jurídica; não inferir deficiência nem coletar dados excessivos.

## CENY-021 — Medir consumo e aplicar limites internos

- **Prioridade / esforço:** P1; 8 pontos. Complexidade média: contabilidade de execuções e concorrência.
- **Problema:** Reprocessamento e lotes não têm consumo/cotas mensurados.
- **Evidência:** E09/E10; nenhum usage/quota no código.
- **Objetivo:** Operação comercial com custo previsível e limite por empresa.
- **Escopo:** Medição de documentos, páginas/tokens quando disponíveis, tentativas e sucesso; cotas configuráveis; limite concorrente e diário/mensal; painel interno; tratar crédito/cota antes de iniciar trabalho; cobrança externa fica fora do escopo.
- **Arquivos/módulos:** processing_tasks/usage_events; gateway; administração; upload/reprocessamento.
- **Dependências:** CENY-001, CENY-011, CENY-016.
- **Critérios de aceite:** Duas requisições concorrentes não ultrapassam quota por corrida; tentativa duplicada não duplica contagem indevida; consumo reconciliável com provedor; usuário vê limite e motivo do bloqueio.
- **Testes:** Limite exato/+1, retries, falha após cobrança, reconciliação, troca de período e tenant.
- **Riscos:** Medir errado ou bloquear trabalho já pago; definir unidade e regra de contabilização.

## CENY-022 — Comparar candidatos, criar shortlist e exportar relatório

- **Prioridade / esforço:** P2; 13 pontos. Complexidade alta: colaboração e saída de dados.
- **Problema:** RH só tem ranking, sem comparação estruturada ou relatório operacional.
- **Evidência:** E15 e tabela job_reports sem uso.
- **Objetivo:** Decisão e comunicação interna baseadas nos mesmos critérios e fontes.
- **Escopo:** Comparação lado a lado; favoritos/shortlists por vaga e usuário/empresa; relatório com versão, evidências, limitações e decisão humana; exportação PDF/CSV controlada; gestor com papel leitor. Sem envio externo automático.
- **Arquivos/módulos:** novas views de comparação; candidate_job_reviews; job_reports; exportação e autorização.
- **Dependências:** CENY-005, CENY-009, CENY-010, CENY-019.
- **Critérios de aceite:** Mesmos critérios/versão para todos comparados; exportação coincide com dados autorizados; relatório indica dados ausentes e data; links não expõem documento de outra empresa.
- **Testes:** 2–5 candidatos, campos ausentes, score obsoleto, gestor leitor, download expirado e autorização por arquivo.
- **Riscos:** Exportação circula fora do controle; minimizar PII e registrar geração/download.

## CENY-023 — Adicionar busca semântica e redescoberta

- **Prioridade / esforço:** P2; 13 pontos. Complexidade alta: indexação, autorização e avaliação de relevância.
- **Problema:** Pesquisa não recupera equivalências e recomendações de acervo.
- **Evidência:** E13/E07; somente substring/reavaliação da base.
- **Objetivo:** Recuperar perfis relevantes com fontes e filtros de empresa.
- **Escopo:** Começar com pesquisa textual estruturada; avaliar embeddings no Postgres se justificados por benchmark; indexar versões validadas com tenant; sincronizar alteração/exclusão; explicar resultado por competência/evidência; recomendação para vaga.
- **Arquivos/módulos:** pesquisa de candidatos; índice textual/vetorial se aprovado; documentos/avaliações; banco de talentos.
- **Dependências:** CENY-012, CENY-015, CENY-017, CENY-022.
- **Critérios de aceite:** Recall/top-k supera baseline no conjunto separado; nenhuma resposta cruza tenant; documento excluído sai do índice; versão humana vigente é considerada.
- **Testes:** Sinônimos, pesquisa adversarial, igualdade de permissões entre busca e detalhe, atualização/exclusão do índice, volume representativo.
- **Riscos:** Índice derivado vazar ou ficar obsoleto; aplicar RLS também ao armazenamento de embeddings.

## CENY-024 — Criar assistente interno fundamentado

- **Prioridade / esforço:** P2; 13 pontos. Complexidade alta: retrieval, autorização e contenção de alucinação.
- **Problema:** Não há consultas naturais, comparação sob demanda ou perguntas de entrevista fundamentadas.
- **Evidência:** Módulo F dos objetivos; nenhum chat/RAG encontrado.
- **Objetivo:** Assistente responde somente com base autorizada e cita fontes verificáveis.
- **Escopo:** Consultas restritas ao tenant; recuperação de documentos/avaliações; respostas com candidatos/trechos/versões; abstenção quando não há evidência; comparação e sugestões de entrevista; sem decisões autônomas ou ferramentas externas.
- **Arquivos/módulos:** nova interface de assistente; retrieval; gateway; autorização e auditoria.
- **Dependências:** CENY-017, CENY-023, CENY-016.
- **Critérios de aceite:** Cada afirmação factual tem fonte autorizada; sem evidência há abstenção; injeção em currículo não altera instruções; não rejeita/contrata/exclui por conta própria; custo e erros medidos.
- **Testes:** Perguntas fora da base, instruções maliciosas, tentativa de outro tenant, fontes removidas, comparação e avaliação humana cega.
- **Riscos:** Alucinação convincente e exposição de dados; lançar somente após benchmark e permissão de leitura rigorosa.


