# Ceny — versão nova

**Prontidão comercial: NO-GO enquanto os bloqueadores e evidências externas da auditoria estiverem abertos.** Consulte [relatorio-implementacao.md](relatorio-implementacao.md). O Gemini permanece gratuito, com chave somente nos Secrets Supabase e bloqueio de currículos reais; não habilitar billing ou declarar plano pago sem autorização.

Branch independente `ceny-versaonova`, criada sem histórico da `main`. Esta etapa implementa isolamento por empresa no novo projeto Supabase `wikerxujjvmoksrmjywo` (Ceny Assist).

## Executar, testar e publicar

A instalação de referência usa Node 24.19.0, Bun 1.3.14 e Supabase CLI 2.122.0. Use a versão do Node em `.nvmrc` e a do Bun indicada em `packageManager`. Execute `bun install --frozen-lockfile` na raiz. As três funções Edge têm mapas de importação e arquivos `deno.lock` próprios. O guia reúne a configuração local, a publicação por ambiente, o armazenamento privado e o procedimento para arquivos antigos.

[Guia de operação, instalação e migração](docs/seguranca/plataforma-e-migracao.md)

## Desenvolvimento

```powershell
bun install --frozen-lockfile
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
bun run dev
```

As quatro variáveis públicas/servidor de conexão estão em `.env.example`, apontando exclusivamente para a conta nova. A chave publicável pode estar no frontend. Nenhuma credencial de serviço é necessária na aplicação web: o processamento privilegiado roda na Edge Function `ceny-worker`, com credenciais fornecidas pelo próprio Supabase. Preserve um `.env.local` existente ao configurar desenvolvimento.

```powershell
bun run typecheck
bun run test
bun run test:interface
bun run test:browser
bun run build
bun run security:scan
bun audit --audit-level=high
bun run release:manifest
bun run release:check
```

## Empresas e acessos

Após criar e confirmar a conta, abra **Configurações da empresa**. Uma conta sem associação não vê dados de nenhuma empresa. Ao cadastrar uma empresa, o usuário se torna proprietário apenas daquela empresa.

Para vincular outra pessoa, o proprietário/administrador registra um convite pelo e-mail e pela permissão desejada. A pessoa confirma o e-mail e aceita o convite na própria conta. O proprietário pode gerenciar administradores; administradores só gerenciam recrutadores e usuários de consulta. O proprietário não pode ser removido/diminuído por essa operação.

| Papel         | Leitura da empresa | Cadastro e edição | Processamento/ranking | Acessos e arquivamento                   |
| ------------- | ------------------ | ----------------- | --------------------- | ---------------------------------------- |
| Proprietário  | Sim                | Sim               | Sim                   | Sim                                      |
| Administrador | Sim                | Sim               | Sim                   | Sim, exceto administradores/proprietário |
| Recrutador    | Sim                | Sim               | Sim                   | Não                                      |
| Consulta      | Sim                | Não               | Não                   | Não                                      |

Um usuário pode ter papéis diferentes em várias empresas. O seletor de empresa troca o contexto e remove as consultas em cache. O banco verifica associações atuais em cada operação, independentemente do seletor.

## Banco e processamento

As migrações em `supabase/migrations` são uma base nova. **Não executar as migrações do projeto antigo nesta base**: elas continham políticas globais de acesso.

O schema, políticas RLS, permissões de colunas, chaves estrangeiras compostas, buckets privados e função de processamento já foram aplicados ao novo projeto. Para repetir em outro ambiente autorizado, use o fluxo de migrations da CLI e publique `supabase/functions/ceny-worker`, incluindo `_shared`. O entrypoint verifica o JWT com `auth.getUser`; `verify_jwt=false` desativa apenas a validação legada do gateway, não a autenticação implementada na função.

A extração de currículos usa o Gemini no backend. Configure a credencial exclusivamente nos Secrets do Supabase e consulte [Integração Gemini](docs/seguranca/gemini.md) para aprovação de privacidade, modelos e testes.

O autocomplete usa catálogo público versionado do IBGE, sem gateway, API key ou chamadas por consulta. Google OAuth permanece sujeito à configuração própria. Configure Site URL e redirects exatos no Supabase Auth para o domínio publicado e valide com `scripts/audit-production-auth.mjs`; configuração CLI local não comprova produção.

## Segurança e validação

- [Implementação e limites da verificação](docs/seguranca/validacao.md)
- [Procedimento de revisão do legado](docs/seguranca/legado.md)
- `supabase/tests/company_isolation.sql`: testes de banco executados dentro de transação com rollback; usar somente em ambiente de teste autorizado, sem dados reais.
- `tests/authorization.test.mjs`: testes dos handlers reais com fronteiras externas instrumentadas.
- `tests/live-api.mjs`: testes REST/Storage/Edge com contas temporárias previamente preparadas. Requer `.env.local` e `artifacts/live-fixtures.json`; as credenciais são descartáveis e não são versionadas.

O arquivamento bloqueia novas leituras e links e invalida pontuações/relatórios associados. Ele mantém os dados e o original para revisão administrativa; não é uma promessa de exclusão física. URLs assinadas já emitidas continuam válidas até expirar. A aplicação emite links de 60 segundos; clientes autorizados que chamem diretamente o endpoint de assinatura do Storage podem escolher outro prazo.

A branch e o novo backend não substituem automaticamente o site antigo publicado no Lovable. Não houve merge nem publicação do frontend em produção nesta etapa.

## Gemini

A análise usa o backend Gemini com fila e validação JSON. Configuração, aprovação do tratamento de dados e testes em [Integração Gemini](docs/seguranca/gemini.md).

## Preparação comercial

- [Governança LGPD, Gemini gratuito e retenção](docs/seguranca/governanca-lancamento.md)
- [Backup, manifestos, monitoramento e suporte](docs/seguranca/operacao-comercial.md)
- [Qualidade da IA, jornadas e paridade](docs/qualidade/criterios-comerciais.md)
- [Métricas, acessibilidade e gate de release](docs/qualidade/observabilidade-release.md)
- [Materiais de confiança e onboarding](docs/comercial/confianca-e-onboarding.md)
- [Achado histórico de chave Maps](docs/seguranca/achado-historico-maps.md)

O gate comercial falha por padrão sem evidência aprovada. Scripts operacionais exigem infraestrutura/segredos restritos e não foram agendados em produção. A migration aditiva `20261117004702_product_quality_metrics.sql` foi aplicada e suas permissões verificadas no projeto Ceny. Testes autenticados de navegador são exclusivos de Supabase descartável com `CENY_BROWSER_ISOLATED=true`. Consulte o relatório para distinguir o código enviado, a migração publicada e o deploy Edge autorizado e validado.
