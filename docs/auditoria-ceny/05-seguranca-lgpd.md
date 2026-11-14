# Segurança, privacidade e riscos de recrutamento

Referências E01–E28: [catálogo de evidências](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>). Para escopo e limites, consulte o [resumo executivo](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>).

## Conclusão e fronteira da análise

A autenticação existe, mas **não há autorização por empresa na configuração versionada**. Isso é bloqueador P0 para SaaS B2B. Não foi feito login, exploração, leitura de dados de terceiros, alteração de banco ou teste em produção. RLS foi analisada estaticamente; o ambiente remoto pode divergir e precisa de validação posterior autorizada.

## Reconstrução das políticas

1. Migração inicial: profiles SELECT para todo authenticated; candidates, jobs, candidate_scores e job_reports com USING(true)/WITH CHECK(true). E01.
2. Migração de storage: SELECT/INSERT/UPDATE/DELETE para qualquer authenticated cujo bucket seja resumes, sem vínculo ao usuário/empresa. E04.
3. Migração de exclusão: candidatos/vagas ativos visíveis a todos os autenticados; revoga DELETE físico. E02.
4. Migração posterior: UPDATE candidatos/vagas exige somente auth.uid() não nulo. E03. O efeito exato em linhas arquivadas também depende da interação SELECT/RLS; não afirmar restauração via UPDATE sem teste SQL.
5. RPCs archive_candidate/archive_job são SECURITY DEFINER, search_path fixado e EXECUTE restrito a authenticated, mas a única autorização interna é auth.uid() não nulo; o UUID recebido não é limitado a empresa/papel. E05.

Se aplicadas como estão, essas políticas compartilham registros entre contas autenticadas. created_by não constitui isolamento: não aparece nas políticas e não é preenchido nos INSERTs principais. URLs assinadas temporárias protegem expiração, mas não corrigem permissão ampla de emitir/ler arquivos.

## Riscos e controles

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

## Controles existentes que devem permanecer

Bearer validado via getClaims e passado ao cliente Supabase de usuário; testes H01–H04 cobrem ramos com mock, não verificação criptográfica real. Proteção CSRF configurada nas Server Functions. Zod valida UUIDs de entrada. URLs de currículo assinadas por dez minutos. Trigger de criação de perfil e revogação explícita de execução pública do trigger. Search_path nas funções SQL. Broker de preview restringe origens em vez de postar sessão indiscriminadamente. Não se deve remover esses controles ao refatorar.

Não foi identificada montagem de SQL por concatenação nas queries de negócio; uso de Supabase reduz essa superfície, sem equivaler a pentest. Não foram encontrados usos de HTML bruto com conteúdo de currículo nas páginas de negócio; React renderiza strings. Cabeçalhos de segurança, CSP, CORS efetivo, controles Auth remotos e MFA não foram verificados.

## Segredos e ambientes

Inspeção do .env revelou nomes e classes de configuração, sem expor valores. As chaves Supabase presentes têm formato publicável. Não são service_role. O arquivo não inclui LOVABLE_API_KEY, GOOGLE_MAPS_API_KEY ou SUPABASE_SERVICE_ROLE_KEY, exigidas por módulos de servidor específicos. Isso impede afirmar que uma execução local completa está configurada; não prova ausência das chaves no deploy.

.gitignore não exclui .env. No snapshot há esse arquivo; sem histórico Git local, não se conclui que segredos privados foram publicados. Verificar histórico e restrições da chave de navegador em etapa autorizada. Não recomendar rotação indiscriminada de chaves publicáveis como solução para RLS permissiva.

Criptografia em repouso, backups, região, restore, retenção do fornecedor e treinamento de IA são **não verificados**. O código usa endpoints HTTPS, mas isso não certifica todos os controles do ambiente. Nenhuma CVE foi confirmada ou descartada.

## LGPD: relação técnica, sem certificação jurídica

A [LGPD consolidada, arts. 5, 6, 18, 20 e 46](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) distingue dados pessoais e sensíveis, prevê princípios de tratamento, direitos dos titulares, revisão de decisões exclusivamente automatizadas e medidas de segurança. Currículos contêm dados pessoais e podem conter dados sensíveis; não são integralmente “sensíveis” por definição.

Recomendações técnicas: minimizar dados enviados à IA; registrar finalidade, origem e versões; restringir acesso; corrigir/consultar/exportar/eliminar conforme fluxo autorizado; distinguir arquivamento de eliminação; guardar evidências da análise e da decisão humana. Avaliação jurídica deve definir bases legais, papéis controlador/operador, exceções de retenção, transferências e contratos. Não se presume consentimento como base universal nem certificação por usar Supabase.

A frase “Dados de candidatos protegidos conforme a LGPD” em auth.tsx:103 não é comprovada pelos controles auditados; deve ser revista quando a etapa de implementação for autorizada.

## Aprendizagem e idade

O código inclui idades de 14 a 24 anos completos. A [orientação do MTE de julho de 2026](https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2026/julho/aprendizagem-profissional-regras-direitos-e-funcionamento-do-contrato-de-aprendizagem) informa 14 completos a 24 incompletos. O [MTE também registra exceção ao limite de idade para pessoas com deficiência](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/aprendizagem-profissional). Portanto, o booleano atual é insuficiente; a regra final deve ser validada juridicamente e não inferir deficiência a partir do currículo.

Tratar dado desconhecido como pendência, não inelegibilidade. Definir data de referência explícita, validação de calendário, tratamento de exceções e trilha de revisão. Não solicitar dados sensíveis desnecessários como atalho para corrigir o filtro.

## Gate para operação comercial

Liberar dados reais de empresas distintas somente após testes de isolamento em banco, storage, RPCs, sessões e relatórios; nenhuma operação deve aceitar tenant enviado pelo cliente sem validar membership. Exigir política de retenção executável e procedimento de incidente/backup restaurável. Essa recomendação é resultado dos controles ausentes encontrados, não afirmação de incidente existente.

