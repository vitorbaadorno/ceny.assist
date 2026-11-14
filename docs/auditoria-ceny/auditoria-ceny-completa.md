# Auditoria completa da Ceny

Auditoria de 23/10/2026, consolidada a partir dos 12 documentos originais. Inclui diagnóstico, evidências, backlog e testes reproduzíveis. Os arquivos originais foram preservados.

## Índice

- [00 — Auditoria funcional da Ceny — 23/10/2026](#secao-00)
- [01 — Inventário funcional e cobertura](#secao-01)
- [02 — Auditoria técnica e catálogo de evidências](#secao-02)
- [03 — Auditoria do motor de triagem](#secao-03)
- [04 — Fluxos operacionais — design fora do escopo](#secao-04)
- [05 — Segurança, privacidade e riscos de recrutamento](#secao-05)
- [06 — Distância entre o protótipo e os objetivos da Ceny](#secao-06)
- [07 — Arquitetura proposta e transição](#secao-07)
- [08 — Roadmap priorizado](#secao-08)
- [09 — Backlog executável para implementação posterior](#secao-09)
- [10 — Testes executados, reprodução e plano de validação](#secao-10)
- [11 — Dependências externas existentes — expansão adiada](#secao-11)


---

<a id="secao-00"></a>

## 00 — Auditoria funcional da Ceny — 23/10/2026

### Conclusão

A Ceny é um protótipo com implementação real dos fluxos básicos, mas **não está pronta para operar como SaaS multiempresa nem para apresentar o ranking como triagem confiável**. A stack pode ser preservada. Os bloqueadores estão nas permissões, na qualidade das regras de pontuação e na integridade das operações.

Esta avaliação cobre o material de D:/Projetos/Ceny/ceny.assist-main, orientada por D:/Projetos/Ceny/objetivos-da-ceny.md. O pedido atual prevalece: somente auditoria, foco em funções internas, sem avaliação estética ou implementação de integrações.

Foram criados somente documentos nesta pasta do workspace. Nenhum arquivo da aplicação, configuração Git, branch, commit, migração ou dado de produção foi alterado. A referência oficial indicada pelo usuário é [vitorbaadorno/ceny.assist](https://github.com/vitorbaadorno/ceny.assist); identidade reservada para futuras alterações: Vitor Adôrno <vbatistaadorno@gmail.com>. Consulta somente de leitura encontrou HEAD/main em 58df482099e187f25ef2c154789321df8b0b1815. A pasta anexada não contém .git: sua equivalência a esse commit **não foi comprovada**.

### O que foi validado

Foram executadas **47 verificações isoladas, com 47 comportamentos confirmados**, incluindo defeitos reproduzidos. Isso não significa 47 funcionalidades aprovadas. O código de pontuação, idade e parser de IA foi executado diretamente. Upload e handlers foram executados com adaptadores simulados, sem serviços externos. O código e a metodologia estão no documento 10.

Funcionam nos testes locais: normalização de acentos/caixa, correspondência textual exata, determinismo da fórmula, cálculo de aniversários válidos, leitura de SSE em chunks, mensagens 402/429, rejeição de token ausente/malformado e caminhos sintéticos de persistência e upload em lote.

**Não há fluxo completo validado de ponta a ponta.** Autenticação real, banco, storage e extração por IA não foram acessados. A cópia não contém node_modules; build e lint não iniciaram por ausência de Vite e ESLint. Não há script de teste no projeto. Não se conclui, a partir disso, que a aplicação publicada não compila.

### O que pode ser aproveitado

- React + TanStack Start, rotas e React Query.
- Integração com Supabase Auth e encaminhamento do JWT, proteção CSRF e tipos gerados. [E19](<D:/Projetos/Ceny/ceny.assist-main/src/integrations/supabase/auth-middleware.ts:34>) [E20](<D:/Projetos/Ceny/ceny.assist-main/src/start.ts:21>)
- Separação inicial de leitura, pontuação e exclusão em funções de servidor.
- Schema estruturado de extração, representação de null, sinalização de baixa confiança e arquivo original com URL temporária. [E08](<D:/Projetos/Ceny/ceny.assist-main/src/lib/resumes.functions.ts:93>)
- Formulários de vagas, lista/detalhe de candidatos, notas, estados de processamento e confirmações de exclusão.
- Tabelas relacionais e índices existentes, como base para evolução; as políticas precisam ser substituídas por isolamento real.

### Dez problemas principais

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

### Ausências relevantes para o produto desejado

Multiempresa e papéis; revisão humana completa; versões de currículo e extrações; deduplicação; DOCX; critérios/versões de vagas; evidências rastreáveis de matching; processamento recuperável; comparação, favoritos e shortlists; relatórios; busca semântica; histórico por candidato/vaga; auditoria de acesso e consumo. Assistente de IA deve vir depois de uma base confiável. Portal de candidatos e ATS completo não são necessários.

### Maturidade (0–5)

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

### Arquitetura e ordem recomendada

Evoluir como monólito modular: frontend atual, funções de servidor, Postgres/Supabase, storage privado por empresa e worker simples com tarefas persistidas. Não é necessário reescrever tudo. Separar candidato, documento, extração, avaliação e decisão humana evita perda de histórico.

As dez primeiras tarefas propostas são: CENY-001 isolamento; CENY-002 ambiente reproduzível e testes; CENY-003 membros/papéis/cache; CENY-004 matching verificável; CENY-005 elegibilidade e ranking atômico; CENY-006 contrato da IA; CENY-007 upload seguro; CENY-008 exclusão recuperável; CENY-009 revisão humana; CENY-010 edição/versionamento de vagas. As dependências e critérios constam no backlog.

**Primeira implementação recomendada: CENY-001 — estabelecer isolamento entre empresas no banco, storage e RPCs, com testes negativos entre duas empresas fictícias.** É a condição para proteger qualquer dado que os demais fluxos manipulam. Não foi iniciada.


---

<a id="secao-01"></a>

## 01 — Inventário funcional e cobertura

### Convenções

“Funcional e validada” aplica-se somente ao comportamento isolado efetivamente testado. “Funcional com limitações” pode descrever uma função testada, nunca certificar o fluxo remoto inteiro. “Parcialmente implementada” significa que partes estão conectadas no código, com lacunas identificadas. “Não verificada” é reservada à execução que depende do ambiente. “Quebrada” exige defeito de comportamento reproduzido ou caminho estático inequívoco. Ausência é registrada como “não implementada”, distinta de uma tela puramente visual.

Todas as páginas usam React/TanStack Router; listas/mutações usam Supabase JS, React Query, componentes locais de UI e Sonner. Não foram encontrados dados de candidatos fictícios embutidos para fingir uma base real. A maior diferença entre promessa e implementação é funcionalidade incompleta e score pouco confiável.

### Rotas, ações e estados

| Funcionalidade / finalidade | Local e componentes | Serviço/dependência | Estado atual e verificação | Problema / melhoria / prioridade |
|---|---|---|---|---|
| /auth: login de RH | AuthPage, Input, Card; E16 | Supabase Auth, useAuth | Não verificada ponta a ponta; chamada real implementada | Sem vínculo a empresa/papel; testar conta autorizada e revogada. P0/P1 |
| /auth: criar acesso | E16, 58–68 | signUp + trigger profiles | Parcialmente implementada | Cadastro não exige convite/aprovação no código; disponibilidade no Auth remoto desconhecida. P0 |
| /auth: recuperar senha | E16, 52–57 | resetPasswordForEmail | Não verificada | Mensagem neutra existe; entrega e allowlist de redirect desconhecidas. P1 |
| /reset-password | ResetPasswordPage; E17 | sessão/evento/updateUser/signOut | Não verificada | Possível corrida entre evento e getSession; testar link consumido, expirado e atualização da página. P1 |
| Layout autenticado | AuthenticatedLayout, useAuth | sessão no cliente | Parcialmente implementada; guarda presente | Só exige sessão; proteger dados via RLS/membership. P0 |
| Sair | E18 e layout 68–70 | signOut | Parcialmente implementada | Resultado ignorado; cache global não limpo. P1 |
| /: lista de candidatos | CandidatesPage; E13 | candidates SELECT * | Não verificada com banco; consultas implementadas | Sem paginação; contador só representa registros retornados; erro aparece como vazio. P1 |
| Busca por nome/e-mail/skill | E13, 78–85 | Array.filter no cliente | Parcialmente implementada | Só no subconjunto carregado; sem busca semântica ou normalização de acento. P1/P2 |
| Filtro por status | E13, STATUS_FUNIL | filtro local | Parcialmente implementada | Não é filtro de processing_status; não encontra todos os registros sem paginação. P1 |
| Badge de processamento | processingLabel, E13 | processing_status | Parcialmente implementada; inspeção estática, não E2E | Qualquer estado desconhecido cai em “Dados extraídos”. Adotar enum e fallback seguro. P1 |
| /upload: upload individual/lote | UploadPage, handleFiles; E10 | Storage + candidates + processResume | Parcialmente implementada; U01–U04 testam orquestração | Sequencial, sem limite validado, sem compensação, sem retomada após fechar página. P0/P1 |
| Andamento do lote | Item/state em memória; E10 | estado React | Parcialmente implementada | Estados por arquivo existem; não é progresso persistido. Toast de sucesso mesmo com todos falhando. P1 |
| Extração PDF/foto | processResume, ai.server; E08–E09 | gateway multimodal | Não verificada quanto a qualidade/modelo remoto; P01/P05 validam handler simulado | Sem OCR local; confiança autodeclarada; validação local ausente. P0 |
| DOCX | Nenhuma interface/rotina específica | — | Não implementada | Seletor não oferece DOCX; não assumir suporte pelo input_file genérico. P1 |
| /candidatos/:id: detalhes | CandidateDetail; E12 | candidates SELECT; JSON tipado por cast | Parcialmente implementada | Dados malformados podem quebrar map/join; erro 404 vira carregamento. P1 |
| Original | openResume/getResumeUrl; E08, 174–183; E12, 131–139 | signed URL, 600 s | Não verificada no storage | URL temporária existe; bucket/políticas atuais não provam privacidade por empresa. P0 |
| Status de funil | E12, 84–95 e 207–220 | UPDATE candidates | Parcialmente implementada | Estado global do candidato, não por vaga; sem histórico/autor/transições. P1 |
| Observações internas | E12, 222–232 | UPDATE onBlur | Parcialmente implementada | Uma coluna sobrescrita, sem autoria, histórico ou confirmação persistente. P1 |
| Data de nascimento | E12, 237–252 | UPDATE + age.ts | Parcialmente implementada | Função aceita calendário inválido; banco DATE pode rejeitar; UI trata ausência como inelegível. P1 |
| Cidade | E12, 254–261; E22 | CityAutocomplete | Quebrada para persistência por digitação livre | Digitar muda estado local, salvar exige selecionar sugestão externa. Criar persistência interna explícita. P1 |
| Revisão manual | flag + campos_incertos; E08/E12 | extração/visualização | Parcialmente implementada | Sem editor de nome/contatos/skills/formação/experiências e sem concluir revisão. P1 |
| Reprocessar | rerun/processResume; E08/E12 | gateway | Parcialmente implementada; P04 | Sobrescreve cidade/nascimento; sem versão, lock, início “processando” ou invalidação de scores. P0/P1 |
| Excluir candidato | removeCandidate/archiveCandidate; E05/E11/E12 | Storage + DELETE scores + RPC | Quebrada sob falha parcial reproduzida; D01 | Arquivo já apagado quando RPC falha; dados estruturados retidos. P0 |
| /vagas: criar vaga | JobsPage, splitList; E14 | INSERT jobs | Não verificada com banco; fluxo conectado | Só required/min HTML; requisitos duplicáveis; created_by não preenchido. P1 |
| /vagas: lista/categoria | JobsPage; E14 | SELECT jobs, filtro local | Parcialmente implementada | Sem paginação e sem vazio específico de categoria. P1 |
| Editar/encerrar vaga | Ausente em JobsPage/JobDetail | status existe no schema | Não implementada | Título, critérios, pesos e status não editáveis pela UI. P1 |
| /vagas/:id: ranking | JobDetail; E15 + rankJobCandidates | candidate_scores/candidates | Funcional com limitações no cálculo isolado; fluxo remoto não verificado | Score e candidatos incorretos; perda em recálculo. P0 |
| Filtros do ranking | localFilter/minExp; E15, 100–110 | filtros locais | Parcialmente implementada | Não busca além da resposta; zero filtrado exibe mensagem “não avaliado”. P1 |
| Explicação de aderência | MatchDetails + UI E15, 232–245 | saída de scoreCandidate | Quebrada semanticamente | “Falta” é ausência de substring; sem trecho/página; não distingue evidência desconhecida. P0 |
| Jovem Aprendiz | age.ts, filtro de rank, badge | data do servidor/browser | Funcional com limitações; A01–A06 | Regra binária insuficiente; risco de exclusão inadequada. P1 |
| Excluir vaga | archiveJob; E05/E11/E15 | DELETE scores + RPC | Parcialmente implementada | Falha pode remover scores sem arquivar; sem histórico. P0 |
| Relatórios | somente tabela job_reports | schema E01/E26 | Não implementada no produto | Sem gerador, tela, resumo IA ou exportação. P2 |
| 404/erro geral | __root.tsx; server.ts | boundaries/SSR | Parcialmente implementada, não renderizada | Há fallback, mas não cobre erros ignorados do useQuery. P1 |
| Administração | Não há rota | — | Não implementada | Empresas, convites, papéis, consumo, retenção e auditoria. P0/P1 |

### Mapa interface → persistência

1. Upload: selecionar → Storage.upload → INSERT candidates → Server Function autenticada → Storage.download → Base64 → gateway IA → UPDATE candidates → feedback. As etapas não formam transação; não há compensação no upload.
2. Vaga: formulário → splitList/Number → INSERT jobs → invalidar cache/listar. Validação é predominantemente de interface.
3. Ranking: botão → carregar vaga → carregar candidatos não processando → filtrar aprendizagem → DELETE scores → calcular localmente no servidor → UPSERT → invalidar cache/exibir.
4. Revisão: visualizar → editar alguns campos via UPDATE. Não há ação para validar o conjunto extraído.
5. Exclusão: confirmação → remover arquivo (só candidato) → remover scores → RPC com privilégio elevado → ocultar registro.
6. Login: Auth → sessão no provider → libera layout; banco aplica as políticas compartilhadas descritas nas migrações.

### Componentes auxiliares e cobertura

O diretório components/ui contém componentes de infraestrutura: accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group e tooltip.

A existência de pagination, chart ou table **não representa paginação, analytics ou relatórios de produto implementados**. Nas páginas de negócio, prevalecem Card/Input/Button/Select/Badge/Textarea, Progress no ranking e AlertDialog para exclusões. Não foi executada uma bateria visual de cada componente.

CityAutocomplete é o único componente de domínio compartilhado fora dessas rotas. use-mobile é infraestrutura. Bibliotecas e componentes não alcançados pelos fluxos principais precisam de análise de bundle antes de remoção; não devem ser removidos apenas por parecerem genéricos.


---

<a id="secao-02"></a>

## 02 — Auditoria técnica e catálogo de evidências

### Escopo e procedência

Snapshot local com 108 arquivos, incluindo seis migrações SQL, sete páginas navegáveis e dois layouts. Não é um checkout Git. O workspace de entrega tinha repositório local sem arquivos de aplicação e sem remote configurado; não foi alterado o remote nem a identidade Git. O repositório oficial informado foi consultado somente por git ls-remote.

Foi lido o AGENTS.md da origem: preservação do histórico Lovable e de branches publicadas. Não houve operação Git de escrita. README e plano antigo do Lovable foram tratados como documentação histórica, não como evidência de funcionamento nem autorização para executar alterações.

### Stack encontrada (versões declaradas no package.json)

| Camada | Implementação |
|---|---|
| Frontend | React/React DOM ^19.2.0, TypeScript ^5.8.3 |
| Framework | TanStack Start 1.168.32, Router 1.170.18, router-plugin 1.168.23 |
| Estado remoto | React Query ^5.101.1 |
| UI | Radix, componentes locais estilo shadcn, Lucide, Sonner |
| Estilo | Tailwind ^4.2.1, tw-animate-css |
| Build/servidor | Vite 8.1.5, wrapper Lovable 2.26.5, Nitro 3.0.260603-beta |
| Dados/auth/storage | Supabase JS ^2.116.0; Postgres, Auth e Storage |
| Validação | Zod ^3.25.76 para entradas de Server Functions; schema JSON enviado à IA |
| IA | fetch para gateway Lovable Responses; identificador openai/gpt-6-astra no código |
| Leitura documental | Envio integral PDF/imagem em Base64 à IA; nenhuma biblioteca local de OCR/PDF/DOCX |
| Qualidade | ESLint, Prettier, TypeScript estrito; sem runner/test script/CI encontrado |
| Lockfile | bun.lock presente; README recomenda npm i; não há package-lock |
| Hospedagem | README aponta Lovable; wrapper descreve Cloudflare como alvo default; deploy real não inspecionado |

Versões acima são fatos do arquivo, não verificação de compatibilidade ou recomendação de atualização. Build não pôde ser avaliado sem dependências. Nitro beta aumenta necessidade de congelar ambiente e testar regressões, mas não prova defeito por si.

### Arquitetura atual

Navegador → React/Router/Query → Supabase diretamente para CRUD simples. Operações de IA, ranking e exclusão → TanStack Server Functions → requireSupabaseAuth → Supabase sob JWT do usuário. IA → gateway externo. Não foram encontradas Edge Functions no diretório supabase; o backend específico de negócio está nas Server Functions.

src/routes reúne apresentação, estado e queries/mutations. src/lib reúne regras e handlers. src/integrations/supabase reúne clientes, tipos e middleware. supabase/migrations define dados e RLS. O cliente administrativo service_role existe em client.server.ts, mas não foram encontradas importações dele nos fluxos de negócio. A falha principal de autorização não depende dele: as políticas dos clientes normais já são abrangentes.

### Modelagem e integridade

| Entidade | Existente | Limitação |
|---|---|---|
| profiles | perfil 1:1 com auth.users, trigger de criação | sem organização, papel ou aprovação; SELECT compartilhado |
| candidates | contatos, localização, skills, experiência, JSON, arquivo, status e notas | mistura pessoa/documento/extração; um arquivo; notas únicas; sem origem/versão/deduplicação |
| jobs | título, descrição, requisitos, experiência, formação, local e categoria | sem revisão de critérios, pesos configuráveis, templates ou edição na UI |
| candidate_scores | relação N:N por par candidato/vaga, unique, score/JSON | só avaliação corrente; sem execução/versionamento, associação de candidatura ou decisão por vaga |
| job_reports | JSON, resumo, caminho PDF, destino/data de envio | estrutura sem serviço/tela; permissão ampla |
| exclusão lógica | flags + RPCs | não equivale à eliminação; preserva dados pessoais, perde arquivo/scores |
| autoria | created_by em três tabelas | insert de candidatos/vagas não o preenche; default não o atribui |
| índices | score por vaga, status, categoria/data ativa, nascimento ativo | faltam índices por empresa futura e estratégia de pesquisa |
| constraints | PK, FKs, unique score, categoria regular/aprendiz | faltam limites de score/experiência/confiança, enums de estados e checks de conteúdo |

FKs candidato/vaga não têm escopo de organização porque a organização não existe. Ao introduzi-la, é necessário impedir ligações cruzadas também no banco, não apenas filtrar consultas do frontend. Datas de atualização já têm triggers úteis.

Migrações não criam/configuram o bucket resumes: existência, privacidade, MIME e tamanho permitidos no ambiente remoto são desconhecidos. supabase/config.toml contém somente project_id, insuficiente para reproduzir a infraestrutura toda.

### Problemas técnicos

- **Operações não atômicas:** DELETE+UPSERT do ranking; arquivo+scores+RPC na exclusão. Testes R02/D01 confirmam a sequência destrutiva sob falha simulada.
- **Estado incoerente:** reprocessamento não marca início, não guarda versão e não invalida scores; revisão humana não se conclui. P04.
- **Cache sem contexto de autorização:** chaves candidates/jobs/candidate/id não incluem sessão/empresa; logout não limpa cache. Há risco de exibir temporariamente dados da sessão anterior no mesmo navegador. Não foi reproduzido em browser. E13–E18.
- **Erros não apresentados:** queries lançam erro, mas componentes não consomem isError/error. CandidateDetail transforma erro/ausência em carregamento perpétuo; lists podem mostrar vazio falso. E12–E15.
- **Validação insuficiente:** HTML required/min não protege INSERT/UPDATE diretos. Casts de JSON não validam dados. Um JSON com arrays substituídos por objetos pode quebrar a renderização.
- **Arquivos e memória:** arquivo inteiro é carregado e convertido em string/base64 (cerca de 4/3 do tamanho binário, além das cópias). Sem limite de arquivo no handler. Não foi medido limite do runtime remoto.
- **Manutenibilidade:** CandidateDetail ~343 linhas, JobsPage ~289, JobDetail ~255; não são gigantes isoladamente, mas misturam persistência, regras e exibição. UI/sidebar tem ~744 linhas de infraestrutura; não é razão para reescrever o domínio.
- **Acoplamento:** CandidateDetail importa STATUS_FUNIL e processingLabel da rota index; mover conceitos de domínio para módulos próprios. Metadados repetidos e wrappers de fetch duplicados.
- **Observabilidade:** console e callbacks Lovable; nenhum log de domínio, correlação de execução, métricas ou trilha de decisão. Captura global de “último erro” pode correlacionar a requisição errada sob concorrência; hipótese não testada.
- **Reprodutibilidade:** lock Bun e instrução npm sem equivalência validada; faltam documentação de secrets de servidor e configuração do bucket. Nenhuma indicação de teste automatizado reproduzível no roadmap.

### Desempenho

Listas usam SELECT * e filtros locais; candidates inclui dados_extraidos e observacoes mesmo quando só exibe resumo. Polling a cada 8 s gera aproximadamente 7,5 consultas/minuto por aba ativa, com carga proporcional aos registros retornados. Não há .range/cursor/count no código. Se houver limite de linhas na API, parte da base deixa de ser considerada em busca e ranking; esse limite remoto não foi medido.

O ranking carrega todos os candidatos retornados e grava todos os scores numa requisição. Normaliza e serializa o currículo para cada vaga; complexidade cresce com candidatos × requisitos × texto, sem cache de extração/pesquisa. Upload é sequencial e subordinado à aba aberta. Nenhuma medição de p95, concorrência ou custo real foi feita.

### Ferramentas e dependências

npm run build falhou antes de compilar: Vite não instalado. npm run lint falhou antes de analisar: ESLint não instalado. npm run test --if-present retornou sem executar testes porque não há script test. Não houve typecheck completo; strict no tsconfig não equivale a tsc aprovado.

Não foi feito npm audit ou consulta atualizada de vulnerabilidades: não há instalação reproduzida e o foco permaneceu na auditoria sem alterar arquivos. Portanto, **não há conclusão de ausência de CVEs**. Não se atribuem vulnerabilidades a versões apenas por idade.

A busca de importações sugere bibliotecas candidatas a revisão, mas plugins/CSS/entrypoints podem usá-las indiretamente. Não recomendar remoção em massa. Bundle, tree shaking, consumo do servidor, CSP, backups e restauração permanecem não verificados.

### Catálogo de evidências

Os links apontam para o snapshot auditado; o intervalo citado no texto pode continuar além da primeira linha do link.

| ID | Local | Evidência |
|---|---|---|
| E01 | [supabase/migrations/20260912154905_5175285a-c995-4b66-990b-21838da63e3b.sql:2](<D:/Projetos/Ceny/ceny.assist-main/supabase/migrations/20260912154905_5175285a-c995-4b66-990b-21838da63e3b.sql:2>) | Schema inicial: profiles, candidates, jobs, candidate_scores e job_reports; RLS global nas linhas 11, 57, 77, 93 e 110; índices 112–113. |
| E02 | [supabase/migrations/20260912184557_5e8afe3e-1c97-400b-8eea-35a2ef29669a.sql:1](<D:/Projetos/Ceny/ceny.assist-main/supabase/migrations/20260912184557_5e8afe3e-1c97-400b-8eea-35a2ef29669a.sql:1>) | Exclusão lógica, nascimento e categoria; SELECT filtra excluido, sem empresa; índices parciais. |
| E03 | [supabase/migrations/20260912192910_d9889010-47a5-4e53-ac48-8fd7641adfaa.sql:1](<D:/Projetos/Ceny/ceny.assist-main/supabase/migrations/20260912192910_d9889010-47a5-4e53-ac48-8fd7641adfaa.sql:1>) | Políticas UPDATE exigem somente auth.uid() não nulo, sem proprietário ou empresa. |
| E04 | [supabase/migrations/20260912154939_df5ed327-7f73-42c6-8d12-7e7983713399.sql:2](<D:/Projetos/Ceny/ceny.assist-main/supabase/migrations/20260912154939_df5ed327-7f73-42c6-8d12-7e7983713399.sql:2>) | Storage autoriza todos os autenticados no bucket resumes; nenhum prefixo por empresa. |
| E05 | [supabase/migrations/20260912194830_69c4e287-5be1-42dc-a23a-4cccaa574052.sql:1](<D:/Projetos/Ceny/ceny.assist-main/supabase/migrations/20260912194830_69c4e287-5be1-42dc-a23a-4cccaa574052.sql:1>) | RPCs SECURITY DEFINER arquivam qualquer UUID ativo após verificar apenas login; dados pessoais permanecem. |
| E06 | [src/lib/scoring.ts:35](<D:/Projetos/Ceny/ceny.assist-main/src/lib/scoring.ts:35>) | Busca textual sobre skills + JSON completo; includes, pesos 55/20/10/8/7; não usa descrição da vaga. |
| E07 | [src/lib/scoring.functions.ts:21](<D:/Projetos/Ceny/ceny.assist-main/src/lib/scoring.functions.ts:21>) | Busca não paginada, exclui apenas processando, filtra idade, apaga scores e depois upsert. |
| E08 | [src/lib/resumes.functions.ts:93](<D:/Projetos/Ceny/ceny.assist-main/src/lib/resumes.functions.ts:93>) | Download, Base64, IA, sobrescrita de extração e erro; sem fila, exclusão mútua, validação local de saída ou preservação de correções. |
| E09 | [src/lib/ai.server.ts:22](<D:/Projetos/Ceny/ceny.assist-main/src/lib/ai.server.ts:22>) | Gateway com schema strict remoto e parser SSE próprio; JSON.parse sem validação local, timeout, retry ou verificação de sucesso terminal. |
| E10 | [src/routes/_authenticated/upload.tsx:41](<D:/Projetos/Ceny/ceny.assist-main/src/routes/_authenticated/upload.tsx:41>) | Upload sequencial pelo browser, sem validação de tamanho/conteúdo, compensação ou invalidação do cache; toast de sucesso incondicional na linha 83. |
| E11 | [src/lib/records.functions.ts:5](<D:/Projetos/Ceny/ceny.assist-main/src/lib/records.functions.ts:5>) | Exclui arquivo, exclui scores, chama RPC; operações separadas sem compensação. |
| E12 | [src/routes/_authenticated/candidatos.$id.tsx:71](<D:/Projetos/Ceny/ceny.assist-main/src/routes/_authenticated/candidatos.$id.tsx:71>) | Detalhe, status, notas, nascimento, cidade, original e reprocessamento. UPDATE 84–95; erro tratado como carregamento 116–118; edição de cidade 254–261. |
| E13 | [src/routes/_authenticated/index.tsx:65](<D:/Projetos/Ceny/ceny.assist-main/src/routes/_authenticated/index.tsx:65>) | SELECT *, polling 8 s e busca local; não usa estado de erro ou paginação. |
| E14 | [src/routes/_authenticated/vagas.index.tsx:43](<D:/Projetos/Ceny/ceny.assist-main/src/routes/_authenticated/vagas.index.tsx:43>) | Separação dos requisitos, criação direta no Supabase 76–106; listagem sem paginação, sem edição/fechamento. |
| E15 | [src/routes/_authenticated/vagas.$id.tsx:59](<D:/Projetos/Ceny/ceny.assist-main/src/routes/_authenticated/vagas.$id.tsx:59>) | Detalhe/ranking, recálculo manual, filtros locais e exclusão; erro não exibido; percentuais e rótulos Atende/Falta. |
| E16 | [src/routes/auth.tsx:48](<D:/Projetos/Ceny/ceny.assist-main/src/routes/auth.tsx:48>) | Cadastro aberto na UI, login e recuperação; nenhuma associação a organização ou convite; afirmação sobre LGPD na linha 103. |
| E17 | [src/routes/reset-password.tsx:33](<D:/Projetos/Ceny/ceny.assist-main/src/routes/reset-password.tsx:33>) | Detecção por hash/evento de recuperação; sessão consultada em paralelo; mínimo 8, versus 6 no cadastro. |
| E18 | [src/hooks/useAuth.tsx:19](<D:/Projetos/Ceny/ceny.assist-main/src/hooks/useAuth.tsx:19>) | Sessão via Supabase; signOut não limpa cache React Query nem verifica resultado; chaves globais nas rotas. |
| E19 | [src/integrations/supabase/auth-middleware.ts:34](<D:/Projetos/Ceny/ceny.assist-main/src/integrations/supabase/auth-middleware.ts:34>) | Valida configuração, Bearer e claims; propaga JWT ao Supabase; não verifica empresa/papel. |
| E20 | [src/start.ts:21](<D:/Projetos/Ceny/ceny.assist-main/src/start.ts:21>) | CSRF reinstalado para Server Functions; attachSupabaseAuth registrado. |
| E21 | [src/lib/age.ts:1](<D:/Projetos/Ceny/ceny.assist-main/src/lib/age.ts:1>) | Cálculo de idade sem validar calendário; elegibilidade entre 14 e 24 inclusive; ausente é false. |
| E22 | [src/components/city-autocomplete.tsx:34](<D:/Projetos/Ceny/ceny.assist-main/src/components/city-autocomplete.tsx:34>) | Sugestões externas; persiste cidade do candidato somente após seleção; digitação livre não chama onSelect. |
| E23 | [src/lib/maps.functions.ts:7](<D:/Projetos/Ceny/ceny.assist-main/src/lib/maps.functions.ts:7>) | Dependência existente de duas chaves de servidor e gateway de cidades; não exercitada externamente. |
| E24 | [package.json:6](<D:/Projetos/Ceny/ceny.assist-main/package.json:6>) | Scripts sem test/typecheck, build Vite; dependências/versões declaradas. |
| E25 | [vite.config.ts:1](<D:/Projetos/Ceny/ceny.assist-main/vite.config.ts:1>) | Configuração encapsulada Lovable/TanStack/Nitro; alvo Cloudflare descrito pelo wrapper. |
| E26 | [src/integrations/supabase/types.ts:17](<D:/Projetos/Ceny/ceny.assist-main/src/integrations/supabase/types.ts:17>) | Tipos gerados confirmam cinco tabelas e duas RPCs; nenhum organization_id ou membership. |
| E27 | [src/lib/lovable-error-reporting.ts:27](<D:/Projetos/Ceny/ceny.assist-main/src/lib/lovable-error-reporting.ts:27>) | Telemetria de erros e rota sem redação explícita; error-capture expande causas/stack. |
| E28 | [roadmap.md:3](<D:/Projetos/Ceny/ceny.assist-main/roadmap.md:3>) | Checklist histórico marca fluxos validados, mas RLS ainda está pendente; não substitui testes atuais. |

### Limites de inferência

RLS foi reconstruída pela ordem das seis migrações; não houve consulta ao catálogo do Postgres remoto. “Permite acesso compartilhado” descreve a configuração versionada. Nenhuma credencial privada foi exibida; foram inventariados nomes de variáveis e classes de chave. O .env entregue contém chaves Supabase publicáveis e configurações de navegador, não LOVABLE_API_KEY ou service_role. Uma chave de navegador de Maps tem classificação não verificada; não se conclui vazamento de segredo.


---

<a id="secao-03"></a>

## 03 — Auditoria do motor de triagem

### O que é IA e o que é regra

**A IA extrai o currículo; o ranking é uma fórmula determinística de texto.** Não há chamada de modelo em scoreCandidate/rankJobCandidates, embeddings, comparação semântica ou modelo que gere o percentual. E06–E09.

O identificador configurado é openai/gpt-6-astra, via gateway Lovable Responses. Não foram verificados disponibilidade, preço ou execução desse modelo no ambiente publicado. Não houve consumo de créditos nesta auditoria.

### Entrada de currículos

| Aspecto | Evidência atual | Diagnóstico |
|---|---|---|
| PDF com texto | input accept .pdf; input_file com Base64 | caminho implementado, leitura real não testada |
| PDF digitalizado | instrução pede leitura de digitalizados/fotos | depende do modelo; não há OCR separado/fallback |
| Imagens | accept image/*; input_image para MIME image | mais amplo que JPG/PNG anunciados; sem inspeção de conteúdo |
| DOCX | não oferecido no seletor, sem parser | não implementado/verificado |
| Lote | loop await por arquivo | sequência testada U04, sem paralelismo/retomada |
| Limites | só bytes.length === 0 no servidor | sem tamanho máximo, páginas, dimensões, quantidade/lote ou cota |
| Tipo | file.type, fallback por extensão | confiança em metadados; sem magic bytes/sandbox |
| Duplicados | nome sanitizado + UUID aleatório | todo upload vira novo candidato; sem hash/mesclagem |
| Armazenamento | resumes, path sem organização | autorização ampla; bucket efetivo não inspecionado |
| Falhas | erro por item e processing_error | não há compensação, fila ou retry controlado |
| Reprocessamento | botão chama mesmo handler | sem idempotência, lock, histórico ou preservação de correção |

U03 usa somente metadados fictícios de um arquivo de 1 GiB para provar que o handler não bloqueia tamanho; **não foi enviado ou criado um arquivo desse tamanho**. U01 comprova ausência de remoção compensatória após falha de INSERT no adaptador simulado.

### Extração estruturada

O schema contém nome, e-mail, telefone, nascimento, localização, formação, experiências com empresa/cargo/período/descrição, skills, idiomas, certificações, anos totais de experiência, confiança e campos incertos. Não contém resumo profissional nem projetos como campos próprios. Períodos são strings livres; não há cálculo independente de duração nem tratamento explícito de experiências sobrepostas.

São pontos positivos: strict JSON schema solicitado ao provedor; null para campos ausentes; instrução de não inventar; sinalização de revisão se faltam nome/contato ou confiança < 0,6. Testes P01/P03/P05 validam esses ramos com respostas sintéticas.

Limitações:

1. O TypeScript Extraction e o cast Json não validam a resposta em runtime. I03/I09: o helper aceita objeto incompatível e null.
2. Confiança é autodeclarada, não probabilidade calibrada. Não há confiabilidade por campo ou validação da escala 0–1.
3. campos_incertos não participa do needsReview: P02 conclui com campo incerto. A UI também não permite resolver adequadamente essa revisão.
4. Ausência de contato é representada por null, mas anos ausentes viram zero no score e na UI.
5. A extração completa é sobrescrita; não há texto/página de evidência, versão de schema/prompt/modelo, fingerprint do arquivo, tokens ou horário da execução.
6. Corrigir cidade/nascimento manualmente não protege o dado: P04 mostra sobrescrita pelo reprocessamento.
7. Não há avaliação de precisão com PDFs, fotos, tabelas, múltiplas colunas ou documentos ilegíveis.

### Fórmula atual

score = 55 × proporção de obrigatórios encontrados + 20 × proporção de desejáveis encontrados + até 10 por experiência + 8 por local + 7 por formação; arredonda e limita entre 0 e 100.

Quando não há requisitos de uma categoria, a categoria recebe pontuação cheia. Experiência e formação sem exigência também recebem todos os pontos. Um candidato vazio numa vaga vazia recebe 100. Uma vaga com apenas “Excel obrigatório” dá 45 a quem não comprova Excel, por causa dos outros grupos vazios.

O texto pesquisado contém skills e JSON.stringify(dados_extraidos), incluindo nome, e-mail e nomes das chaves. É usado includes após normalizar caixa e acentos. Descrição/título da vaga, nível de competência, recência e contexto não são avaliados. Requisitos obrigatórios não são eliminatórios: têm somente peso maior.

### Resultados reproduzidos

| Teste | Entrada resumida | Resultado do código | Consequência |
|---|---|---|---|
| S03 | JavaScript para Java | 100 e obrigatório atendido | falso positivo por substring |
| S04 | “Não possui experiência com Excel” | 100 para Excel | negação ignorada |
| S05 | nome “Ana Java” | 100 para Java | dado pessoal contamina score |
| S06 | JS para JavaScript | 45 | falso negativo por sinônimo |
| S07 | candidato e vaga vazios | 100 | falsa certeza |
| S09/S10 | cidade "" versus null, vaga Recife | true versus false | semântica inconsistente de ausência |
| S11 | ensino médio incompleto | formação atendida | nível/conclusão ignorados |
| S12 | repetir Excel em requisitos | 73 → 82 | ponderação acidental |
| S13 | chave JSON email | obrigatório “email” atendido | estrutura técnica contamina score |
| R01 | candidato em erro/revisão | incluído | resultado sem qualidade mínima |
| R02 | erro no upsert | ranking prévio já apagado | perda de avaliação |
| S15 | input repetido | resultado idêntico | fórmula determinística, ponto positivo |

Esses testes **não são benchmark do modelo de IA**. Um erro de extração pode agravar o problema, mas os falsos matches demonstrados ocorrem independentemente da IA.

### Explicabilidade e revisão humana

MatchDetails fornece listas atendido/faltante e três booleanos, sem evidência textual. A UI usa “Atende”/“Falta”; a ausência de palavra não prova ausência de competência. É necessário representar atendido, parcialmente evidenciado, evidência insuficiente e não atendido quando demonstrável; cada resultado deve guardar requisito, fonte e trecho/página.

A pontuação deve ser descrita como aderência aos critérios informados, nunca probabilidade de contratação ou sucesso. Retirar atributos pessoais irrelevantes do cálculo. Critério obrigatório deve ter semântica explícita e revisável por RH. Manter decisão humana separada e auditável.

Aprendizagem usa idade do relógio, exclui nascimento desconhecido, inclui 24 anos completos e não representa exceções. Ver E21, testes A01–A06 e documento 05. A ausência de dado não deve se transformar automaticamente em rejeição.

### Robustez do gateway

I01/I02: parser suporta deltas e linhas divididas em chunks. I06/I07/I10: mensagens para 429/402 e ausência de chave funcionam. I08: JSON inválido é rejeitado.

I04: response.failed depois de JSON completo é ignorado. Não exige response.completed; também não trata explicitamente incomplete, refused, canceled ou erro de stream. I05 mostra perda do buffer final num stream truncado sem newline; não deve ser confundido com defeito garantido de um stream SSE bem formado.

fetch não define timeout/AbortSignal, limite de saída ou retry com backoff. Não coleta usage, duração, custo ou modelo efetivo. Erros upstream têm trecho do corpo incluído na mensagem e podem ser persistidos em processing_error: risco de dados de diagnóstico inadequados à tela, não vazamento confirmado.

### Prompt injection e privacidade

Currículos são conteúdo não confiável. A instrução “nunca invente” e o schema não impedem o modelo de obedecer a instruções embutidas ou inventar skills plausíveis. Nenhum ataque foi enviado ao gateway; risco identificado por ausência de isolamento semântico e validação por evidência. Não há ferramentas de execução conectadas ao modelo neste helper; o risco demonstrável no desenho é contaminar extração/ranking, não execução remota de comandos.

Todo o documento é enviado ao fornecedor, incluindo dados irrelevantes que estejam no arquivo. Não há etapa de minimização/redação. Termos de retenção, treinamento, localização do processamento e suboperadores são não verificados.

### Melhorias recomendadas

P0: validar schema local, eventos terminais, intervalos e formatos; recusar saída inválida; timeout; erros sanitizados; limitar upload; bloquear score para extração inválida; retirar JSON bruto do matching; corrigir atomização do ranking.

P1: separar documento/extração/resultado/revisão; evidência por critério; versão de regras/prompt; fila simples com retries limitados, idempotência e consumo medido; editor humano completo; tratamento conservador de ausência.

P2: correspondência semântica por critério com evidência, usando sinônimos controlados e/ou IA como apoio. Não substituir a fórmula atual por um percentual livre de LLM. A nota final pode continuar determinística sobre critérios verificados, pesos versionados e dados ausentes explícitos.

### Benchmark proposto (não executado)

Preparar inicialmente 60–100 documentos fictícios/autorizados, balanceados entre PDFs textuais, digitalizados, fotos, duas colunas, baixa resolução, português/inglês, datas sobrepostas e lacunas. Incluir DOCX quando suportado. Rotular campos e evidências com dois revisores RH, resolver discordâncias; separar conjunto de ajuste e avaliação.

Usar 10–15 vagas com critérios claros e pares positivos/negativos; testar negações, sinônimos, requisitos duplicados, instruções maliciosas, mudança de ordem/layout e troca de nome mantendo qualificações. Repetir extração três vezes por item para estabilidade.

Medir precisão/recall de campos e competências, taxa de informação inventada, erro de datas/experiência, concordância por critério, recuperação de candidatos relevantes no top-k, estabilidade do ranking, qualidade das evidências, taxa de revisão, falhas, latência p50/p95 e custo por documento. Limiares devem ser aprovados antes da avaliação; recomendar zero informação pessoal inventada nos casos críticos e zero exclusão automática por dado desconhecido.

Custo deve usar usage real × tarifa vigente + armazenamento + tráfego + execução + retries. Não há base para estimar reais por currículo hoje. Não usar a confiança autodeclarada como métrica de acurácia.


---

<a id="secao-04"></a>

## 04 — Fluxos operacionais — design fora do escopo

Não foi avaliada estética, identidade visual, responsividade renderizada ou conformidade visual de acessibilidade. A avaliação abaixo é do comportamento implementado nos componentes. Não houve sessão de navegador com a aplicação: faltam dependências e ambiente de testes conectado. Não se afirma ter clicado nas telas.

### Avaliação por jornada

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

### Falhas específicas por tela

**Candidatos — E13:** consulta usa data=[] em falha; isError não é renderizado. “Nenhum candidato encontrado. Envie currículos” é usado inclusive quando filtros eliminam todos os resultados. O contador mostra o tamanho da resposta, não uma contagem integral da base. ProcessingLabel interpreta qualquer estado não reconhecido como sucesso. Corrigir estados não é redesenho visual.

**Detalhe — E12:** isLoading || !candidate retorna “Carregando candidato...” também após erro ou UUID inexistente. Original continua com botão mesmo sem path, porém o handler apenas retorna. window.open ocorre após await; bloqueio de popup é risco a verificar em navegador, não falha reproduzida aqui. Cidade digitada não persiste, pois apenas onSelect chama mutation. Data de nascimento e notas usam defaultValue, exigindo testes de atualização externa e navegação entre candidatos sem remontagem. Persistência por onBlur não informa salvamento pendente/último salvo de modo contínuo. Reprocessamento sem invalidação de scores deixa avaliação anterior parecer atual.

**Upload — E10:** cada item aparece “enviando” antes de começar efetivamente. Há estados de leitura/revisão/erro, mas nenhum progresso durável. Toast final incondicional reproduzido em U02. Após upload não há invalidation de candidates; a lista pode depender do refetch/polling.

**Vagas — E14:** quando existem vagas mas a categoria selecionada não possui itens, a grade fica vazia sem explicação. Cadastro não tem edição posterior. Requisitos são strings separadas por vírgula/linha/ponto e vírgula; sem tipagem, prioridade individual ou aviso de repetição.

**Ranking — E15:** ausência de scores, falha de consulta e zero resultados após filtro acabam em mensagem “Clique em Calcular aderência”. Não mostra análise obsoleta, versão ou motivo de exclusão de candidatos. Falta filtro por qualidade da extração. Mais campos aparecem ao expandir candidato, mas não há comparação dos critérios lado a lado.

**Autenticação — E16/E17/E18:** cadastro aceita mínimo de seis caracteres; redefinição exige oito. Fluxos reais de e-mail e sessão não testados. Falta tratamento explícito de falha de logout e limpeza de dados da sessão anterior. Configuração de empresa não existe.

### Estados a exigir nos testes de interface futuros

Carregando; vazio inicial; filtro sem resultado; erro de rede; sem permissão; sessão expirada; registro removido; processamento em fila/em execução/com erro/revisão/concluído; análise obsoleta; salvamento pendente; falha parcial de exclusão. Cada estado deve oferecer ação coerente, sem prometer sucesso quando não houve persistência.

Sem propor nova identidade visual: preservar navegação simples de candidatos/upload/vagas e completar os estados e operações. Testes de teclado/foco/leitor de tela são necessários para formulários, autocomplete e diálogos, mas permanecem não executados.


---

<a id="secao-05"></a>

## 05 — Segurança, privacidade e riscos de recrutamento

### Conclusão e fronteira da análise

A autenticação existe, mas **não há autorização por empresa na configuração versionada**. Isso é bloqueador P0 para SaaS B2B. Não foi feito login, exploração, leitura de dados de terceiros, alteração de banco ou teste em produção. RLS foi analisada estaticamente; o ambiente remoto pode divergir e precisa de validação posterior autorizada.

### Reconstrução das políticas

1. Migração inicial: profiles SELECT para todo authenticated; candidates, jobs, candidate_scores e job_reports com USING(true)/WITH CHECK(true). E01.
2. Migração de storage: SELECT/INSERT/UPDATE/DELETE para qualquer authenticated cujo bucket seja resumes, sem vínculo ao usuário/empresa. E04.
3. Migração de exclusão: candidatos/vagas ativos visíveis a todos os autenticados; revoga DELETE físico. E02.
4. Migração posterior: UPDATE candidatos/vagas exige somente auth.uid() não nulo. E03. O efeito exato em linhas arquivadas também depende da interação SELECT/RLS; não afirmar restauração via UPDATE sem teste SQL.
5. RPCs archive_candidate/archive_job são SECURITY DEFINER, search_path fixado e EXECUTE restrito a authenticated, mas a única autorização interna é auth.uid() não nulo; o UUID recebido não é limitado a empresa/papel. E05.

Se aplicadas como estão, essas políticas compartilham registros entre contas autenticadas. created_by não constitui isolamento: não aparece nas políticas e não é preenchido nos INSERTs principais. URLs assinadas temporárias protegem expiração, mas não corrigem permissão ampla de emitir/ler arquivos.

### Riscos e controles

| Risco | Evidência / certeza | Prioridade | Controle recomendado |
|---|---|---:|---|
| Acesso cruzado entre empresas | ausência de organização/políticas restritivas comprovada no código; incidente real não verificado | P0 | organization_id, membership, RLS em todas as tabelas e storage; FKs de mesmo tenant |
| Arquivar dados alheios | RPCs permitem qualquer usuário autenticado, sob schema auditado | P0 | autorização por tenant/papel dentro da função, além de RLS |
| Cadastro de usuário não autorizado | signUp livre na UI; configuração Auth remota desconhecida | P0 | convite/aprovação e membership ativo para acesso a dados; confirmar política de cadastro |
| Alterar scores e extrações diretamente | GRANT/UPDATE amplos e RLS compartilhada | P0 | restringir campos/superfície de escrita; scores gerados por serviço autorizado, revisões separadas |
| Arquivos arbitrários/abuso de recursos | validação ausente em código; limites do bucket desconhecidos | P0 | MIME por conteúdo, tamanho/páginas, quotas, scan/conversão isolada quando aplicável |
| Perda/retensão indevida na exclusão | D01 + E05/E11 | P0 | arquivar vs eliminar, estado de exclusão, execução idempotente e verificação das réplicas autorizadas |
| Cache entre sessões | chaves globais e ausência de clear; não testado em browser | P1 | cancelar queries e remover cache ao sair/trocar tenant; incluir contexto nas chaves |
| Uso indevido de atributos pessoais no matching | S05/S13 | P0 | permitir só atributos pertinentes e evidência de competência |
| Exclusão por nascimento desconhecido | A04 + filtro E07 | P1 | estado “verificação pendente”, revisão humana e regra legal validada |
| Prompt injection | conteúdo integral não confiável; sem ensaio contra modelo | P1 | delimitar conteúdo, validar evidências/saída, corpus adversarial e revisão |
| Informações nos erros/logs | ai.server retorna detalhe upstream; error-capture expande causas | P1 | mensagens públicas sanitizadas; logs com correlação sem currículo/token |
| Custos sem limite | ausência de quota/rate limit/idempotência no código | P1 | cotas por empresa, deduplicação de execução, limite de concorrência e alertas |
| Histórico/retensão desconhecidos | não há auditoria/TTL/exportação/eliminação na aplicação | P1 | política e execução de retenção, atendimento de solicitações e trilha minimizada |

### Controles existentes que devem permanecer

Bearer validado via getClaims e passado ao cliente Supabase de usuário; testes H01–H04 cobrem ramos com mock, não verificação criptográfica real. Proteção CSRF configurada nas Server Functions. Zod valida UUIDs de entrada. URLs de currículo assinadas por dez minutos. Trigger de criação de perfil e revogação explícita de execução pública do trigger. Search_path nas funções SQL. Broker de preview restringe origens em vez de postar sessão indiscriminadamente. Não se deve remover esses controles ao refatorar.

Não foi identificada montagem de SQL por concatenação nas queries de negócio; uso de Supabase reduz essa superfície, sem equivaler a pentest. Não foram encontrados usos de HTML bruto com conteúdo de currículo nas páginas de negócio; React renderiza strings. Cabeçalhos de segurança, CSP, CORS efetivo, controles Auth remotos e MFA não foram verificados.

### Segredos e ambientes

Inspeção do .env revelou nomes e classes de configuração, sem expor valores. As chaves Supabase presentes têm formato publicável. Não são service_role. O arquivo não inclui LOVABLE_API_KEY, GOOGLE_MAPS_API_KEY ou SUPABASE_SERVICE_ROLE_KEY, exigidas por módulos de servidor específicos. Isso impede afirmar que uma execução local completa está configurada; não prova ausência das chaves no deploy.

.gitignore não exclui .env. No snapshot há esse arquivo; sem histórico Git local, não se conclui que segredos privados foram publicados. Verificar histórico e restrições da chave de navegador em etapa autorizada. Não recomendar rotação indiscriminada de chaves publicáveis como solução para RLS permissiva.

Criptografia em repouso, backups, região, restore, retenção do fornecedor e treinamento de IA são **não verificados**. O código usa endpoints HTTPS, mas isso não certifica todos os controles do ambiente. Nenhuma CVE foi confirmada ou descartada.

### LGPD: relação técnica, sem certificação jurídica

A [LGPD consolidada, arts. 5, 6, 18, 20 e 46](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) distingue dados pessoais e sensíveis, prevê princípios de tratamento, direitos dos titulares, revisão de decisões exclusivamente automatizadas e medidas de segurança. Currículos contêm dados pessoais e podem conter dados sensíveis; não são integralmente “sensíveis” por definição.

Recomendações técnicas: minimizar dados enviados à IA; registrar finalidade, origem e versões; restringir acesso; corrigir/consultar/exportar/eliminar conforme fluxo autorizado; distinguir arquivamento de eliminação; guardar evidências da análise e da decisão humana. Avaliação jurídica deve definir bases legais, papéis controlador/operador, exceções de retenção, transferências e contratos. Não se presume consentimento como base universal nem certificação por usar Supabase.

A frase “Dados de candidatos protegidos conforme a LGPD” em auth.tsx:103 não é comprovada pelos controles auditados; deve ser revista quando a etapa de implementação for autorizada.

### Aprendizagem e idade

O código inclui idades de 14 a 24 anos completos. A [orientação do MTE de julho de 2026](https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2026/julho/aprendizagem-profissional-regras-direitos-e-funcionamento-do-contrato-de-aprendizagem) informa 14 completos a 24 incompletos. O [MTE também registra exceção ao limite de idade para pessoas com deficiência](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/aprendizagem-profissional). Portanto, o booleano atual é insuficiente; a regra final deve ser validada juridicamente e não inferir deficiência a partir do currículo.

Tratar dado desconhecido como pendência, não inelegibilidade. Definir data de referência explícita, validação de calendário, tratamento de exceções e trilha de revisão. Não solicitar dados sensíveis desnecessários como atalho para corrigir o filtro.

### Gate para operação comercial

Liberar dados reais de empresas distintas somente após testes de isolamento em banco, storage, RPCs, sessões e relatórios; nenhuma operação deve aceitar tenant enviado pelo cliente sem validar membership. Exigir política de retenção executável e procedimento de incidente/backup restaurável. Essa recomendação é resultado dos controles ausentes encontrados, não afirmação de incidente existente.


---

<a id="secao-06"></a>

## 06 — Distância entre o protótipo e os objetivos da Ceny

“Já existe” significa implementação encontrada, não certificação de produção. A execução e os limites estão no inventário e no plano de testes. A visão prioritária continua B2B, multiempresa, apoio ao RH, sem portal de candidatos e sem transformar a Ceny em ATS completo.

### A — Central de currículos

| Objetivo | Situação | Evidência / próximo passo |
|---|---|---|
| Upload individual | Precisa melhorar | E10; limite, validação e compensação |
| Upload em lote | Existe parcialmente | sequência em aba aberta; fila/retomada |
| Leitura PDF/DOCX | Existe parcialmente | PDF/imagem encaminhados à IA; DOCX ausente |
| Extração estruturada | Precisa melhorar | schema remoto, sem validação local/benchmark; E08/E09 |
| Duplicados | Precisa implementar | UUID não deduplica; hash por empresa e revisão de identidade |
| Histórico de versões | Precisa implementar | um arquivo e um JSON sobrescrito |
| Origem do currículo | Existe parcialmente | nome/path/data; sem origem de negócio |
| Correção manual | Existe parcialmente | cidade/nascimento/notas/status; demais campos sem editor |

### B — Gestão de vagas

| Objetivo | Situação | Evidência / próximo passo |
|---|---|---|
| Cadastro | Já existe | E14; persistência real não verificada |
| Importação de descrições | Existe parcialmente | textarea permite colar texto; não há importação/estruturação |
| Extração automática de requisitos | Precisa implementar | descrição não participa do score |
| Requisitos obrigatórios | Precisa melhorar | lista textual com peso 55%, sem semântica eliminatória/revisão |
| Desejáveis | Precisa melhorar | lista textual com peso fixo e duplicação |
| Pesos configuráveis | Precisa implementar | fórmula fixa E06 |
| Modelos de vaga | Precisa implementar | não há entidade/ação |
| Histórico de alterações | Precisa implementar | sem versões, sem edição na UI |
| Editar/encerrar vaga | Precisa implementar | status no schema não basta |

### C — Triagem inteligente

| Objetivo | Situação | Evidência / próximo passo |
|---|---|---|
| Matching semântico | Precisa implementar | includes sobre JSON não é semântico |
| Pontuação explicável | Existe parcialmente | fórmula/listas disponíveis, mas correspondências incorretas |
| Evidências por critério | Precisa implementar | sem trecho/página/origem |
| Resumo individual | Precisa implementar | não há campo/gerador de resumo profissional |
| Análise de lacunas | Existe parcialmente | faltantes textuais sem distinguir ausência de evidência |
| Filtros avançados | Existe parcialmente | texto/status/local/experiência; somente cliente |
| Reprocessamento | Precisa melhorar | sem versão/lock/proteção de revisão |
| Revisão humana | Existe parcialmente | decisão de funil e notas, sem validação da extração |
| Integridade de execução | Precisa implementar | nenhuma execução versionada/atômica |

### D — Comparação e colaboração

| Objetivo | Situação | Evidência / próximo passo |
|---|---|---|
| Lado a lado | Precisa implementar | somente ranking |
| Shortlists | Precisa implementar | sem associação/coleção |
| Favoritos | Precisa implementar | ausente |
| Notas internas | Precisa melhorar | coluna única sem autor/histórico; E12 |
| Exportação de relatórios | Precisa implementar | job_reports sem fluxo; E01/E26 |
| Compartilhar com gestores autorizados | Precisa implementar | sem papéis/permissões específicas |

### E — Banco de talentos

| Objetivo | Situação | Evidência / próximo passo |
|---|---|---|
| Base histórica | Existe parcialmente | candidatos persistidos, sem versões de currículo |
| Busca semântica | Precisa implementar | substring local |
| Candidato em múltiplas vagas | Existe parcialmente | scores N:N, mas sem vínculo/decisão/revisão por vaga |
| Redescoberta | Existe parcialmente | recálculo reavalia base retornada; sem busca ativa/recomendação |
| Recomendações para novas vagas | Precisa implementar | não há serviço/ação específica |

### F — Assistente de IA

| Objetivo | Situação | Dependência |
|---|---|---|
| Pesquisa em linguagem natural | Precisa implementar (P2) | base isolada, busca e evidências |
| Respostas fundamentadas | Precisa implementar (P2) | fontes/versionamento e autorização |
| Comparações sob demanda | Precisa implementar (P2) | critérios comparáveis e dados validados |
| Sugestões de entrevista | Precisa implementar (P2) | lacunas justificadas e revisão de RH |
| Explicação dos rankings | Precisa implementar (P2) | não inventar motivos de scores atuais; reconstruir evidências primeiro |

### G — Integrações

API, webhooks, CSV, armazenamento externo, ATS e LinkedIn: **não recomendado neste momento**, por escopo explícito do usuário. Nenhuma dessas integrações de importação foi localizada. Não foi feita análise de viabilidade comercial/API do LinkedIn. Autenticação Google e autocomplete já existentes são somente dependências inventariadas no documento 11.

### H — Administração

| Objetivo | Situação | Próximo passo |
|---|---|---|
| Multiempresa | Precisa implementar (P0) | organização, membership, RLS, storage e FKs |
| Usuários | Existe parcialmente | Auth/profiles; falta gestão B2B |
| Permissões | Precisa implementar (P0) | autenticação não equivale a papel/tenant |
| Configurações | Precisa implementar | critérios, retenção e limites por empresa |
| Logs/auditoria | Existe parcialmente | erros técnicos; faltam ações/decisões |
| Indicadores de uso | Precisa implementar | consumo/documentos/erros/revisões |
| Controle de processamento | Existe parcialmente | status sem execução durável |
| Preparação para cobrança | Precisa implementar | medição/cotas internas antes de gateway de cobrança |

### Ordem de valor

O MVP comercial precisa de A+B+C+H confiáveis: ingestão segura, revisão, critérios de vaga, ranking fundamentado e empresa isolada. D amplia colaboração e entrega para gestores. E/F dependem de uma base historicamente consistente. G fica fora da fase atual. Não adicionar complexidade de ATS, portal de candidato ou automação externa para compensar lacunas do núcleo.


---

<a id="secao-07"></a>

## 07 — Arquitetura proposta e transição

### Decisão

Preservar frontend e serviços gerenciados, evoluindo para um **monólito modular com tarefas persistidas**. O tamanho atual não justifica microsserviços, Kafka, banco vetorial separado ou reescrita total. A mudança estrutural indispensável é introduzir empresa, autorização e versões dos artefatos de triagem.

### Comparação

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

### Modelo mínimo de domínio

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

### Regras de autorização

organization_id NOT NULL em recursos de negócio, preenchido por contexto validado. RLS baseada em membership ativo, não em parâmetro confiado ao navegador. Relações compostas/constraints impedem associar candidato da empresa A à vaga da B. Políticas de storage verificam prefixo e vínculo. RPCs com SECURITY DEFINER verificam empresa e papel dentro da função e limitam search_path/privilégios.

Leituras diretas via Supabase podem permanecer se RLS e seleção de campos estiverem corretas. Mutação de scores, exclusão, conclusão de revisão e processamento deve passar por contrato de domínio com permissões explícitas. Service role é somente recurso interno cuidadosamente autorizado; não deve ser o atalho universal para “resolver” bloqueios de RLS.

### Processamento simples e recuperável

Criar tarefa persistida após documento registrado. Worker reivindica tarefa com lease/lock, registra tentativa e idempotency_key, baixa arquivo validado, chama extrator com timeout, valida resposta e persiste resultado versionado. Falhas transitórias têm retries limitados/backoff; falhas definitivas exigem revisão. Fechar browser não interrompe o restante do lote.

Um worker da mesma aplicação ou função programada, usando tabela Postgres, pode ser suficiente inicialmente. Só introduzir serviço dedicado de fila se limites medidos de concorrência/latência exigirem. Não prometer processamento contínuo de um job em Server Function longa sem confirmar limites do host.

### Matching e explicações

Separar extração de fatos, correspondência por critério e agregação de pontuação. Primeiro corrigir regra lexical e remover JSON/dados pessoais do corpus. Depois ampliar sinônimos/semântica com evidências. Não redistribuir peso de forma silenciosa quando dados estão ausentes: definir cobertura mínima, mostrar desconhecidos e versionar a política.

Cada avaliação aponta para documento, revisão humana e critérios vigentes. Novo upload/correção/edição de vaga torna score anterior obsoleto; recálculo cria nova execução e só publica quando completa. Leitores continuam vendo a versão anterior com indicação clara durante processamento.

### Migração e riscos

1. Reproduzir schema em ambiente isolado e inventariar volumes reais por acesso autorizado.
2. Definir empresas e ownership dos dados existentes. created_by é nulo em inserts atuais; **não inferir proprietário por e-mail/nome**. Registros ambíguos devem ser colocados em quarentena de acesso para atribuição validada.
3. Introduzir colunas/associações e fazer backfill controlado com auditoria.
4. Validar contagens, relações e políticas com duas empresas fictícias; migrar paths do storage com manifesto e checksums.
5. Ativar constraints/RLS e a aplicação compatível de modo coordenado. Falha de migração deve falhar fechada.
6. Versionar novos documentos/extrações; preservar legado com indicação de origem e limitações. Recalcular scores de forma explícita.
7. Testar restauração. Rollback pode restaurar disponibilidade sem reabrir as políticas globais inseguras.

Riscos: bloquear usuários legítimos por membership incompleto; atribuir dados ao tenant errado; quebrar links de documentos; perder revisões ao converter JSON; custos de reprocessar legado; concorrência entre código antigo/novo. Mitigar por staging, amostras verificadas, migrações aditivas, backup restaurável e gates de integridade.

### Custos relevantes

Gateway/modelo por documento e retries; armazenamento e tráfego de arquivos; leituras Postgres/polling; invocações/duração do worker; logs/backups; revisão humana. Medir antes de escolher modelos/planos. Sem usage ou volume real, qualquer cifra seria especulação. Normalizar consultas, reduzir SELECT *, eliminar uploads duplicados e reprocessamento concorrente tende a evitar custo desnecessário; economia exata não foi medida.

### Preservar, refatorar, substituir, adicionar

Preservar React/TanStack, componentes úteis, Supabase Auth, client JWT, CSRF, tipos e índices aproveitáveis. Refatorar rotas para serviços/hooks e contratos. Substituir políticas globais, score por substring irrestrita e overwrite de extração. Adicionar organizações, revisão/versionamento, tarefas, observabilidade e testes. Nada disso foi implementado nesta auditoria.


---

<a id="secao-08"></a>

## 08 — Roadmap priorizado

Este é um plano de engenharia, não autorização de implementação. As estimativas são pontos relativos: 1 = muito pequeno; 3 = pequeno; 5 = médio; 8 = grande; 13 = grande e incerto, a decompor. Não equivalem a dias, não são somadas para prometer prazo e devem ser recalibradas após acesso ao ambiente de testes.

### Fases e gates

| Fase | Escopo | Tarefas | Gate de saída |
|---|---|---|---|
| 0 — Segurança e correção | isolamento, ambiente reproduzível, autorização, score, integridade e contratos | 001–008 | duas empresas isoladas; casos adversos de score/IA/upload/exclusão corrigidos; sem perda sob falha |
| 1 — Consolidar triagem | revisão, edição de vaga, fila, versões, deduplicação, DOCX, qualidade de dados e aprendizagem | 009–014, 017, 020 | fluxo documento→extração→revisão→avaliação repetível, rastreável e recuperável |
| 2 — Operação comercial | erros/paginação/cache, observabilidade, retenção, decisões por vaga e consumo | 015–019, 021 | piloto controlado com qualidade medida, restore validado e limites de uso |
| 3 — Inteligência avançada | comparação, relatórios, busca semântica, assistente fundamentado | 022–024 | valor medido pelo RH; nenhum resultado sem fonte/permissão |
| 4 — Ecossistema | API, integrações e automações externas | deliberadamente adiado | nova decisão de escopo após núcleo confiável |

Algumas tarefas atravessam fases: 015 (erros/paginação) pode começar na fase 1; 017 (benchmark) começa cedo e só fecha com motor estabilizado; 020 (regra de aprendizagem) deve ser antecipada antes de qualquer piloto desse tipo de vaga.

### Primeira sequência de execução

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

### Dependências principais

001 → 003/007/008/010/012/016/018.
002 → 004/006 e validações das demais.
004 → 005/009/010.
006+007 → 011 (fila) e 012 (documentos/versões).
009+010+012 → 017 (benchmark final), 019 (decisões) e 022 (comparação).
011+016 → 021 (controle de consumo).
017+022 → 023 (busca semântica).
017+023 → 024 (assistente).

### Priorização e esforço

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

### Estratégia para equipe pequena

Entregar fatias verificáveis: duas empresas fictícias isoladas; um documento processado com revisão; uma vaga com score rastreável; um lote retomável. Evitar implantar ao mesmo tempo novo modelo, novo esquema de dados e nova fórmula sem comparação de resultados. Usar assistência de IA no desenvolvimento com revisão humana das políticas, migrações e regras de avaliação.


---

<a id="secao-09"></a>

## 09 — Backlog executável para implementação posterior

Nenhuma tarefa foi implementada nesta auditoria. Os IDs referenciam o catálogo de evidências do documento 02 e os testes do documento 10. Esforço em pontos relativos, não dias. Prioridade e impacto consolidados no documento 08. Integrações externas e design permanecem fora do escopo.

### CENY-001 — Implementar isolamento entre empresas

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

### CENY-002 — Estabelecer ambiente reproduzível e testes de projeto

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

### CENY-003 — Controlar membros, papéis e dados de sessão

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

### CENY-004 — Substituir matching por critérios verificáveis

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

### CENY-005 — Publicar rankings com integridade e histórico

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

### CENY-006 — Validar contrato e conclusão de respostas de IA

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

### CENY-007 — Validar uploads e eliminar órfãos

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

### CENY-008 — Separar arquivamento e eliminação recuperável

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

### CENY-009 — Completar revisão humana de dados extraídos

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

### CENY-010 — Editar e versionar vagas e critérios

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

### CENY-011 — Processar lotes por tarefas persistidas

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

### CENY-012 — Separar documentos, extrações e deduplicação

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

### CENY-013 — Adicionar DOCX com extração segura

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

### CENY-014 — Fortalecer contratos de dados e constraints

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

### CENY-015 — Corrigir erros, paginação e persistência operacional

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

### CENY-016 — Registrar auditoria e observabilidade minimizadas

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

### CENY-017 — Executar benchmark de extração e ranking

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

### CENY-018 — Operacionalizar retenção, solicitações e restauração

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

### CENY-019 — Registrar decisões e notas por vaga

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

### CENY-020 — Corrigir elegibilidade de aprendizagem e dados ausentes

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

### CENY-021 — Medir consumo e aplicar limites internos

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

### CENY-022 — Comparar candidatos, criar shortlist e exportar relatório

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

### CENY-023 — Adicionar busca semântica e redescoberta

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

### CENY-024 — Criar assistente interno fundamentado

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


---

<a id="secao-10"></a>

## 10 — Testes executados, reprodução e plano de validação

### Resultado efetivo em 23/10/2026

47 verificações isoladas, 47 comportamentos confirmados, zero falhas do harness. Parte das verificações **confirma defeitos**, não aprovação de produto. Nenhuma gravação em banco remoto, storage ou chamada de IA real ocorreu. Somente dados sintéticos em memória; nenhum currículo pessoal lido.

Node v24.19.0, PowerShell, diretório de origem D:/Projetos/Ceny/ceny.assist-main. Código TypeScript puro foi importado pelo suporte nativo do Node. Para handlers, stripTypeScriptTypes remove tipos em memória; imports são substituídos por adaptadores instrumentados. Para upload, extrai-se somente o corpo de handleFiles. Nenhum arquivo TypeScript original foi editado.

#### Alcance dos testes

- scoreCandidate e funções de idade: execução direta do arquivo original, sem mock da regra.
- callAiJson: execução direta do helper, com fetch substituído por respostas sintéticas em memória e chave fictícia do processo de teste. Não carrega .env.
- processResume, rankJobCandidates e archiveCandidate: corpo original com createServerFn/serviços simulados; validam orquestração e tratamento de falhas, **não** banco/RLS/transação real.
- handleFiles: corpo original, com React state, storage e extração simulados; não prova comportamento DOM/seletor de arquivos.
- requireSupabaseAuth: mocks de request/cliente/getClaims; não prova validação criptográfica real, expiração ou revogação.
- inputValidator dos handlers é ignorado pelo adaptador; Zod não foi exercitado. Middleware da aplicação não é exercitado pelos testes dos handlers.
- Testes de defeito usam assert do comportamento atual para provar reprodução. Na implementação futura, criar testes de regressão com o comportamento esperado corrigido.

### Resultado por verificação

| ID | Categoria | Comportamento confirmado |
|---|---|---|
| S01 | controle | Match literal = 100 |
| S02 | controle | Normaliza caixa/acentos |
| S03 | defeito | JavaScript satisfaz Java = 100 |
| S04 | defeito | Negação satisfaz Excel = 100 |
| S05 | defeito | Nome do candidato satisfaz habilidade = 100 |
| S06 | defeito | Sinônimo JS não reconhecido = 45 |
| S07 | defeito | Candidato vazio e vaga vazia = 100 |
| S08 | limitação | Nenhuma evidência do único obrigatório ainda dá 45 |
| S09 | defeito | Cidade vazia atende Recife |
| S10 | controle | Cidade nula não atende Recife |
| S11 | defeito | Ensino médio incompleto atende ensino médio |
| S12 | defeito | Duplicar requisito atendido sobe 73 para 82 |
| S13 | defeito | Nome da chave JSON atende requisito email |
| S14 | controle | Experiência proporcional gera 5/10 pontos |
| S15 | controle | Mesmo input produz mesmo resultado |
| A01 | controle | Aniversário calculado corretamente |
| A02 | controle | Limite de 14 anos do código |
| A03 | regra a revisar | Inclui idade 24, exclui 25 |
| A04 | defeito | Nascimento ausente exclui em vez de indicar revisão |
| A05 | defeito | Data inválida 2000-99-99 aceita, retorna 25 |
| A06 | controle | Data futura devolve null |
| I01 | controle | SSE delta normal é interpretado |
| I02 | controle | Chunks de transporte divididos são recombinados |
| I03 | defeito | JSON fora do schema aceito sem validação local |
| I04 | defeito | Evento response.failed após JSON é ignorado |
| I05 | robustez | Fim de stream sem newline perde buffer final (stream truncado) |
| I06 | controle | 429 tem mensagem amigável |
| I07 | controle | 402 tem mensagem amigável |
| I08 | controle | JSON inválido rejeitado |
| I09 | defeito | null aceito apesar do schema objeto |
| I10 | controle | Chave ausente falha antes de fetch |
| R01 | defeito | Erro e revisão manual são ranqueados; vaga sem critérios dá 100 |
| R02 | defeito | Ranking anterior apagado antes de falhar gravação do novo |
| D01 | defeito | Arquivo removido mesmo quando arquivamento falha depois |
| P01 | controle | Extração sintética válida persiste os campos esperados em mock |
| P02 | defeito | Campo incerto não impõe revisão quando confiança alta e contato presente |
| P03 | limitação | Confiança abaixo de 0.6 impõe revisão |
| P04 | defeito | Reprocessamento sobrescreve correções e não marca processando no início |
| P05 | controle | Arquivo vazio marca erro em mock |
| U01 | defeito | Upload seguido de falha no cadastro não remove arquivo órfão |
| U02 | defeito | Lote com 100% de erro ainda dispara toast.success |
| U03 | defeito | Handler envia arquivo de tipo arbitrário e tamanho 1 GiB (metadados simulados) |
| U04 | controle | Dois arquivos processados sequencialmente em mock |
| H01 | controle | Sem Bearer é rejeitado antes do cliente |
| H02 | controle | Token malformado é rejeitado |
| H03 | controle | Erro de verificação de claims é rejeitado (mock) |
| H04 | controle | Claims válidos propagam userId e Bearer em mock; empresa/papel não verificados |

### Comandos e resultados relevantes

| Comando/verificação | Resultado |
|---|---|
| Get-Content de objetivos, AGENTS, rotas, serviços, configurações e migrações; rg --files/rg -n | Inventário e análise estática; seis migrações lidas em ordem |
| git status --short / git remote -v no workspace, antes da auditoria | Sem arquivos de aplicação e sem remote configurado |
| git ls-remote https://github.com/vitorbaadorno/ceny.assist HEAD refs/heads/main | HEAD/main: 58df482099e187f25ef2c154789321df8b0b1815; não comparado ao snapshot |
| node --version / npm --version | v24.19.0 / 11.17.0 |
| Test-Path node_modules na origem | False |
| npm run build na origem | Não iniciou compilação: vite não reconhecido |
| npm run lint na origem | Não iniciou análise: eslint não reconhecido |
| npm run test --if-present | Nenhum teste executado; script test ausente |
| npm list --global --depth=0 | Não fornece Vite/ESLint para esse projeto; não usado como instalação de dependências |
| Harness inicial via stdin | 39 verificações confirmadas |
| Harness ampliado abaixo via stdin | 47 verificações confirmadas; 8 adicionais de upload/autenticação |
| SHA-256 de todos os arquivos da origem antes/depois | 108 originais, 108 finais, zero alterados e zero removidos |
| git status --short ao gerar relatório | Somente docs/ como não rastreado |
| Consulta pública a Planalto/MTE | Referências de LGPD/aprendizagem, sem acesso a sistemas da Ceny |

Não se executou instalação, formatter, migração, push, commit, npm audit, browser E2E ou teste contra produção. Também não se executou tsc com dependências resolvidas. A impossibilidade de build/lint é uma limitação do ambiente recebido, não diagnóstico de erro de compilação no código.

### Como reproduzir sem modificar a aplicação

Usar Node com suporte a TypeScript equivalente ao v24.19.0 e ajustar CENY_AUDIT_SOURCE somente se o snapshot mudar de local. O bloco JavaScript abaixo é o harness executado. Este comando PowerShell lê o bloco do Markdown e o envia ao Node, sem criar scripts na origem:

```powershell
$auditReport = Get-Content -Raw -LiteralPath 'C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/auditoria-ceny-completa.md'
$auditScript = [regex]::Match($auditReport, '(?s)```javascript\r?\n(.*?)\r?\n```').Groups[1].Value
$auditScript | node --input-type=module -
```

O harness modifica variáveis/fetch somente dentro do processo filho e restaura os valores ao final de cada grupo. Não utiliza credenciais do arquivo .env nem abre conexões externas. O aviso experimental de stripTypeScriptTypes é esperado.

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
const root = process.env.CENY_AUDIT_SOURCE || 'D:/Projetos/Ceny/ceny.assist-main';
const {scoreCandidate:score}=await import(pathToFileURL(path.join(root,'src/lib/scoring.ts')));
const {calculateAge:age,isYoungApprenticeEligible:eligible}=await import(pathToFileURL(path.join(root,'src/lib/age.ts')));
let passed=0,failed=0;
const results=[];
async function test(id,kind,fn){try{const detail=await fn();passed++;results.push({id,kind,result:'confirmado',detail});}catch(e){failed++;results.push({id,kind,result:'falhou',detail:e.message});}}
await test('S01','controle',()=>{assert.equal(score({skills:['Excel']},{requisitos_obrigatorios:['Excel']}).score,100);return 'Match literal = 100';});
await test('S02','controle',()=>{assert.equal(score({skills:['INGLÊS']},{requisitos_obrigatorios:['ingles']}).score,100);return 'Normaliza caixa/acentos';});
await test('S03','defeito',()=>{assert.equal(score({skills:['JavaScript']},{requisitos_obrigatorios:['Java']}).score,100);return 'JavaScript satisfaz Java = 100';});
await test('S04','defeito',()=>{assert.equal(score({dados_extraidos:{experiencias:[{descricao:'Não possui experiência com Excel'}]}},{requisitos_obrigatorios:['Excel']}).score,100);return 'Negação satisfaz Excel = 100';});
await test('S05','defeito',()=>{assert.equal(score({dados_extraidos:{nome_completo:'Ana Java'}},{requisitos_obrigatorios:['Java']}).score,100);return 'Nome do candidato satisfaz habilidade = 100';});
await test('S06','defeito',()=>{assert.equal(score({skills:['JS']},{requisitos_obrigatorios:['JavaScript']}).score,45);return 'Sinônimo JS não reconhecido = 45';});
await test('S07','defeito',()=>{assert.equal(score({},{}).score,100);return 'Candidato vazio e vaga vazia = 100';});
await test('S08','limitação',()=>{assert.equal(score({},{requisitos_obrigatorios:['Excel']}).score,45);return 'Nenhuma evidência do único obrigatório ainda dá 45';});
await test('S09','defeito',()=>{assert.equal(score({localizacao:''},{localizacao:'Recife'}).details.localizacao_ok,true);return 'Cidade vazia atende Recife';});
await test('S10','controle',()=>{assert.equal(score({localizacao:null},{localizacao:'Recife'}).details.localizacao_ok,false);return 'Cidade nula não atende Recife';});
await test('S11','defeito',()=>{assert.equal(score({dados_extraidos:{formacao_academica:[{curso:'Ensino médio incompleto'}]}},{formacao_exigida:'Ensino médio'}).details.formacao_ok,true);return 'Ensino médio incompleto atende ensino médio';});
await test('S12','defeito',()=>{const a=score({skills:['Excel']},{requisitos_obrigatorios:['Excel','SAP']}).score;const b=score({skills:['Excel']},{requisitos_obrigatorios:['Excel','Excel','SAP']}).score;assert.equal(a,73);assert.equal(b,82);return 'Duplicar requisito atendido sobe 73 para 82';});
await test('S13','defeito',()=>{const r=score({dados_extraidos:{email:'nao-informado'}},{requisitos_obrigatorios:['email']});assert.equal(r.details.obrigatorios_atendidos.length,1);return 'Nome da chave JSON atende requisito email';});
await test('S14','controle',()=>{const r=score({anos_experiencia:2},{experiencia_minima:4});assert.equal(r.score,95);return 'Experiência proporcional gera 5/10 pontos';});
await test('S15','controle',()=>{const c={skills:['Excel']},j={requisitos_obrigatorios:['Excel','SAP']};assert.deepEqual(score(c,j),score(c,j));return 'Mesmo input produz mesmo resultado';});
const today=new Date(2026,9,23,12);
await test('A01','controle',()=>{assert.equal(age('2008-10-24',today),17);assert.equal(age('2008-10-23',today),18);return 'Aniversário calculado corretamente';});
await test('A02','controle',()=>{assert.equal(eligible('2012-10-24',today),false);assert.equal(eligible('2012-10-23',today),true);return 'Limite de 14 anos do código';});
await test('A03','regra a revisar',()=>{assert.equal(eligible('2002-10-23',today),true);assert.equal(eligible('2001-10-23',today),false);return 'Inclui idade 24, exclui 25';});
await test('A04','defeito',()=>{assert.equal(eligible(null,today),false);return 'Nascimento ausente exclui em vez de indicar revisão';});
await test('A05','defeito',()=>{assert.equal(age('2000-99-99',today),25);return 'Data inválida 2000-99-99 aceita, retorna 25';});
await test('A06','controle',()=>{assert.equal(age('2030-01-01',today),null);return 'Data futura devolve null';});
const {callAiJson}=await import(pathToFileURL(path.join(root,'src/lib/ai.server.ts')));
const originalFetch=globalThis.fetch;
const originalKey=process.env.LOVABLE_API_KEY;
const aiOpts={instructions:'Somente teste sintético',parts:[],schemaName:'test',schema:{type:'object',required:['nome'],properties:{nome:{type:'string'}},additionalProperties:false}};
let fetchCalls=0;
function mockStream(parts,status=200){globalThis.fetch=async()=>{fetchCalls++;return new Response(new ReadableStream({start(c){for(const p of parts)c.enqueue(new TextEncoder().encode(p));c.close();}}),{status});};}
const event=(type,rest)=>'data: '+JSON.stringify({type,...rest})+'\n\n';
process.env.LOVABLE_API_KEY='synthetic-test-key-not-a-credential';
try{
await test('I01','controle',async()=>{mockStream([event('response.output_text.delta',{delta:'{"nome":"Teste"}'})]);assert.deepEqual(await callAiJson(aiOpts),{nome:'Teste'});return 'SSE delta normal é interpretado';});
await test('I02','controle',async()=>{const e=event('response.output_text.delta',{delta:'{"nome":"Teste"}'});mockStream([e.slice(0,9),e.slice(9,25),e.slice(25)]);assert.deepEqual(await callAiJson(aiOpts),{nome:'Teste'});return 'Chunks de transporte divididos são recombinados';});
await test('I03','defeito',async()=>{mockStream([event('response.output_text.delta',{delta:'{"campo_indevido":42}'})]);assert.deepEqual(await callAiJson(aiOpts),{campo_indevido:42});return 'JSON fora do schema aceito sem validação local';});
await test('I04','defeito',async()=>{mockStream([event('response.output_text.delta',{delta:'{"nome":"Teste"}'}),event('response.failed',{error:{message:'synthetic failure'}})]);assert.deepEqual(await callAiJson(aiOpts),{nome:'Teste'});return 'Evento response.failed após JSON é ignorado';});
await test('I05','robustez',async()=>{mockStream(['data: '+JSON.stringify({type:'response.output_text.delta',delta:'{"nome":"Teste"}'})]);await assert.rejects(()=>callAiJson(aiOpts),/não retornou dados/);return 'Fim de stream sem newline perde buffer final (stream truncado)';});
await test('I06','controle',async()=>{mockStream(['limite'],429);await assert.rejects(()=>callAiJson(aiOpts),/Muitas solicitações/);return '429 tem mensagem amigável';});
await test('I07','controle',async()=>{mockStream(['saldo'],402);await assert.rejects(()=>callAiJson(aiOpts),/créditos de IA acabaram/);return '402 tem mensagem amigável';});
await test('I08','controle',async()=>{mockStream([event('response.output_text.delta',{delta:'not json'})]);await assert.rejects(()=>callAiJson(aiOpts),SyntaxError);return 'JSON inválido rejeitado';});
await test('I09','defeito',async()=>{mockStream([event('response.output_text.delta',{delta:'null'})]);assert.equal(await callAiJson(aiOpts),null);return 'null aceito apesar do schema objeto';});
await test('I10','controle',async()=>{delete process.env.LOVABLE_API_KEY;const before=fetchCalls;await assert.rejects(()=>callAiJson(aiOpts),/não configurado/);assert.equal(fetchCalls,before);return 'Chave ausente falha antes de fetch';});
}finally{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.LOVABLE_API_KEY;else process.env.LOVABLE_API_KEY=originalKey;}
function loadHandlers(file,names,extra={}){
 const builder=()=>({middleware(){return this},inputValidator(){return this},handler(fn){return fn}});
 const source=stripTypeScriptTypes(fs.readFileSync(path.join(root,file),'utf8')).replace(/^import[^\n]*\n/gm,'').replace(/\bexport /g,'');
 const dependencies={createServerFn:builder,requireSupabaseAuth:{},scoreCandidate:score,isYoungApprenticeEligible:eligible,...extra};
 return new Function(...Object.keys(dependencies),source+'\nreturn {'+names.join(',')+'};')(...Object.values(dependencies));
}
function mockDb(responder){
 const calls=[];
 const make=(table)=>{const call={table,steps:[]};const chain=new Proxy({}, {get(_t,prop){if(prop==='then')return (resolve,reject)=>{calls.push(call);return Promise.resolve().then(()=>responder(call)).then(resolve,reject)};return(...args)=>{call.steps.push([prop,...args]);return chain}}});return chain;};
 return {calls,from:make,storage:{from(bucket){return{download(p){calls.push({download:p,bucket});return Promise.resolve(responder({download:p,bucket}))},remove(p){calls.push({remove:p,bucket});return Promise.resolve(responder({remove:p,bucket}))},createSignedUrl(p,s){calls.push({signed:p,s});return Promise.resolve(responder({signed:p,s}))}}}},rpc(name,args){calls.push({rpc:name,args});return Promise.resolve(responder({rpc:name,args}))}};
}
const {rankJobCandidates:rank}=loadHandlers('src/lib/scoring.functions.ts',['rankJobCandidates']);
await test('R01','defeito',async()=>{let rows;const db=mockDb(c=>{if(c.table==='jobs')return{data:{id:'job',categoria:'regular'},error:null};if(c.table==='candidates'){assert.deepEqual(c.steps.find(s=>s[0]==='neq'),['neq','processing_status','processando']);return{data:[{id:'erro',processing_status:'erro'},{id:'review',processing_status:'revisao_manual'}],error:null};}const u=c.steps.find(s=>s[0]==='upsert');if(u)rows=u[1];return{error:null};});assert.equal((await rank({data:{jobId:'job'},context:{supabase:db}})).count,2);assert.equal(rows[0].score,100);return 'Erro e revisão manual são ranqueados; vaga sem critérios dá 100';});
await test('R02','defeito',async()=>{let deleted=false;const db=mockDb(c=>{if(c.table==='jobs')return{data:{id:'job'},error:null};if(c.table==='candidates')return{data:[{id:'c'}],error:null};if(c.steps.some(s=>s[0]==='delete')){deleted=true;return{error:null}}return{error:{message:'synthetic upsert failure'}};});await assert.rejects(()=>rank({data:{jobId:'job'},context:{supabase:db}}),/upsert failure/);assert.equal(deleted,true);return 'Ranking anterior apagado antes de falhar gravação do novo';});
const {archiveCandidate:archive}=loadHandlers('src/lib/records.functions.ts',['archiveCandidate']);
await test('D01','defeito',async()=>{let removed=false;const db=mockDb(c=>{if(c.remove){removed=true;return{error:null}}if(c.rpc)return{error:{message:'synthetic rpc failure'}};if(c.steps.some(s=>s[0]==='select'))return{data:{id:'c',arquivo_original_path:'synthetic.pdf'},error:null};return{error:null};});await assert.rejects(()=>archive({data:{candidateId:'c'},context:{supabase:db}}),/rpc failure/);assert.equal(removed,true);return 'Arquivo removido mesmo quando arquivamento falha depois';});
const extraction={nome_completo:'Teste',email:'teste@example.invalid',telefone:null,data_nascimento:null,localizacao:'Cidade extraída',skills:['Excel'],formacao_academica:[],experiencias:[],idiomas:[],certificacoes:[],anos_experiencia_total:1,confianca:0.9,campos_incertos:[]};
const {processResume:processResume}=loadHandlers('src/lib/resumes.functions.ts',['processResume'],{callAiJson:async()=>extraction});
await test('P01','controle',async()=>{let patch;const db=mockDb(c=>{if(c.download)return{data:new Blob(['synthetic'],{type:'application/pdf'}),error:null};const u=c.steps.find(s=>s[0]==='update');if(u){patch=u[1];return{error:null}}return{data:{id:'c',arquivo_original_path:'synthetic.pdf',arquivo_nome:'synthetic.pdf'},error:null};});assert.equal((await processResume({data:{candidateId:'c'},context:{supabase:db}})).status,'concluido');assert.equal(patch.skills[0],'Excel');return 'Extração sintética válida persiste os campos esperados em mock';});
await test('P02','defeito',async()=>{extraction.campos_incertos=['telefone'];const db=mockDb(c=>c.download?{data:new Blob(['x']),error:null}:c.steps.some(s=>s[0]==='update')?{error:null}:{data:{id:'c',arquivo_original_path:'x'},error:null});assert.equal((await processResume({data:{candidateId:'c'},context:{supabase:db}})).status,'concluido');return 'Campo incerto não impõe revisão quando confiança alta e contato presente';});
await test('P03','limitação',async()=>{extraction.confianca=0.5;const db=mockDb(c=>c.download?{data:new Blob(['x']),error:null}:c.steps.some(s=>s[0]==='update')?{error:null}:{data:{id:'c',arquivo_original_path:'x'},error:null});assert.equal((await processResume({data:{candidateId:'c'},context:{supabase:db}})).status,'revisao_manual');return 'Confiança abaixo de 0.6 impõe revisão';extraction.confianca=0.9;});
await test('P04','defeito',async()=>{extraction.confianca=0.9;let patch;const db=mockDb(c=>{if(c.download)return{data:new Blob(['x']),error:null};const u=c.steps.find(s=>s[0]==='update');if(u){patch=u[1];return{error:null}}return{data:{id:'c',arquivo_original_path:'x'},error:null};});await processResume({data:{candidateId:'c'},context:{supabase:db}});assert.equal(patch.localizacao,'Cidade extraída');assert.equal(patch.data_nascimento,null);assert.equal(db.calls.some(c=>c.steps?.some(s=>s[0]==='update'&&s[1].processing_status==='processando')),false);return 'Reprocessamento sobrescreve correções e não marca processando no início';});
await test('P05','controle',async()=>{let patch;const db=mockDb(c=>{if(c.download)return{data:new Blob([]),error:null};const u=c.steps.find(s=>s[0]==='update');if(u){patch=u[1];return{error:null}}return{data:{id:'c',arquivo_original_path:'x'},error:null};});await assert.rejects(()=>processResume({data:{candidateId:'c'},context:{supabase:db}}),/vazio/);assert.equal(patch.processing_status,'erro');return 'Arquivo vazio marca erro em mock';});

function uploadHandler(db,runExtraction){
 const source=fs.readFileSync(path.join(root,'src/routes/_authenticated/upload.tsx'),'utf8');
 const begin=source.indexOf('  async function handleFiles(');
 const end=source.indexOf('\n  return (',begin);
 const body=stripTypeScriptTypes(source.slice(begin,end));
 let items=[],busy=false;const notifications=[];
 const fn=new Function('supabase','runExtraction','setItems','setBusy','toast',body+'\nreturn handleFiles;')(
  db,runExtraction,x=>{items=typeof x==='function'?x(items):x},x=>{busy=x},{success:m=>notifications.push(m)});
 return{run:fn,get:()=>({items,busy,notifications})};
}
await test('U01','defeito',async()=>{let uploaded=false;const db=mockDb(()=>({data:null,error:{message:'synthetic insert failed'}}));db.storage.from=()=>({upload:async()=>{uploaded=true;return{error:null}}});const h=uploadHandler(db,async()=>({status:'concluido'}));await h.run([{name:'synthetic.pdf',type:'application/pdf'}]);assert.equal(uploaded,true);assert.equal(h.get().items[0].state,'erro');assert.equal(db.calls.some(c=>c.remove),false);return 'Upload seguido de falha no cadastro não remove arquivo órfão';});
await test('U02','defeito',async()=>{const db=mockDb(()=>({}));db.storage.from=()=>({upload:async()=>({error:{message:'synthetic failure'}})});const h=uploadHandler(db,async()=>({status:'concluido'}));await h.run([{name:'synthetic.pdf',type:'application/pdf'}]);assert.equal(h.get().items[0].state,'erro');assert.deepEqual(h.get().notifications,['Processamento concluído.']);return 'Lote com 100% de erro ainda dispara toast.success';});
await test('U03','defeito',async()=>{let sent;const db=mockDb(()=>({data:{id:'c'},error:null}));db.storage.from=()=>({upload:async(p,file)=>{sent=file;return{error:null}}});const h=uploadHandler(db,async()=>({status:'concluido'}));await h.run([{name:'synthetic.exe',type:'application/x-msdownload',size:1024**3}]);assert.equal(sent.size,1024**3);assert.equal(h.get().items[0].state,'ok');return 'Handler envia arquivo de tipo arbitrário e tamanho 1 GiB (metadados simulados)';});
await test('U04','controle',async()=>{let active=0,max=0;const db=mockDb(()=>({data:{id:'c'},error:null}));db.storage.from=()=>({upload:async()=>({error:null})});const h=uploadHandler(db,async()=>{active++;max=Math.max(max,active);await Promise.resolve();active--;return{status:'concluido'}});await h.run([{name:'a.pdf'},{name:'b.pdf'}]);assert.equal(max,1);assert.equal(h.get().items.length,2);assert.ok(h.get().items.every(i=>i.state==='ok'));return 'Dois arquivos processados sequencialmente em mock';});
function authHandler(getRequest,createClient){
const source=stripTypeScriptTypes(fs.readFileSync(path.join(root,'src/integrations/supabase/auth-middleware.ts'),'utf8')).replace(/^import[^\n]*\n/gm,'').replace(/\bexport /g,'');
return new Function('createMiddleware','getRequest','createClient',source+'\nreturn requireSupabaseAuth;')(()=>({server:f=>f}),getRequest,createClient);
}
const savedUrl=process.env.SUPABASE_URL,savedPub=process.env.SUPABASE_PUBLISHABLE_KEY;
process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_synthetic';
try{
await test('H01','controle',async()=>{const auth=authHandler(()=>new Request('http://local.invalid'),()=>{throw Error('unexpected client')});await assert.rejects(()=>auth({next:()=>{}}),/No authorization header/);return 'Sem Bearer é rejeitado antes do cliente';});
await test('H02','controle',async()=>{const auth=authHandler(()=>new Request('http://local.invalid',{headers:{authorization:'Bearer bad'}}),()=>{throw Error('unexpected client')});await assert.rejects(()=>auth({next:()=>{}}),/Invalid token/);return 'Token malformado é rejeitado';});
await test('H03','controle',async()=>{const auth=authHandler(()=>new Request('http://local.invalid',{headers:{authorization:'Bearer a.b.c'}}),()=>({auth:{getClaims:async()=>({data:null,error:{message:'invalid'}})}}));await assert.rejects(()=>auth({next:()=>{}}),/Invalid token/);return 'Erro de verificação de claims é rejeitado (mock)';});
await test('H04','controle',async()=>{let forwarded;const auth=authHandler(()=>new Request('http://local.invalid',{headers:{authorization:'Bearer a.b.c'}}),(_u,_k,opts)=>{forwarded=opts.global.headers.Authorization;return{auth:{getClaims:async()=>({data:{claims:{sub:'synthetic-user'}},error:null})}}});const out=await auth({next:x=>x.context.userId});assert.equal(out,'synthetic-user');assert.equal(forwarded,'Bearer a.b.c');return 'Claims válidos propagam userId e Bearer em mock; empresa/papel não verificados';});
}finally{if(savedUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=savedUrl;if(savedPub===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=savedPub;}

console.log(JSON.stringify({runtime:process.version,passed,failed,results},null,2));
if(failed)process.exitCode=1;

```

### Plano restante — NÃO EXECUTADO

| Camada | Casos mínimos | Evidência necessária para aprovar |
|---|---|---|
| Build e qualidade | instalação congelada, build, lint, tsc | logs completos e versões; sem ignorar erros de tipos |
| Auth real de teste | cadastro autorizado/não autorizado, convite, confirmação, login, recuperação, link expirado, logout, revogação | E2E em ambiente isolado; nenhuma sessão residual |
| Banco/RLS | anônimo, usuário sem empresa, A/B, papéis, membership revogado, REST/RPC/storage | todos os acessos cruzados negados e próprios permitidos |
| Upload | PDF textual/escaneado, JPG/PNG, DOCX quando implementado, vazio, grande, disfarçado, duplicado, lote | conteúdo validado, erros por item, nenhuma referência/arquivo órfão |
| Extração | corpus rotulado, contato ausente, datas, sobreposição de experiência, idiomas, campos malformados | métricas e exemplos de erro por campo; sem dados inventados críticos |
| Revisão | corrigir todos os campos, conflito, salvar, concluir, reprocessar | revisão humana preservada e auditada |
| Vagas | criar, editar, fechar, duplicar requisito, invalidar análise | versão de critérios consistente |
| Matching | negação, substring, sinônimo, contexto, ausência, formação incompleta, requisitos vazios | resultados corretos com fonte e estados de evidência |
| Ranking | volume maior que página, falha de escrita, duas execuções, mudança concorrente | versão anterior mantida e nova publicada inteira |
| Exclusão | falha em cada etapa, retry, processo concorrente, eliminação de derivados | estado convergente e comprovação de limpeza autorizada |
| UI funcional | loading/erro/403/404/vazio/filtro vazio, navegação, sessão expirada, salvar cidade livre | comportamento coerente sem falso sucesso |
| Cache | A sai/B entra, troca de tenant, duas abas | nenhum dado residual visível |
| Performance | 100/1.000/10.000 candidatos sintéticos, lotes de 10/100/1.000 | p50/p95, memória, tráfego, filas e custo dentro de orçamento aprovado |
| IA adversarial | instruções dentro do currículo, contrafactuais de nome, ordem e layout | saída fundamentada, abstenção/revisão onde necessário |
| Privacidade/operação | retenção, exportação, eliminação, restore, sanitização de logs | procedimento executável e permissões preservadas |
| Dependências | scanner atualizado do lock/instalação exata e revisão de build plugins | achados atuais classificados/corrigidos, sem afirmar “sem vulnerabilidades” só por ausência de teste |

Não estabelecer SLOs ou custo por currículo como se fossem medidos. Antes do piloto, aprovar metas para tamanho de lote, latência p95, taxa de falha e orçamento. A equipe deve testar as invariantes de segurança e integridade independentemente da performance.

### Identificação do snapshot auditado

Manifesto SHA-256 calculado sem expor conteúdos/configurações secretas. Todos os 108 hashes foram comparados no encerramento da análise da origem, sem diferenças.

| Arquivo relativo à origem | SHA-256 |
|---|---|
| .env | e97e111b5f9d4acba762a86fef561831c67246c9aa871e2bcad7c223e5570ab0 |
| .gitignore | 74366d54bcd8375f43e80ebe6c1963c27bfa139cb2f384a5a4ee113a9a462e81 |
| .lovable/plan/recuperação-de-senha-jovem-aprendiz-exclusões-e-cidades-2026-09-12.md | c9e298f67435acbf30902defa033e8abbb34dbdccb71d90f7a2b0a159c82884f |
| .lovable/project.json | 58a1e159dfbd7c2be2793ec1a9320390add562236949c1cca1602012a05f221d |
| .prettierignore | 52c7c767ff0615eec4eb64cc71265877f7f423eb597d665b5e439f337c661a5a |
| .prettierrc | 1ed88d3b99eced8dc3b6f58f26645466dd1ceaca6c5a9b818531c941ac28e55b |
| AGENTS.md | 4e96b38f10a0bbf0f105f51e6d2c39a889baec12b3386ae3facec4f076714d60 |
| README.md | d69ac4e78695ec2ec13581a25b3e5edd56891b83bed918d2b0800cd05e3e01c3 |
| bun.lock | 8a8c95e98363bc27cf2e9ce4119db76175ce0a2548d5e5dfd9f5b73185a0ce9d |
| bunfig.toml | 366fc9712878c09fe0fee77df1f41a1614b45c561f673f53d9bc39a9fc7b6569 |
| components.json | 37c484818824d2521eee3367e7aa2c2abbd19635d8103d19734b6e24603d0292 |
| eslint.config.js | 3266245a1ff610a0b37dbb8b8c77b93a125e0d8758b9838cfd04b2e0a1397d56 |
| package.json | b0698c57b0e454c08e34909a7efd9b5f90cde9259639b003c4afde460c8164d5 |
| public/favicon.ico | dd821076a9b03adc2173c93956226aea3d92482d7578fc4339c5d3a2e9c24586 |
| public/robots.txt | a3d27b3ca5ce32341fa9f96f01169b521b1657c05d1860c45d1e53a6258e9e8b |
| roadmap.md | 1b7352e09c83823c2e56d4de873c027df282bd5478895a5063376fc10f6a44db |
| src/components/city-autocomplete.tsx | 9927c2d49df8ce69d446d91e1bc086e5c1f271c229bc074b730ae32f46bae44e |
| src/components/ui/accordion.tsx | 0903efcd7b746eef0a10c954a541b0dfa7aa1172f3c380a1a88f4e19a317fda3 |
| src/components/ui/alert-dialog.tsx | ee4d7f3341a1e5592787b7dac8e924bd226189492819f6704d8a7faf8fe64d20 |
| src/components/ui/alert.tsx | e7f4c2e6f78c59270905b4152b7d3ef4d5c6b9e3b2d370daa7b301aa7cbd27b3 |
| src/components/ui/aspect-ratio.tsx | d72c73d629e37995a0a71647d851d68d6fdcd7ec120797f36ab83a8ee89f2cab |
| src/components/ui/avatar.tsx | 0326c9041c5a0b1ba31ff29822c51950b6aeac485cd0985e7df714741a54e7f4 |
| src/components/ui/badge.tsx | 6519775252fe729f21c60b92c7c9feefd1fe7d0a8c2cf16d6f1c2fa7e153fe75 |
| src/components/ui/breadcrumb.tsx | d5224e87344b3ac0f8b002e5dda6a71ff8fee296db8a5fbe6b034d06bd5c2ae1 |
| src/components/ui/button.tsx | e39813b666ba434660ec088356a0349246b6803a4e99961295d0c82bab1ab862 |
| src/components/ui/calendar.tsx | e883f2245873fdf360764f77fc8f391426bef5776c6397537012c46970ebd6ee |
| src/components/ui/card.tsx | f13878a0078a5ef9f3e92af29259fc1e93ea56ea80cb992e0c4dea4e35396459 |
| src/components/ui/carousel.tsx | 568e00e8edbfab8af67ee902ca9ef5ceb6d5ed6f3045e7f9b3c15b4f7ef9e974 |
| src/components/ui/chart.tsx | 81b1f692f9334ba3030213ff37eeaf2dd762b644e5d96e51ada7072109f07430 |
| src/components/ui/checkbox.tsx | c44d02535d5c9c92807576804407dd63d01e7189dbde526e925b53885e645fd4 |
| src/components/ui/collapsible.tsx | 5f0a45d8f6ca72d37ed10bf0a85306158b67d7cbc386319186ce013ead9bc0a6 |
| src/components/ui/command.tsx | ba8c0f8b23044ce9a5066e66d7ab7be3a3c79bfc4a0ab7dfae6ffafe439145a3 |
| src/components/ui/context-menu.tsx | b299f50a0a7840b136db5670f2b2e7eec6fc62b3c06bc2ad0015800959cc381b |
| src/components/ui/dialog.tsx | e3a6de153fb15597ea95be9c4549211a297c060267787915599e3d680d476bd9 |
| src/components/ui/drawer.tsx | 478c487f66245641d5fa0f0d1c53a07d68bd60c4b3c497ec4c41ce08b482e14b |
| src/components/ui/dropdown-menu.tsx | a6b87c89f5a806225b7f3a81f13a6577289c67e5787c2a56b5a22bd1edea02ce |
| src/components/ui/form.tsx | 1ed53d4ab564a64708938643de590f2bef3718b0b2a309c1019c57e9c1fde23f |
| src/components/ui/hover-card.tsx | 69dc172ece56ac77bf3a044a1cd60ed601b0041945d16b5da4c6cc4f42116988 |
| src/components/ui/input-otp.tsx | 45b7c4fd518616f76dd611b9da13bc60bece1352e050878bf943e1cc6a4ed678 |
| src/components/ui/input.tsx | 92debb7d6d2d96d9e607a42d5ce8f37b2d63384ae5dd9ffbbf5f047b680ffb85 |
| src/components/ui/label.tsx | 9f72e2ecf16206593aa9e3c4fbc14cd8e81aa8488d57d92d4a950b30935a9fa9 |
| src/components/ui/menubar.tsx | 5bd157c3a446ea1e451867e63724b2e87ad6bba6251c8b5f1b267d1df7bd4e0e |
| src/components/ui/navigation-menu.tsx | 755aecc77b7911ab61159c9fbb9b25254009eb4c32c95b1430b6b5b7d37ed8f0 |
| src/components/ui/pagination.tsx | cbe8559c578ee2d34c7daef5ee75dc3afeb795851e294b111dec375ba44a9a2d |
| src/components/ui/popover.tsx | 861c18577ea5988c6f5ca00d1c677200319fd427cf8b424e59a5cca6ff24f830 |
| src/components/ui/progress.tsx | 418f612946a520d1380b7a0d058185bb6a6d09846846dd6d6904a0016152dd4a |
| src/components/ui/radio-group.tsx | 8c55aa0496b00a27fc4f609ca8b43a7e82c6802f6bf613998438b7632899fa96 |
| src/components/ui/resizable.tsx | f0399fec7bc334f06433b41b6ebf34255942ce4916b99173898893fa7fcc8281 |
| src/components/ui/scroll-area.tsx | b607f562455152a079d70a22538c95072b0267e0d59a1a1cf16a905a2e373a6f |
| src/components/ui/select.tsx | 6d4deee18cf7ced0354eb719300833a83caf46400de6ee9c3d1942fa4c579ad4 |
| src/components/ui/separator.tsx | bf5838b692e5f74fde7083280b99492dd402bce6966e912e79f5e23f14bc98eb |
| src/components/ui/sheet.tsx | a82f9341962e766ee925a2fe883b0a9ab5d5dd8475c402ac8e491ee37dc95fde |
| src/components/ui/sidebar.tsx | 9f44f4523271f965adec608ae1c3b8a2f350f2f45ba1401a2c7ee33bc5eda238 |
| src/components/ui/skeleton.tsx | f4c42257d73925b0b856a3500e2cbdd918fe6744fcd6be87ef28bb88e7eb7366 |
| src/components/ui/slider.tsx | d307cf3ff05b54be4a04389ef4379f9e8b4dc49720197937991ce843a8d4b5ec |
| src/components/ui/sonner.tsx | 3ad40f66c339e799b1a57c00e10b4627294c7d580d99d8a48ae0d8d4c13cf931 |
| src/components/ui/switch.tsx | c3c298df4ffb56695e4a8f0ff3e37eee08437dec542a677153ec16bed0820107 |
| src/components/ui/table.tsx | 1e945e564c2cc5ca3ef33019ba7da7a8b94cbc73feb3cbc2b7b33c36ea648d92 |
| src/components/ui/tabs.tsx | e9b454d2f987c83b36cc8870bba47d9355db4e8f5c733b310dbc1119a7d27654 |
| src/components/ui/textarea.tsx | 35617a2cf053e52c9e56983bde82d556861d38e462f9e578876c8e99a0432687 |
| src/components/ui/toggle-group.tsx | d59cd3937c967a3e221fdfcfe4ea5cd57eb97cbe37e1ac98126664c9c7db49c1 |
| src/components/ui/toggle.tsx | 62e6e21993f1ab633b9f830cbbf0c181f3d161bae3a7792dbf2d842d42a2f09c |
| src/components/ui/tooltip.tsx | 9682690fc3755d0f4b8684f2d7b1f77945876d41a45b723d0761b26804ad5010 |
| src/hooks/use-mobile.tsx | 21eff740f9e5c965c7f0782925a7e8f67ddfcdf0f58b6613550f99c3e1c454e9 |
| src/hooks/useAuth.tsx | ae9419a989a968f92832ad2adb757e53e33a87dbc4fd9d6e5a410ea28cbe966c |
| src/integrations/lovable/index.ts | 2b71954d100f88b414b15bcea1bae05450f4761727e030b3a21a0448ce9c6222 |
| src/integrations/supabase/auth-attacher.ts | 24d0dbdf8dc0fd49b391a948bd04e1db43b97a1d851acc391dd3d1b13b9797fd |
| src/integrations/supabase/auth-middleware.ts | ae40b141ce933b52252e00bfacd3e69fa7a8e6ef88a2c92809780bf7d1bb76cc |
| src/integrations/supabase/client.server.ts | 56ec7f9ac40ccdf96d8aba4f7fe33a586590ac63420b81e6cd5dc1e4777ee28e |
| src/integrations/supabase/client.ts | 73d6ad070395aa318e2667a7194b63008399a2a1f86664c8a62633b357296d6b |
| src/integrations/supabase/cron-auth.ts | 18430aa4c7faff5b44c572a8a4dfa6482daa52acbea09f384b872f087e58e738 |
| src/integrations/supabase/previewAuthStorage.ts | 5b00130146b77ecd8ed49f118c640d3e75aa7c5e76695f3b9e3f7f8833719f0a |
| src/integrations/supabase/types.ts | e9feeb4c11ebbb507ec4b34bc08cbd6a3bdb7af7c7b2480e54938cf0dbe9ac00 |
| src/lib/age.ts | f3b447e20094a3a43bc047e20320da724cb1c26e10c5612ebeea5e3499060c51 |
| src/lib/ai.server.ts | 6a298f664032f14595b137e36634858040901a8989d5c668b75e104e29cf440d |
| src/lib/error-capture.ts | d6fa7756cbc4c399f4e891b174c2dce8160e2354972c2ae68413dfd1db843088 |
| src/lib/error-page.ts | 635915886f5d44a18b6add2a53959dbe2e8ba1bb3f7e597fc714650e74157bb6 |
| src/lib/lovable-error-reporting.ts | fa4d3d0759cb8eff71be71e620d739224a4fb746babc85c6fa75408687a74857 |
| src/lib/maps.functions.ts | b75911a2bcc9fcaeeb546751a4786f3dcde19bad4022aed6bb4fea7a170534d8 |
| src/lib/records.functions.ts | 6c2a42e5860b97c2d7f6013fb43f046bccd6ca937c2eedf6b566cea09f2ae295 |
| src/lib/resumes.functions.ts | 51da3a2033b0b889d975aa9f28282e80afb96c45b95eab7376d9db90fac78f57 |
| src/lib/scoring.functions.ts | 80a7e4456694005b09536c0809881464692ccdb0868b52fd40e2d20663451a51 |
| src/lib/scoring.ts | 8c19d6acc2fca42dd7f3606f01520bb48d2decf1ed00d3e59aba39170a063b03 |
| src/lib/utils.ts | d1f1e0d62cb8d8d1e04c26e14de842d8a151f75812d81b046c65b5d1fe8e4b27 |
| src/routeTree.gen.ts | 10fb6f587f0eb32e616d95717d9dee48b233a22b2d7acdca9e0788300235be6c |
| src/router.tsx | 72b68964d3f55ba4f7dcf2a04aad9d97d7c61fabad13aec1d298f1e39ee59fcc |
| src/routes/README.md | 5c8187dbe79dac7a3c494f2600585508f5d15e75f04f21ea364d0de14de10575 |
| src/routes/__root.tsx | be38fb61f34260c674551c0c72d53f594fff03204a8184f2075ea3984f9a1fd3 |
| src/routes/_authenticated/candidatos.$id.tsx | 7f507f6f7b1e91690d7a789e29c62550e6d39885e72e7d5c490c1ef04b341a43 |
| src/routes/_authenticated/index.tsx | c379a1ba048fad652c5e918ca48420b7dd99ebdfb1eecd0d5c25246025b79eee |
| src/routes/_authenticated/route.tsx | a802347aeb67ec5b40d72d34ea7a9e18ac60cbb8070853f6e9675807dba62227 |
| src/routes/_authenticated/upload.tsx | 124c7ca288f9354014b7178217659ae270e481f14d67cb519ae543f2506ee79c |
| src/routes/_authenticated/vagas.$id.tsx | fa1b59e6359794a54f1d6cac160af9be101ee9745fcaa97008366e37f574fd19 |
| src/routes/_authenticated/vagas.index.tsx | 8d0177365b448aaccd8aea9e313b63b5a9654b0505ad78ec605285fc07d1af2d |
| src/routes/auth.tsx | 8eb65b1c6fd1ea8bc019951d14c1a888b06be3e465a677f2c639dd71b9a281e0 |
| src/routes/reset-password.tsx | df03f8db6702e26bf3a2861e7da7fba3299f0e3ae37b434c1ff26fc7b554d93f |
| src/server.ts | f0ee683067afee145f81a63a3af76b3d3767e2a1f61f0e82582f8da184ad3ef6 |
| src/start.ts | f3f07f1f6afe27708dd41bb992e3c7c470892d44a75c32eebe57abb6327ff28f |
| src/styles.css | 2776c62d6c28f3b65a8ba900920ad3363ea05527eb0932367cbe44840cba41df |
| supabase/config.toml | 2e95a44bbb41a748fbcc6924bacd0d119208cfb3fb8d55eb15c85badc9e7f7cd |
| supabase/migrations/20260912154905_5175285a-c995-4b66-990b-21838da63e3b.sql | 465a767680cc09b5e47e86c0fd1b57955e7b707ba524da89f82d05ee195f4967 |
| supabase/migrations/20260912154921_fe5f3e29-49ef-4c4b-8078-154ad5a897e7.sql | 92b16552bf8b29e4a1d77397bfce5266fe05ae060fbfc62576deef6c9a820e76 |
| supabase/migrations/20260912154939_df5ed327-7f73-42c6-8d12-7e7983713399.sql | 561fbf883a8139c9bb534312c86fcf352bdbf1ec6740710d747c8e089d35badf |
| supabase/migrations/20260912184557_5e8afe3e-1c97-400b-8eea-35a2ef29669a.sql | 5ada43668a89a44ca7038cde7e35e4a282219e9c49055101c72f456cc77ff23a |
| supabase/migrations/20260912192910_d9889010-47a5-4e53-ac48-8fd7641adfaa.sql | e30b04fba12da203285993484c5af1678eef3f6e5121e1fd4af3622b9438844c |
| supabase/migrations/20260912194830_69c4e287-5be1-42dc-a23a-4cccaa574052.sql | 91f890ac4b6f82099504cf48c11769adb1ea1c332040974f2b3c2d917b3ddded |
| tsconfig.json | 0ff5b0536ac765fe8beabcfe2202c3069c4cc43136e20e4c2f04c55f6f4ebc84 |
| vite.config.ts | 694f17daf64d3bf3481ee838ce69c26c593c60c0ed45a19209754fe5a742bcf0 |


---

<a id="secao-11"></a>

## 11 — Dependências externas existentes — expansão adiada

O pedido atual exclui foco em LinkedIn, Google e outras integrações. Este documento identifica somente dependências já presentes que afetam os fluxos internos. Não é estudo de viabilidade de novas integrações; nenhum cadastro, conexão ou chamada a essas APIs foi executado.

| Dependência existente | Uso no código | Estado nesta auditoria | Efeito no núcleo |
|---|---|---|---|
| Supabase Auth | login/cadastro/recuperação/sessão | implementação inspecionada; fluxo real não verificado | necessário para acesso e identidade |
| Supabase Postgres | candidatos/vagas/scores/perfis/relatórios | migrações/tipos lidos; catálogo remoto não consultado | persistência real não certificada |
| Supabase Storage | upload/download/URL assinada/remover | handlers simulados; bucket remoto não consultado | configuração/políticas precisam de isolamento |
| Lovable AI Gateway | extração PDF/imagem | parser testado com fetch simulado; modelo não chamado | saída/latência/qualidade/custo não verificados |
| Google OAuth por Lovable | botão de autenticação em auth.tsx | inventariado, não testado | não necessário para validar login por e-mail em staging |
| Autocomplete de cidades | maps.functions.ts + CityAutocomplete | inventariado, não testado | correção de cidade depende indevidamente de seleção externa |
| Google Fonts | stylesheet no root | não testado | dependência visual, fora do foco |
| Lovable preview/error hooks | sessão de preview e telemetria | código inspecionado | não substitui auditoria/monitoramento de domínio |

O .env entregue contém configurações publicáveis de Supabase e variáveis de navegador relacionadas ao Maps; os handlers de cidades esperam chaves de servidor não presentes nesse arquivo. Isso registra uma dependência de configuração, não comprova que o deploy esteja quebrado.

### Ajuste interno recomendado agora

Permitir digitar e salvar cidade sem depender de autocomplete. Os dados devem continuar editáveis quando um serviço auxiliar falhar. Preservar a separação de autenticação, storage e IA por adaptadores para permitir testes locais e evolução sem propagar regras de fornecedores às telas.

Não expandir integrações para compensar problemas de revisão, duplicação, autorização ou matching. Primeiro corrigir ingestão e dados internos.

### Fora do escopo

LinkedIn, ATS, armazenamento externo, e-mail de relatórios, webhooks, importação por API/CSV e gateway de cobrança. Não foram localizados fluxos de importação dessas fontes. Sem novas pesquisas de APIs/preços, propostas de scraping ou promessa de viabilidade. Quando houver pedido futuro, analisar canais oficiais, permissões e termos vigentes nessa etapa. Isso fica P3 e não bloqueia o MVP interno.
