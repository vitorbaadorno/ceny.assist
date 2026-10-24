# Ceny — versão nova

Branch independente `ceny-versaonova`, criada sem histórico da `main`. Esta etapa implementa isolamento por empresa no novo projeto Supabase `wikerxujjvmoksrmjywo` (Ceny Assist).

## Desenvolvimento

```powershell
bun install --frozen-lockfile
Copy-Item .env.example .env.local
bun run dev
```

As quatro variáveis públicas/servidor de conexão estão em `.env.example`, apontando exclusivamente para a conta nova. A chave publicável pode estar no frontend. Nenhuma credencial de serviço é necessária na aplicação web: o processamento privilegiado roda na Edge Function `ceny-worker`, com credenciais fornecidas pelo próprio Supabase.

```powershell
bun run typecheck
bun run test
bun run build
```

## Empresas e acessos

Após criar e confirmar a conta, abra **Empresas e acessos**. Uma conta sem associação não vê dados de nenhuma empresa. Ao cadastrar uma empresa, o usuário se torna proprietário apenas daquela empresa.

Para vincular outra pessoa, ela deve confirmar sua conta e fornecer o ID mostrado na tela. O proprietário/administrador informa esse ID e a permissão. O proprietário pode gerenciar administradores; administradores só gerenciam recrutadores e usuários de consulta. O proprietário não pode ser removido/diminuído por essa operação.

| Papel | Leitura da empresa | Cadastro e edição | Processamento/ranking | Acessos e arquivamento |
|---|---|---|---|---|
| Proprietário | Sim | Sim | Sim | Sim |
| Administrador | Sim | Sim | Sim | Sim, exceto administradores/proprietário |
| Recrutador | Sim | Sim | Sim | Não |
| Consulta | Sim | Não | Não | Não |

Um usuário pode ter papéis diferentes em várias empresas. O seletor de empresa troca o contexto e remove as consultas em cache. O banco verifica associações atuais em cada operação, independentemente do seletor.

## Banco e processamento

As migrações em `supabase/migrations` são uma base nova. **Não executar as migrações do projeto antigo nesta base**: elas continham políticas globais de acesso.

O schema, políticas RLS, permissões de colunas, chaves estrangeiras compostas, buckets privados e função de processamento já foram aplicados ao novo projeto. Para repetir em outro ambiente autorizado, use o fluxo de migrations da CLI e publique `supabase/functions/ceny-worker`, incluindo `_shared`. O entrypoint verifica o JWT com `auth.getUser`; `verify_jwt=false` desativa apenas a validação legada do gateway, não a autenticação implementada na função.

A extração de currículo depende de `LOVABLE_API_KEY`, configurada em **Edge Functions → Secrets** no novo Supabase. Essa chave não foi fornecida. O ranking determinístico funciona sem ela. Não coloque segredos em variáveis `VITE_*`.

Google OAuth e autocomplete de cidades dependem de configurações externas existentes no projeto original e não foram ativados nesta conta. O autocomplete usa `LOVABLE_API_KEY` e `GOOGLE_MAPS_API_KEY` no servidor web. Configure a URL do site e os redirecionamentos de confirmação/recuperação no Supabase Auth para o domínio em que esta branch for hospedada.

## Segurança e validação

- [Implementação e limites da verificação](docs/seguranca/validacao.md)
- [Procedimento de revisão do legado](docs/seguranca/legado.md)
- `supabase/tests/company_isolation.sql`: testes de banco executados dentro de transação com rollback; usar somente em ambiente de teste autorizado, sem dados reais.
- `tests/authorization.test.mjs`: testes dos handlers reais com fronteiras externas instrumentadas.
- `tests/live-api.mjs`: testes REST/Storage/Edge com contas temporárias previamente preparadas. Requer `.env.local` e `artifacts/live-fixtures.json`; as credenciais são descartáveis e não são versionadas.

O arquivamento bloqueia novas leituras e links e invalida pontuações/relatórios associados. Ele mantém os dados e o original para revisão administrativa; não é uma promessa de exclusão física. URLs assinadas já emitidas continuam válidas até expirar. A aplicação emite links de 60 segundos; clientes autorizados que chamem diretamente o endpoint de assinatura do Storage podem escolher outro prazo.

A branch e o novo backend não substituem automaticamente o site antigo publicado no Lovable. Não houve merge nem publicação do frontend em produção nesta etapa.
