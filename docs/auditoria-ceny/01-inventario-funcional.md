# Inventário funcional e cobertura

Referências E01–E28: [catálogo de evidências](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>). Para escopo e limites, consulte o [resumo executivo](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>).

## Convenções

“Funcional e validada” aplica-se somente ao comportamento isolado efetivamente testado. “Funcional com limitações” pode descrever uma função testada, nunca certificar o fluxo remoto inteiro. “Parcialmente implementada” significa que partes estão conectadas no código, com lacunas identificadas. “Não verificada” é reservada à execução que depende do ambiente. “Quebrada” exige defeito de comportamento reproduzido ou caminho estático inequívoco. Ausência é registrada como “não implementada”, distinta de uma tela puramente visual.

Todas as páginas usam React/TanStack Router; listas/mutações usam Supabase JS, React Query, componentes locais de UI e Sonner. Não foram encontrados dados de candidatos fictícios embutidos para fingir uma base real. A maior diferença entre promessa e implementação é funcionalidade incompleta e score pouco confiável.

## Rotas, ações e estados

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

## Mapa interface → persistência

1. Upload: selecionar → Storage.upload → INSERT candidates → Server Function autenticada → Storage.download → Base64 → gateway IA → UPDATE candidates → feedback. As etapas não formam transação; não há compensação no upload.
2. Vaga: formulário → splitList/Number → INSERT jobs → invalidar cache/listar. Validação é predominantemente de interface.
3. Ranking: botão → carregar vaga → carregar candidatos não processando → filtrar aprendizagem → DELETE scores → calcular localmente no servidor → UPSERT → invalidar cache/exibir.
4. Revisão: visualizar → editar alguns campos via UPDATE. Não há ação para validar o conjunto extraído.
5. Exclusão: confirmação → remover arquivo (só candidato) → remover scores → RPC com privilégio elevado → ocultar registro.
6. Login: Auth → sessão no provider → libera layout; banco aplica as políticas compartilhadas descritas nas migrações.

## Componentes auxiliares e cobertura

O diretório components/ui contém componentes de infraestrutura: accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group e tooltip.

A existência de pagination, chart ou table **não representa paginação, analytics ou relatórios de produto implementados**. Nas páginas de negócio, prevalecem Card/Input/Button/Select/Badge/Textarea, Progress no ranking e AlertDialog para exclusões. Não foi executada uma bateria visual de cada componente.

CityAutocomplete é o único componente de domínio compartilhado fora dessas rotas. use-mobile é infraestrutura. Bibliotecas e componentes não alcançados pelos fluxos principais precisam de análise de bundle antes de remoção; não devem ser removidos apenas por parecerem genéricos.

