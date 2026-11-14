# Arquitetura proposta e transição

Referências E01–E28: [catálogo de evidências](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>). Para escopo e limites, consulte o [resumo executivo](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>).

## Decisão

Preservar frontend e serviços gerenciados, evoluindo para um **monólito modular com tarefas persistidas**. O tamanho atual não justifica microsserviços, Kafka, banco vetorial separado ou reescrita total. A mudança estrutural indispensável é introduzir empresa, autorização e versões dos artefatos de triagem.

## Comparação

| Área | Atual | Proposta |
|---|---|---|
| Interface | rotas com queries/regras misturadas | mesmas rotas, hooks/serviços de domínio e estados consistentes |
| Identidade | sessão compartilhada, profiles | Auth + organizations + memberships + papéis mínimos |
| API | CRUD direto e Server Functions | leituras sob RLS; mutações sensíveis centralizadas com validação/autorização |
| Banco | candidato mistura arquivo/JSON/status | pessoa, documentos, extrações, avaliações e decisões separados |
| Storage | bucket global com permissão autenticada ampla | privado, prefixo por empresa, vínculo verificado no banco |
| Extração | arquivo → gateway → overwrite | documento imutável → execução versionada → validação → revisão |
| Matching | substring em JSON | critérios/evidências, estados de cobertura e pesos versionados |
| Execução | requisição longa/aba aberta | tabela de tarefas, worker com lease/retry/idempotência |
| Logs/custo | mensagens de erro | run_id, tenant, status, latência, usage, erro sanitizado |
| Exclusão | remove arquivo e arquiva linha | fluxo explícito arquivar/eliminar com tarefas de limpeza verificáveis |

## Modelo mínimo de domínio

- organizations e memberships: usuário, organização, papel e estado ativo. Papel inicial administrador/RH/leitor, com decisões claras para excluir, convidar, revisar e exportar.
- candidates: pessoa no contexto de uma empresa; sem identidade global compartilhada entre clientes.
- resume_documents: organization_id, candidate_id, storage path, checksum, tipo/tamanho, origem, versão e estado de retenção.
- extraction_runs: document_id, versões de schema/prompt/modelo, resultado bruto validado, evidências, status, erro sanitizado, duração e consumo.
- candidate_revisions: alterações humanas com autor, data e motivo, sem sobrescrever a fonte.
- jobs + job_versions/job_criteria: critérios normalizados, tipo obrigatório/desejável, peso e definição de evidência.
- evaluation_runs + criterion_results: versão da vaga, versão de extração/revisão, regra/modelo, score e evidência por critério.
- candidate_job_reviews: decisão humana por candidato/vaga, notas e histórico.
- processing_tasks, audit_events e usage_events: execução recuperável, trilha minimizada e métricas.

Introduzir gradualmente; não criar todas as tabelas num único deploy sem necessidade. candidate_scores pode manter a visão do resultado corrente enquanto histórico é migrado. job_reports só deve ser ativada quando existir geração/exportação autorizada.

## Regras de autorização

organization_id NOT NULL em recursos de negócio, preenchido por contexto validado. RLS baseada em membership ativo, não em parâmetro confiado ao navegador. Relações compostas/constraints impedem associar candidato da empresa A à vaga da B. Políticas de storage verificam prefixo e vínculo. RPCs com SECURITY DEFINER verificam empresa e papel dentro da função e limitam search_path/privilégios.

Leituras diretas via Supabase podem permanecer se RLS e seleção de campos estiverem corretas. Mutação de scores, exclusão, conclusão de revisão e processamento deve passar por contrato de domínio com permissões explícitas. Service role é somente recurso interno cuidadosamente autorizado; não deve ser o atalho universal para “resolver” bloqueios de RLS.

## Processamento simples e recuperável

Criar tarefa persistida após documento registrado. Worker reivindica tarefa com lease/lock, registra tentativa e idempotency_key, baixa arquivo validado, chama extrator com timeout, valida resposta e persiste resultado versionado. Falhas transitórias têm retries limitados/backoff; falhas definitivas exigem revisão. Fechar browser não interrompe o restante do lote.

Um worker da mesma aplicação ou função programada, usando tabela Postgres, pode ser suficiente inicialmente. Só introduzir serviço dedicado de fila se limites medidos de concorrência/latência exigirem. Não prometer processamento contínuo de um job em Server Function longa sem confirmar limites do host.

## Matching e explicações

Separar extração de fatos, correspondência por critério e agregação de pontuação. Primeiro corrigir regra lexical e remover JSON/dados pessoais do corpus. Depois ampliar sinônimos/semântica com evidências. Não redistribuir peso de forma silenciosa quando dados estão ausentes: definir cobertura mínima, mostrar desconhecidos e versionar a política.

Cada avaliação aponta para documento, revisão humana e critérios vigentes. Novo upload/correção/edição de vaga torna score anterior obsoleto; recálculo cria nova execução e só publica quando completa. Leitores continuam vendo a versão anterior com indicação clara durante processamento.

## Migração e riscos

1. Reproduzir schema em ambiente isolado e inventariar volumes reais por acesso autorizado.
2. Definir empresas e ownership dos dados existentes. created_by é nulo em inserts atuais; **não inferir proprietário por e-mail/nome**. Registros ambíguos devem ser colocados em quarentena de acesso para atribuição validada.
3. Introduzir colunas/associações e fazer backfill controlado com auditoria.
4. Validar contagens, relações e políticas com duas empresas fictícias; migrar paths do storage com manifesto e checksums.
5. Ativar constraints/RLS e a aplicação compatível de modo coordenado. Falha de migração deve falhar fechada.
6. Versionar novos documentos/extrações; preservar legado com indicação de origem e limitações. Recalcular scores de forma explícita.
7. Testar restauração. Rollback pode restaurar disponibilidade sem reabrir as políticas globais inseguras.

Riscos: bloquear usuários legítimos por membership incompleto; atribuir dados ao tenant errado; quebrar links de documentos; perder revisões ao converter JSON; custos de reprocessar legado; concorrência entre código antigo/novo. Mitigar por staging, amostras verificadas, migrações aditivas, backup restaurável e gates de integridade.

## Custos relevantes

Gateway/modelo por documento e retries; armazenamento e tráfego de arquivos; leituras Postgres/polling; invocações/duração do worker; logs/backups; revisão humana. Medir antes de escolher modelos/planos. Sem usage ou volume real, qualquer cifra seria especulação. Normalizar consultas, reduzir SELECT *, eliminar uploads duplicados e reprocessamento concorrente tende a evitar custo desnecessário; economia exata não foi medida.

## Preservar, refatorar, substituir, adicionar

Preservar React/TanStack, componentes úteis, Supabase Auth, client JWT, CSRF, tipos e índices aproveitáveis. Refatorar rotas para serviços/hooks e contratos. Substituir políticas globais, score por substring irrestrita e overwrite de extração. Adicionar organizações, revisão/versionamento, tarefas, observabilidade e testes. Nada disso foi implementado nesta auditoria.

