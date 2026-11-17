# Relatório de implementação — Ceny Assist

Trabalho iniciado em **16/11/2026**, consolidado em **17/11/2026 (America/Sao_Paulo)**. Branch: `ceny-versaonova`, repositório `vitorbaadorno/ceny.assist`. Base de comparação: `5c737aa`. Referência funcional: as 20 melhorias do documento `melhorias-auditoria-ceny.md`, lido integralmente no início do trabalho. A implementação foi organizada em P0 → P1 → P2 → P3; correções encontradas na validação foram feitas depois.

**Parecer: NO-GO para receber empresas com dados reais.** Há melhorias implementadas e verificadas, mas não há evidência suficiente para encerrar bloqueadores contratuais, operacionais e hospedados. Plano gratuito Gemini preservado; nenhuma contratação paga. Chave permanece nos Secrets Supabase. Não houve exclusão, restauração, reset ou rotação de credenciais de produção. O histórico Git publicado foi preservado. A auditoria de 17/11 identificou também uma vulnerabilidade alta transitiva sem release corrigida, mantida como bloqueador.

## Checklist das 20 melhorias

Marcação `[x]` significa implementação e validação do escopo descrito. `[ ]` significa entrega parcial ou impedimento, mesmo quando existe código pronto. Código em GitHub não equivale a configuração de produção validada.

| Checklist | Prioridade | Melhoria                                   | Implementação/validação e pendência                                                                                                                                                                                                                                                                                                                                           |
| --------- | ---------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ] 01    | P0         | Gemini e privacidade contratual            | Guarda do plano gratuito preservada e testada: PDF/DOCX real não sai para IA, mesmo com tentativa de configuração incompleta. Probe aceita só texto fixo. Faltam parecer, condições contratuais e solução autorizada para dados reais.                                                                                                                                        |
| [ ] 02    | P0         | Governança LGPD                            | Inventário, papéis, bases/finalidades, direitos, operadores e responsáveis documentados. Não foram inventados controlador, encarregado, canal, base legal ou aprovação jurídica. Designação e assinatura pendentes.                                                                                                                                                           |
| [ ] 03    | P0         | Retenção aprovada                          | CLI de simulação/execução usa saga autorizada, exige política vigente, respeita holds e identidades mescladas recentes. Testes unitários e integração descartável. Prazos por categoria, custódia e agendamento autorizado pendentes.                                                                                                                                         |
| [ ] 04    | P0         | Isolamento hospedado                       | RLS, buckets, grants e funções auditados na Ceny; 9 probes negativos hospedados passaram. CI cobre dois tenants, papéis e Storage. Falta repetir jornada positiva/negativa com usuários reais de teste no domínio final.                                                                                                                                                      |
| [ ] 05    | P0         | IA de ponta a ponta e revisão humana       | Parser, saídas malformadas, privacidade, evidências e concorrência de revisão testados. Probe hospedado falhou (Gemini 404). Fluxo completo de extração Gemini e aceite RH não validado; nenhum bypass do bloqueio.                                                                                                                                                           |
| [ ] 06    | P1         | Backup e restauração                       | Exportador cifra dump e bytes, verifica hashes/leitura e só finaliza manifesto completo. Criptografia e recuperação SQL/Storage sintética testadas. Faltam infraestrutura independente, RPO/RTO aprovados e restauração hospedada ensaiada.                                                                                                                                   |
| [ ] 07    | P1         | Monitoramento e alertas externos           | Monitor de site, filas, eliminações, falhas, consumo desconhecido/orçamento e manifesto atrasado; testes de alertas e consultas reais descartáveis. Faltam executor externo, destinatários, ausência de heartbeat e entrega ensaiada.                                                                                                                                         |
| [ ] 08    | P1         | Manifesto externo de exclusões/revogações  | Réplica assinada/cifrada, lock, continuidade, idade e readback; adulteração/perda de tombstones recusadas. Recuperação sintética confirma revogação e eliminação de bytes ressuscitados. Destino independente/imutável e execução periódica pendentes.                                                                                                                        |
| [ ] 09    | P1         | Auth de produção                           | Auditor automático de URLs HTTPS, redirects exatos, confirmação, senha e sessão. CI de cadastro/confirmação/recuperação; corrigida perda de entrada durante inicialização do login. Domínio/configuração completa não confirmados; proteção contra senhas vazadas desativada e requer Pro.                                                                                    |
| [ ] 10    | P1         | Segredos e endpoints privilegiados         | Scanner de fonte/bundle/histórico, testes dos handlers e probes 401/405 hospedados. Fonte e bundle atuais limpos. Auditoria de dependências aponta picomatch alto sem patch oficial. Histórico contém chave Maps de navegador cuja restrição/revogação não está comprovada; gate de segurança permanece reprovado. Deploy Edge autorizado e publicado; pós-deploy verificado. |
| [ ] 11    | P1         | Carga, cotas, custos e retentativas        | Cotas/concorrência SQL, limites de arquivos, retry/timeout e consumo desconhecido testados. Monitor ganha orçamento diário. Faltam carga hospedada com cotas reais, capacidade/custo medidos e SLA aprovado.                                                                                                                                                                  |
| [ ] 12    | P2         | Qualidade e imparcialidade                 | 64 comparações contrafactuais determinísticas; gate exige corpus completo e precisão/recall mínimos. Parser recusa JSON incompatível. Faltam rótulos independentes de RH, avaliação Gemini por formato e repetibilidade; não se declara IA sem viés.                                                                                                                          |
| [ ] 13    | P2         | Jornadas completas de RH                   | Playwright público/móvel, sessão, criação de empresa/vaga, upload, privacidade, revisão e arquivamento; SQL/HTTP cobrem demais ações. As três jornadas automatizadas passaram; evidência da CI abaixo. Falta a jornada completa publicada, incluindo extração/revisão/ranking/exportação e acessibilidade assistiva.                                                          |
| [ ] 14    | P2         | Paridade, deploy e rollback                | Manifesto de hashes e procedimento de rollback; migration de métricas aplicada e alinhada. Versões Edge inventariadas. Edge atualizado com autorização explícita e paridade de código verificada. Faltam paridade do frontend no domínio final e ensaio operacional de rollback.                                                                                              |
| [x] 15    | P2         | Autocomplete sem gateway Lovable           | Catálogo de 5.571 municípios IBGE, busca local por acentos/prefixos, autenticação mantida, teclado e fallback manual. Testes de catálogo e resolução passaram; não há chave nem custo por consulta do fornecedor.                                                                                                                                                             |
| [ ] 16    | P2         | Suporte, incidentes e titulares            | Runbook, severidades, SLAs propostos e roteiro de exercício; controles técnicos de titulares/holds/eliminação testados. Faltam responsáveis, canal real, aprovação de prazos e exercício humano registrado.                                                                                                                                                                   |
| [x] 17    | P3         | Observabilidade de produto                 | RPC de agregados restrita a owner/admin, métricas por formato, abandono, falha, mediana/p95 e revisões. Migration publicada; testes SQL de isolamento e interface de medição ausente/cache/erro passaram. Exibição no frontend publicado depende do item 14.                                                                                                                  |
| [ ] 18    | P3         | Erros, acessibilidade e experiência        | 404/erro em português, mensagens Gemini corrigidas, skip link, página ativa, combobox com teclado, inicialização segura do login. Testes móveis/renderização; auditoria completa de contraste/leitor de tela e jornadas pendente.                                                                                                                                             |
| [ ] 19    | P3         | Material de confiança comercial            | Conteúdo de apresentação, limites, minutas de privacidade/termos, preços e onboarding produzido sem promessas falsas. Aprovação jurídica/comercial, preços e canais reais pendentes.                                                                                                                                                                                          |
| [ ] 20    | P3         | Auditoria recorrente e bloqueio de release | CI ampliada, job independente de histórico, gate comercial por 20 evidências atuais do commit e workflow protegido. Ausência de P0/P1 resulta NO-GO. Gate não substitui proteção de branch/deploy Lovable, ainda não comprovada.                                                                                                                                              |

## Resumo das alterações

- Proteção de dados: integração gratuita bloqueada para currículos reais; validação de saída Gemini; métodos/tokens de probe restritos; retenção por política, sem DELETE direto e sem ignorar retenção legal.
- Operação: backup cifrado e manifesto final, réplica externa com continuidade, monitor de consumo/falhas/filas, auditoria Auth e de credenciais.
- Produto: municípios IBGE sem gateway, métricas agregadas por empresa, melhorias de navegação/acessibilidade e correção real de hidratação do formulário de login.
- Qualidade: regressão de imparcialidade, critérios de avaliação, jornada de navegador, integração de retenção e verificações de release.
- Documentação: governança, operação, comercial, qualidade, evidências hospedadas e achado histórico. Nenhum documento de trabalho foi apresentado como aprovação jurídica.

## Testes e resultados

Evidência final do código: commit **`231e528f0b0a9939359522489575a80a6a76e8bc`**, [execução GitHub Actions 44174421263](https://github.com/vitorbaadorno/ceny.assist/actions/runs/44174421263). Job `isolated-auth`: **success** (inclui navegador, build e bundle). Jobs `history-security` e `dependency-security`: **failure**, pelos achados descritos neste relatório. A execução geral **não está verde**. O commit de fechamento acrescenta somente documentação/evidências sanitizadas, verificadas por scanner; não muda o código validado.

- Node: **162 testes passaram**, zero falhas, abrangendo autorização, privacidade, arquivos, análise, evidências, filas, limites, retenção, recuperação, cidades, fairness, gates e segurança.
- Bun/React: **19 testes passaram**, incluindo métricas ausentes, cache de outro tenant e erro recuperável.
- TypeScript e lint dos componentes alterados: passaram. Build local passou; avisos existentes de depreciação não foram ocultados.
- Auditoria de dependências high/critical: passou em 16/11, mas **reprovou em 17/11** por GHSA-fc5q-39xc-vjpf (`picomatch`, alta, sem versão oficial corrigida disponível). O job bloqueante foi preservado; ver `docs/seguranca/dependencia-picomatch-2026-11-17.md`. Scanner da fonte atual e bundle público: passou. Scanner do histórico: **reprovado**, achado Maps abaixo; não foi suprimido.
- CI descartável: migrations, SQL de permissões/isolamento, Storage real, cadastro/confirmação/recuperação, revisão concorrente, governança, ranking, recuperação de exclusão, retenção aprovada/hold e monitoramento passaram nas execuções de validação. Nova fixture corrigida após recusa de coluna gerada, preservando a restrição do banco.
- Navegador local: fluxo público/móvel passou; teste de login com respostas sintéticas reproduziu a perda de texto antes da inicialização e passou após a correção. Na execução final, **3 testes de navegador passaram**: acesso público/móvel, inicialização da sessão e jornada autenticada com criação de empresa/vaga, upload confirmado pelo POST e pelo banco, privacidade, revisão humana e arquivamento persistido. O teste consulta apenas o tenant sintético no Supabase descartável; nenhuma sessão real é gravada em trace/vídeo.
- Produção: nove probes negativos **aprovados (8 × 401, 1 × 405)**; RLS/buckets/grants auditados; métricas publicadas e negação sem identidade validada. Não foram executados testes destrutivos com registros reais.
- Probe Gemini sintético hospedado: **falhou**, endpoint 503/código fornecedor 404. Não equivale a análise de currículo validada.
- Gate comercial sem evidências: **NO-GO/exit 1**, comportamento esperado. Não há aprovação automática ou checklist fictício.
- Gate de qualidade sobre a avaliação existente marcada como pendente: **reprovado/exit 1**, por ausência de avaliação ao vivo e métricas por documento; não foi preenchido com resultados simulados.

## Impedimentos e riscos remanescentes

1. **Privacidade Gemini gratuito:** termos e tratamento de dados reais não aprovados. O código bloqueia esse envio. Regex de minimização não é anonimização. Falha 404 do probe precisa de diagnóstico do projeto/modelo Google antes de ensaio de qualidade.
2. **Governança:** controlador, operador, encarregado/canal, finalidades/bases, retenção, contratos e respostas a incidentes dependem de aprovação e responsáveis reais.
3. **Histórico Maps:** uma chave `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` aparece em sete blobs históricos. Apenas fingerprint parcial `e57948c797a5` foi documentado. Pode ser chave publicável restrita, mas essa restrição não foi comprovada; exigir revisão/rotação/revogação pelo responsável Google/Lovable. Não é evidência de exposição da chave Gemini. Não reescrever o histórico.
4. **Recuperação/monitoramento:** scripts não substituem volume externo, cofre, custódia, scheduler, plantão, alertas testados e restauração hospedada com RPO/RTO aprovados.
5. **Auth:** falta configuração completa/domínio final. Proteção nativa de senhas vazadas indisponível no plano gratuito; nenhuma compra autorizada ou realizada.
6. **Deploy:** correções Edge publicadas após aprovação específica do usuário e CI de engenharia concluída. A revisão automática inicialmente rejeitou a publicação; não foi contornada. Versões atuais: analisar-curriculo 7, ceny-worker 20, ceny-queue 11; código hospedado idêntico aos arquivos revisados, e 9 probes negativos passaram. Migration de métricas aplicada e validada. Frontend/rollback ainda precisam de comprovação no ambiente final.
7. **Qualidade e RH:** testes determinísticos não provam precisão da extração Gemini, ausência de viés nem adequação de decisão trabalhista. Permanecem revisão humana, avaliação independente e jornada completa.
8. **Release:** job histórico permanece vermelho e o gate comercial não libera. Configuração externa deve impedir publicação comercial prematura; o push para branch Lovable pode sincronizar código sem assegurar essa proteção.

9. **Dependências:** `picomatch <=4.0.7`, GHSA-fc5q-39xc-vjpf, sem versão oficial corrigida em 17/11. Auditoria permanece reprovada, separada da regressão para preservar ambas as evidências. Exige correção validada e nova auditoria; não foi criada exceção.

## Parecer final

**NO-GO.** A Ceny está mais preparada tecnicamente, mas não está liberada para receber dados reais de empresas. Os itens P0 e os controles operacionais P1 não estão integralmente resolvidos/validados. Demonstrações com dados sintéticos e desenvolvimento podem continuar. Só rever o parecer após evidências contratuais, operacionais, de produção e de qualidade, com comprovação do frontend publicado e resolução do achado histórico.

Referências de evidência: [validação hospedada](docs/seguranca/validacao-hospedada-2026-11-16.md), [achado Maps](docs/seguranca/achado-historico-maps.md), [governança](docs/seguranca/governanca-lancamento.md), [operação](docs/seguranca/operacao-comercial.md), [qualidade e jornadas](docs/qualidade/criterios-comerciais.md), [release](docs/qualidade/observabilidade-release.md).

## Arquivos modificados

70 arquivos em relação à base `5c737aa`. `src/routeTree.gen.ts` apresentava apenas diferença de fim de linha preexistente e foi preservado fora dos commits.

- `.github/workflows/accounts-test.yml`
- `.github/workflows/commercial-release.yml`
- `.prettierignore`
- `README.md`
- `bun.lock`
- `docs/comercial/confianca-e-onboarding.md`
- `docs/qualidade/criterios-comerciais.md`
- `docs/qualidade/observabilidade-release.md`
- `docs/seguranca/achado-historico-maps.md`
- `docs/seguranca/dependencia-picomatch-2026-11-17.md`
- `docs/seguranca/endpoints-publicos-2026-11-16.json`
- `docs/seguranca/gemini.md`
- `docs/seguranca/governanca-lancamento.md`
- `docs/seguranca/operacao-comercial.md`
- `docs/seguranca/privacidade-ciclo-de-vida.md`
- `docs/seguranca/validacao-hospedada-2026-11-16.md`
- `package.json`
- `playwright.config.ts`
- `relatorio-implementacao.md`
- `scripts/audit-production-auth.mjs`
- `scripts/audit-public-endpoints.mjs`
- `scripts/auth-production-policy.mjs`
- `scripts/backup-snapshot.mjs`
- `scripts/check-operations.mjs`
- `scripts/check-quality.mjs`
- `scripts/check-release.mjs`
- `scripts/ledger-continuity.mjs`
- `scripts/operations-health.mjs`
- `scripts/quality-gate.mjs`
- `scripts/recovery-crypto.mjs`
- `scripts/release-manifest.mjs`
- `scripts/release-policy.mjs`
- `scripts/replicate-ledger.mjs`
- `scripts/retention-policy.mjs`
- `scripts/run-retention.mjs`
- `scripts/secret-patterns.mjs`
- `scripts/security-scan.mjs`
- `scripts/update-cities.mjs`
- `src/components/city-autocomplete.tsx`
- `src/components/company-settings.tsx`
- `src/components/product-quality.tsx`
- `src/data/cities-br.json`
- `src/integrations/supabase/types.ts`
- `src/lib/cities.ts`
- `src/lib/maps.functions.ts`
- `src/routes/__root.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/routes/auth.tsx`
- `supabase/functions/_shared/ai.ts`
- `supabase/functions/_shared/database.ts`
- `supabase/functions/_shared/gemini-config.ts`
- `supabase/functions/_shared/resumes.ts`
- `supabase/functions/analisar-curriculo/index.ts`
- `supabase/migrations/20261117004702_product_quality_metrics.sql`
- `supabase/tests/product_quality_metrics.sql`
- `tests/ai-gateway.test.mjs`
- `tests/browser/journeys.spec.ts`
- `tests/browser/session.spec.ts`
- `tests/cities.test.mjs`
- `tests/edge-boundaries.test.mjs`
- `tests/evaluate-resumes.ts`
- `tests/fairness-regression.test.mjs`
- `tests/gemini-privacy-boundary.test.mjs`
- `tests/isolated-retention.mjs`
- `tests/operations-controls.test.mjs`
- `tests/quality-gate.test.mjs`
- `tests/release-policy.test.mjs`
- `tests/reliability-interface.test.tsx`
- `tests/retention-policy.test.mjs`
- `tests/security-controls.test.mjs`
