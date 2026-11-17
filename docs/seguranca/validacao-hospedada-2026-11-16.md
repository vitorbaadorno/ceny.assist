# Evidências hospedadas — 16/11/2026, America/Sao_Paulo

Projeto confirmado pelo conector: **Ceny Assist**, `wikerxujjvmoksrmjywo`, estado `ACTIVE_HEALTHY`, região `us-west-2`, organização no plano gratuito. Horários UTC do provedor podem constar em 17/11. Não foram consultados currículos, contatos, tokens de usuários ou valores de Secrets para esta auditoria.

## Consultas e resultados

- Tabelas dos schemas public/private: RLS habilitado em todas; zero tabelas públicas sem RLS.
- Buckets `resumes` e `legacy-quarantine`: privados. `resumes`: limite 10 MB, MIME PDF/JPEG/PNG/DOCX.
- Zero funções SECURITY DEFINER do schema público executáveis por `anon`.
- Sem USAGE de `anon` no schema private; zero grants diretos de tabelas privadas para anon/authenticated. O papel authenticated usa wrappers autorizados.
- Advisor de saúde: sem achados. Advisor de segurança: 17 INFO de tabelas privadas com RLS sem política e 1 WARN de proteção contra senhas vazadas desativada. Não foram abertas políticas para eliminar alertas: as tabelas privadas são intencionalmente inacessíveis diretamente.
- Agendamentos existentes ativos: fila a cada minuto e retenção de eventos operacionais às 03:19. Isso não comprova executor externo de backups, alertas ou retenção aprovada de candidatos.
- Antes do deploy: sete probes negativos REST/Edge, todos HTTP 401. Após o deploy autorizado: nove probes passaram, oito HTTP 401 e um HTTP 405; inclui ausência de credencial, JWT inválido, scheduler falsificado/malformado e método proibido. Script reproduzível: `node scripts/audit-public-endpoints.mjs`; artefato local sanitizado `artifacts/public-endpoints.json`.
- Migração aditiva `20261117004702_product_quality_metrics.sql` aplicada com sucesso via ferramenta oficial. Apenas cria duas funções de consulta e grants restritos; não altera/apaga registros. A versão local foi alinhada ao identificador atribuído pelo Supabase.
- Pós-migração: wrapper público SECURITY INVOKER; implementação privada SECURITY DEFINER com `private.ops_admin`; search_path vazio; execução negada a anon. Chamada sem identidade autenticada recusada com `42501`. Advisor reexecutado sem novos achados.
- Consulta agregada de fontes de logs efetuada sem mensagens ou conteúdo pessoal. A tentativa de agregação pela coluna `level` não foi suportada pelo schema de logs; não se declara auditoria completa de conteúdo dos logs.

## Gemini

Os resultados sanitizados dos nove probes pós-deploy estão em [endpoints-publicos-2026-11-16.json](endpoints-publicos-2026-11-16.json), com horário UTC, status e aprovação de cada teste; não contêm credenciais.

Código hospedado inspecionado: chave lida exclusivamente em `Deno.env`, guarda exige tier pago e aprovação contratual para currículos, probe tem texto sintético fixo. Não foi alterado tier nem acessado o valor da chave.

Executada uma requisição interna autenticada ao probe fixo, com token resolvido dentro do banco e nunca retornado. Resultado: HTTP 503 no endpoint, código 404 do fornecedor, modelo solicitado `gemini-2.5-flash`. A listagem autenticada inclui esse modelo, portanto disponibilidade na lista não comprovou capacidade de geração. Não houve envio de currículo nem troca automática de modelo. O resultado não mede qualidade nem resolve a pendência contratual.

## Implantação e limites

Versões Edge observadas: `ceny-worker` 19, `ceny-queue` 10, `analisar-curriculo` 6. O deploy das correções da auditoria foi rejeitado pela revisão automática de aprovação: substituição imediata de função pública, possível impacto em uploads/análises, autorização geral considerada insuficiente para esse deploy e CI ainda em andamento. Após a CI de engenharia passar no commit d2a7755, o usuário autorizou especificamente o deploy das três funções. Publicadas: `ceny-worker` 20, `ceny-queue` 11, `analisar-curriculo` 7, todas ACTIVE. Os arquivos recuperados do Supabase foram comparados ao código revisado: zero divergências (normalizando apenas fim de linha). Nove probes negativos pós-deploy passaram. A migração de métricas foi uma operação separada, concluída anteriormente.

Ainda faltam domínio publicado confirmado, configuração Auth completa/SMTP/redirects e ensaio hospedado com dois tenants e contas sintéticas. Catálogo/RLS e probes negativos não substituem testes positivos de usuário, revogação, Storage assinado e UI no domínio final.

O campo homepage do GitHub aponta para `https://testes-da-ceny.vercel.app`, que respondeu HTTP 200 com HTML. Isso não confirma que seja o domínio comercial da branch nem seu commit/backend. O usuário não confirmou esse domínio como destino final; não foram alterados redirects de produção por inferência.

A [proteção nativa contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) exige plano Pro ou superior. Não houve contratação. Avaliar e aprovar uma solução compatível com orçamento antes de considerar esse controle atendido.
