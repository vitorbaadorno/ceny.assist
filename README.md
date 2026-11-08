# Ceny â€” versÃ£o nova

Branch independente `ceny-versaonova`, criada sem histÃ³rico da `main`. Esta etapa implementa isolamento por empresa no novo projeto Supabase `wikerxujjvmoksrmjywo` (Ceny Assist).

## Executar, testar e publicar

A instalaÃ§Ã£o de referÃªncia usa Node 24.19.0, Bun 1.3.14 e Supabase CLI 2.122.0. Use a versÃ£o do Node em `.nvmrc` e a do Bun indicada em `packageManager`. Execute `bun install --frozen-lockfile` na raiz. As duas funÃ§Ãµes Edge tÃªm mapas de importaÃ§Ã£o e arquivos `deno.lock` prÃ³prios. O guia reÃºne a configuraÃ§Ã£o local, a publicaÃ§Ã£o por ambiente, o armazenamento privado e o procedimento para arquivos antigos.

[Guia de operaÃ§Ã£o, instalaÃ§Ã£o e migraÃ§Ã£o](docs/seguranca/plataforma-e-migracao.md)

## Desenvolvimento

```powershell
bun install --frozen-lockfile
Copy-Item .env.example .env.local
bun run dev
```

As quatro variÃ¡veis pÃºblicas/servidor de conexÃ£o estÃ£o em `.env.example`, apontando exclusivamente para a conta nova. A chave publicÃ¡vel pode estar no frontend. Nenhuma credencial de serviÃ§o Ã© necessÃ¡ria na aplicaÃ§Ã£o web: o processamento privilegiado roda na Edge Function `ceny-worker`, com credenciais fornecidas pelo prÃ³prio Supabase.

```powershell
bun run typecheck
bun run test
bun run build
```

## Empresas e acessos

ApÃ³s criar e confirmar a conta, abra **Empresas e acessos**. Uma conta sem associaÃ§Ã£o nÃ£o vÃª dados de nenhuma empresa. Ao cadastrar uma empresa, o usuÃ¡rio se torna proprietÃ¡rio apenas daquela empresa.

Para vincular outra pessoa, ela deve confirmar sua conta e fornecer o ID mostrado na tela. O proprietÃ¡rio/administrador informa esse ID e a permissÃ£o. O proprietÃ¡rio pode gerenciar administradores; administradores sÃ³ gerenciam recrutadores e usuÃ¡rios de consulta. O proprietÃ¡rio nÃ£o pode ser removido/diminuÃ­do por essa operaÃ§Ã£o.

| Papel | Leitura da empresa | Cadastro e ediÃ§Ã£o | Processamento/ranking | Acessos e arquivamento |
|---|---|---|---|---|
| ProprietÃ¡rio | Sim | Sim | Sim | Sim |
| Administrador | Sim | Sim | Sim | Sim, exceto administradores/proprietÃ¡rio |
| Recrutador | Sim | Sim | Sim | NÃ£o |
| Consulta | Sim | NÃ£o | NÃ£o | NÃ£o |

Um usuÃ¡rio pode ter papÃ©is diferentes em vÃ¡rias empresas. O seletor de empresa troca o contexto e remove as consultas em cache. O banco verifica associaÃ§Ãµes atuais em cada operaÃ§Ã£o, independentemente do seletor.

## Banco e processamento

As migraÃ§Ãµes em `supabase/migrations` sÃ£o uma base nova. **NÃ£o executar as migraÃ§Ãµes do projeto antigo nesta base**: elas continham polÃ­ticas globais de acesso.

O schema, polÃ­ticas RLS, permissÃµes de colunas, chaves estrangeiras compostas, buckets privados e funÃ§Ã£o de processamento jÃ¡ foram aplicados ao novo projeto. Para repetir em outro ambiente autorizado, use o fluxo de migrations da CLI e publique `supabase/functions/ceny-worker`, incluindo `_shared`. O entrypoint verifica o JWT com `auth.getUser`; `verify_jwt=false` desativa apenas a validaÃ§Ã£o legada do gateway, nÃ£o a autenticaÃ§Ã£o implementada na funÃ§Ã£o.

A extraÃ§Ã£o de currÃ­culo depende de `LOVABLE_API_KEY`, configurada em **Edge Functions â†’ Secrets** no novo Supabase. Essa chave nÃ£o foi fornecida. O ranking determinÃ­stico funciona sem ela. NÃ£o coloque segredos em variÃ¡veis `VITE_*`.

Google OAuth e autocomplete de cidades dependem de configuraÃ§Ãµes externas existentes no projeto original e nÃ£o foram ativados nesta conta. O autocomplete usa `LOVABLE_API_KEY` e `GOOGLE_MAPS_API_KEY` no servidor web. Configure a URL do site e os redirecionamentos de confirmaÃ§Ã£o/recuperaÃ§Ã£o no Supabase Auth para o domÃ­nio em que esta branch for hospedada.

## SeguranÃ§a e validaÃ§Ã£o

- [ImplementaÃ§Ã£o e limites da verificaÃ§Ã£o](docs/seguranca/validacao.md)
- [Procedimento de revisÃ£o do legado](docs/seguranca/legado.md)
- `supabase/tests/company_isolation.sql`: testes de banco executados dentro de transaÃ§Ã£o com rollback; usar somente em ambiente de teste autorizado, sem dados reais.
- `tests/authorization.test.mjs`: testes dos handlers reais com fronteiras externas instrumentadas.
- `tests/live-api.mjs`: testes REST/Storage/Edge com contas temporÃ¡rias previamente preparadas. Requer `.env.local` e `artifacts/live-fixtures.json`; as credenciais sÃ£o descartÃ¡veis e nÃ£o sÃ£o versionadas.

O arquivamento bloqueia novas leituras e links e invalida pontuaÃ§Ãµes/relatÃ³rios associados. Ele mantÃ©m os dados e o original para revisÃ£o administrativa; nÃ£o Ã© uma promessa de exclusÃ£o fÃ­sica. URLs assinadas jÃ¡ emitidas continuam vÃ¡lidas atÃ© expirar. A aplicaÃ§Ã£o emite links de 60 segundos; clientes autorizados que chamem diretamente o endpoint de assinatura do Storage podem escolher outro prazo.

A branch e o novo backend nÃ£o substituem automaticamente o site antigo publicado no Lovable. NÃ£o houve merge nem publicaÃ§Ã£o do frontend em produÃ§Ã£o nesta etapa.

## Gemini

A análise usa o backend Gemini com fila e validação JSON. Configuração, aprovação do tratamento de dados e testes em [Integração Gemini](docs/seguranca/gemini.md).
