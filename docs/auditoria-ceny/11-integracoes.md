# Dependências externas existentes — expansão adiada

Referências E01–E28: [catálogo de evidências](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>). Para escopo e limites, consulte o [resumo executivo](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>).

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

## Ajuste interno recomendado agora

Permitir digitar e salvar cidade sem depender de autocomplete. Os dados devem continuar editáveis quando um serviço auxiliar falhar. Preservar a separação de autenticação, storage e IA por adaptadores para permitir testes locais e evolução sem propagar regras de fornecedores às telas.

Não expandir integrações para compensar problemas de revisão, duplicação, autorização ou matching. Primeiro corrigir ingestão e dados internos.

## Fora do escopo

LinkedIn, ATS, armazenamento externo, e-mail de relatórios, webhooks, importação por API/CSV e gateway de cobrança. Não foram localizados fluxos de importação dessas fontes. Sem novas pesquisas de APIs/preços, propostas de scraping ou promessa de viabilidade. Quando houver pedido futuro, analisar canais oficiais, permissões e termos vigentes nessa etapa. Isso fica P3 e não bloqueia o MVP interno.

