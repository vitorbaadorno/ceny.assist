# Qualidade, jornadas e release

## 12 — Qualidade e imparcialidade

O corpus sintético existente contém dez documentos: PDF texto/colunas/tabela, imagem digitalizada/foto/baixa resolução, DOCX tabela/injeção e idiomas inglês/espanhol. As referências são fatos escritos manualmente; não são avaliações de uma banca RH independente. `fairness-regression.test.mjs` executa 64 comparações contrafactuais de pontuação em quatro critérios, quatro perfis profissionais e quatro conjuntos de identificadores/atributos protegidos. Isso valida invariância do motor determinístico; não comprova ausência de viés da extração Gemini.

Critérios mínimos técnicos iniciais: precisão ≥95%, recall ≥90% por documento, 100% dos casos críticos encaminhados à revisão e nenhuma mudança de pontuação por atributos protegidos. `quality-gate.mjs` rejeita corpus incompleto, avaliação não executada, resultados ausentes e critérios abaixo dos limites. Não usar confiança autodeclarada pelo modelo como métrica. Revalidar limiares com RH antes de comercializar; eles são critérios técnicos de teste, não promessa de acurácia.

Antes do aceite: dois avaliadores RH rotulam independentemente documentos sintéticos representativos das vagas e resolvem divergências; medir concordância, taxas por formato/idioma, invenções, omissões, revisão humana e estabilidade em três execuções. Registrar modelo solicitado/reportado, prompt, critérios de vaga, seed/corpus, data e versões. Revisar a cada release que muda modelo/prompt/schema e trimestralmente no piloto. Não coletar atributos sensíveis reais para um teste de viés sem base e revisão jurídica.

`tests/evaluate-resumes.ts` usa agora o nome correto da credencial Gemini, mas mantém o bloqueio de privacidade do extrator. Não copiar o secret do Supabase para o frontend nem configurar plano pago fictício para executar o benchmark. A avaliação Gemini real está pendente; o probe fixo sintético demonstra apenas disponibilidade, não qualidade de currículos.

## 13 — Jornadas

`playwright.config.ts` executa Chromium com credenciais apenas em memória, sem trace/vídeo/screenshot de sessões. Teste público: redirecionamento de área restrita, login, mostrar senha, tela móvel e 404. Jornada com `CENY_BROWSER_ISOLATED=true`: usa exclusivamente Supabase localhost descartável, cria conta sintética, empresa, vaga, upload e abre privacidade. Suite SQL/HTTP existente cobre convites, revisão concorrente, rankings, exportação, arquivamento, retenções, exclusão/Storage e recuperação. Esses testes complementam mas não substituem uma jornada inteira no navegador publicado.

Matriz de aceite de staging: proprietário cadastra empresa; convida RH/consulta; RH aceita; cria/aprova vaga; envia PDF/DOCX; acompanha bloqueio/falha; faz revisão humana; vincula/avalia candidato; gera ranking e exporta relatório; gestor não altera; arquiva; administrador verifica titular, aplica/libera hold e elimina; falha de rede/Storage permanece pendente; retomada confirma banco e bytes. Executar dois tenants, teclado e viewport móvel. Somente dados sintéticos e ambiente previamente autorizado. Não classificar como aprovado o trecho que não foi exercitado.

## 14 — Paridade, implantação e rollback

`node scripts/release-manifest.mjs` grava hashes de migrations, Edge, lockfile e configuração em `artifacts/release-manifest.json`. Comparar com o commit de deploy, lista de migrations hospedada, versões das três Edge Functions, scheduler ativo, URL/HTTPS e resultados de `audit-production-auth.mjs`. Valores dos Secrets nunca entram no manifesto. Lista de nomes a conferir em ambiente privado: GEMINI_API_KEY, GEMINI_MODEL quando configurado, CENY_GEMINI_DATA_TIER=free, aprovação de privacidade ausente enquanto não válida, token privado do scheduler e configuração Supabase injetada.

Release: CI verde para commit exato, backup restaurável, manifestos externos íntegros, alertas ensaiados, checklist jurídico/privacidade aprovado e `release:check` aprovado. Checar domínio real com contas sintéticas após deploy. Preservar anterior bundle/Edge/manifesto. Rollback de aplicação por redeploy do commit anterior compatível; migrations aditivas por correção forward. Nunca resetar banco ou reescrever histórico da branch Lovable. Não remover uma migration aplicada. A sincronização Lovable pode ocorrer no push; ela precisa respeitar os gates da CI na configuração externa, que este repositório sozinho não comprova.

## 15 — Municípios

Autocomplete usa snapshot de 5.571 municípios obtido em 16/11/2026 da [API pública oficial IBGE](https://servicodados.ibge.gov.br/api/docs/localidades), referenciada no [catálogo gov.br](https://www.gov.br/conecta/catalogo/apis/registro-referencia-municipios). IDs e UF são validados. Pesquisa tolera acentos, limita oito sugestões e mantém digitação manual. Não usa chaves Google Maps/Lovable, cobrança por consulta ou chamadas de rede para o provedor durante uso. Atualização administrativa: `node scripts/update-cities.mjs`, revisar diff, testar e publicar snapshot; falha preserva a cópia anterior. Cadastro existente conserva seus textos de cidade.

## 16 — Suporte

Procedimentos, SLAs propostos e ensaios pendentes em `../seguranca/operacao-comercial.md`. Nenhum canal, responsável ou aprovação é inventado.
