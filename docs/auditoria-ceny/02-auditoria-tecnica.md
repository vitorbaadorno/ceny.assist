# Auditoria técnica e catálogo de evidências

## Escopo e procedência

Snapshot local com 108 arquivos, incluindo seis migrações SQL, sete páginas navegáveis e dois layouts. Não é um checkout Git. O workspace de entrega tinha repositório local sem arquivos de aplicação e sem remote configurado; não foi alterado o remote nem a identidade Git. O repositório oficial informado foi consultado somente por git ls-remote.

Foi lido o AGENTS.md da origem: preservação do histórico Lovable e de branches publicadas. Não houve operação Git de escrita. README e plano antigo do Lovable foram tratados como documentação histórica, não como evidência de funcionamento nem autorização para executar alterações.

## Stack encontrada (versões declaradas no package.json)

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

## Arquitetura atual

Navegador → React/Router/Query → Supabase diretamente para CRUD simples. Operações de IA, ranking e exclusão → TanStack Server Functions → requireSupabaseAuth → Supabase sob JWT do usuário. IA → gateway externo. Não foram encontradas Edge Functions no diretório supabase; o backend específico de negócio está nas Server Functions.

src/routes reúne apresentação, estado e queries/mutations. src/lib reúne regras e handlers. src/integrations/supabase reúne clientes, tipos e middleware. supabase/migrations define dados e RLS. O cliente administrativo service_role existe em client.server.ts, mas não foram encontradas importações dele nos fluxos de negócio. A falha principal de autorização não depende dele: as políticas dos clientes normais já são abrangentes.

## Modelagem e integridade

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

## Problemas técnicos

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

## Desempenho

Listas usam SELECT * e filtros locais; candidates inclui dados_extraidos e observacoes mesmo quando só exibe resumo. Polling a cada 8 s gera aproximadamente 7,5 consultas/minuto por aba ativa, com carga proporcional aos registros retornados. Não há .range/cursor/count no código. Se houver limite de linhas na API, parte da base deixa de ser considerada em busca e ranking; esse limite remoto não foi medido.

O ranking carrega todos os candidatos retornados e grava todos os scores numa requisição. Normaliza e serializa o currículo para cada vaga; complexidade cresce com candidatos × requisitos × texto, sem cache de extração/pesquisa. Upload é sequencial e subordinado à aba aberta. Nenhuma medição de p95, concorrência ou custo real foi feita.

## Ferramentas e dependências

npm run build falhou antes de compilar: Vite não instalado. npm run lint falhou antes de analisar: ESLint não instalado. npm run test --if-present retornou sem executar testes porque não há script test. Não houve typecheck completo; strict no tsconfig não equivale a tsc aprovado.

Não foi feito npm audit ou consulta atualizada de vulnerabilidades: não há instalação reproduzida e o foco permaneceu na auditoria sem alterar arquivos. Portanto, **não há conclusão de ausência de CVEs**. Não se atribuem vulnerabilidades a versões apenas por idade.

A busca de importações sugere bibliotecas candidatas a revisão, mas plugins/CSS/entrypoints podem usá-las indiretamente. Não recomendar remoção em massa. Bundle, tree shaking, consumo do servidor, CSP, backups e restauração permanecem não verificados.

## Catálogo de evidências

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

## Limites de inferência

RLS foi reconstruída pela ordem das seis migrações; não houve consulta ao catálogo do Postgres remoto. “Permite acesso compartilhado” descreve a configuração versionada. Nenhuma credencial privada foi exibida; foram inventariados nomes de variáveis e classes de chave. O .env entregue contém chaves Supabase publicáveis e configurações de navegador, não LOVABLE_API_KEY ou service_role. Uma chave de navegador de Maps tem classificação não verificada; não se conclui vazamento de segredo.

