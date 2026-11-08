# Operação e migração da Ceny

## Instalação e execução

Use Node 24.19.0, Bun 1.3.14 e o comando `bun install --frozen-lockfile`. O lockfile fixa as dependências transitivas e os hashes. A CI usa as mesmas versões. As funções Edge resolvem pacotes pelas versões indicadas em seus `deno.json` e `deno.lock`. A atualização desta etapa foi conferida com Deno 2.9.6.

Copie `.env.example` para `.env.local`. Para desenvolvimento isolado, suba o Supabase local com Docker e `npx --yes supabase@2.122.0 start`. Use a URL e a chave pública **do ambiente local** tanto em `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` quanto em `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` do servidor. Execute `bun run dev`. A chave de serviço pertence exclusivamente ao runtime privilegiado do Supabase.

O autocomplete depende de `LOVABLE_API_KEY` e `GOOGLE_MAPS_API_KEY` no servidor. A leitura por IA depende de segredo próprio nas funções e da referência de aprovação efetiva em `CENY_AI_PRIVACY_REVIEW_REFERENCE`. A validação do contrato/DPA continua pendente. Preencher manualmente as informações continua disponível.

## Teste e publicação

1. Na raiz, rode `bun run typecheck`, `bun run test`, `bun run test:interface` e `bun run build`.
2. A integração em `.github/workflows/accounts-test.yml` prepara um Supabase descartável com Auth, Storage, Postgres e funções. Verifica isolamento entre empresas, privilégios, auditoria, revisões, filas, relatórios, exclusão e recuperação. O teste de atualização reaplica a migração sobre a versão de operações da empresa com registros históricos sintéticos. O reset dessa etapa é exclusivamente local.
3. Antes da alteração hospedada, confirme o projeto `wikerxujjvmoksrmjywo`, compare o histórico de migrações e confira as contagens de empresas, candidatos, vagas, documentos, revisões e resultados. Inspecione o inventário do bucket privado e os vínculos ativos. Aplique somente as migrações pendentes. A migração de integridade limita a espera por bloqueios, confere contagens antes/depois e encerra a transação inteira em caso de divergência. Preserve os snapshots.
4. Publique tanto `ceny-worker` quanto `ceny-queue` com seus módulos compartilhados. Mantenha a autenticação interna da primeira por JWT e a da fila pelo segredo de despacho do Vault. Confira o agendamento e a resposta 401 das duas funções sem autenticação. No frontend, configure as variáveis públicas antes do build e os equivalentes de servidor no ambiente de hospedagem. Ajuste Site URL e redirecionamentos de Auth ao domínio publicado. O envio de código à branch e a publicação do site são operações distintas.

## Armazenamento dos currículos e acervo anterior

As migrações preparam o bucket privado `resumes` com limite de 10 MiB por arquivo e permitem PDF, DOCX, PNG e JPEG. Verifique `storage.buckets.public = false`, limite, tipos aceitos e políticas de `storage.objects`. Os envios passam pela validação da Edge Function, que reserva documento, empresa e candidato antes de gravar os bytes. A leitura usa autorização por empresa e URL assinada de curta duração. Use a API de Storage para os arquivos.

Para atualizar um acervo antigo, monte um manifesto restrito por lote com empresa confirmada, candidato, documento/versão, referência de origem, destino reservado, tamanho e SHA-256. Registre o identificador da operação e seu progresso. Comece com um lote pequeno. Reutilize uma reserva já confirmada em uma repetição. Compare o hash dos bytes no destino, confira a associação composta e o documento ativo. Registre contagens de arquivos, duplicatas, quarentena, falhas e confirmações. Só troque a referência após conferência e mantenha a origem durante a validação. Havendo interrupção, retome do último item confirmado. Empresa ambígua, arquivo ausente ou divergência de conteúdo exigem conferência antes da publicação. A etapa atual preserva os caminhos e os objetos existentes.

Desde esta migração, cada nova revisão de candidato registra o documento ativo naquele instante e o ator da sessão quando autenticado. Para revisões antigas, a origem pode ser desconhecida. Uma vaga com situação histórica desconhecida fica **A conferir** e mantém o valor original em tabela privada. Uma associação de pontuação incompatível com a empresa/vaga é preservada para conferência em tabela privada e a pontuação é marcada desatualizada.

## Organização e dependências

As consultas de listas e de lotes ficam em `src/data`. Os componentes apresentam seus resultados. Os estados compartilhados, a validação dos resultados e a montagem dos dados de apresentação ficam em `src/lib`. A avaliação executada pela Edge Function usa as regras em `supabase/functions/_shared`. O ranking lê páginas de até 200 candidatos por cursor e prepara os critérios uma vez por cálculo. As listas de vagas retornam cartões de até 25 itens. O histórico de lotes busca somente a geração mais recente dos documentos da página. Instruções e extrações completas são consultadas quando a pessoa abre o detalhe.

Na revisão estática dos 46 componentes de `src/components/ui`, 32 não tiveram importador direto identificado no código de `src`. Entre eles estão calendário, gráfico, carrossel e menu lateral. São componentes da biblioteca reutilizável. Antes de remover um deles, confira aliases, importações dinâmicas, telas geradas pelo Lovable e dependências transitivas. Todos foram mantidos.

A auditoria do Bun motivou atualizações de Vite, Zod, serialização e dependências transitivas. Após a atualização, restou um alerta moderado em `minimatch` 10, dependência de desenvolvimento de `@typescript-eslint/typescript-estree`. O pacote de lint declara compatibilidade com a linha 10 e a correção indicada começa na linha 11. Acompanhe a atualização do chamador e repita `bun audit --json`, a instalação congelada e a suíte ao atualizar o lockfile. [Aviso de segurança](https://github.com/advisories/GHSA-g3hv-75wg-m249)

## Verificação do histórico Git

Em 7 de novembro de 2026 executamos Gitleaks 8.30.1, com binário conferido por SHA-256, após atualizar as referências remotas. A opção `--log-opts="--all --full-history --root -m"` inclui diferenças de merges. Use `--redact=100` e mantenha o relatório fora do Git. Os alertas em arquivos de ambiente foram classificados localmente, sem usar seus valores para autenticação. As chaves identificadas do Supabase são publicáveis. No histórico da main e da branch de implantação antiga há uma chave de navegador do conector Google Maps. Uma checagem suplementar de 661 blobs de texto procurou JWTs com papel de serviço, tokens privados e material de chave PEM. Não foi confirmada credencial privada. Falta verificar no console Google as restrições de referenciador, APIs e uso dessa chave de navegador. Caso a conta identifique uso indevido ou privilégio inesperado, restrinja ou substitua a chave e revogue a anterior no fornecedor. [Orientação do Google Maps Platform](https://developers.google.com/maps/api-security-best-practices)

A política de retenção dos currículos, as bases e os responsáveis jurídicos, o contrato do fornecedor de IA e a comprovação do backup hospedado continuam nas pendências já registradas.
