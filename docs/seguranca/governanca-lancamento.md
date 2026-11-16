# Governança e critérios de liberação — 16/11/2026

Status: **não aprovado para operação comercial com dados reais**. Este documento organiza decisões; não substitui parecer jurídico, contrato ou evidência hospedada.

## 01 — Gemini gratuito

A configuração declarada pelo responsável é gratuita, com `GEMINI_API_KEY` exclusivamente nos Secrets Supabase. Não habilitar billing nem declarar `paid` para contornar o bloqueio. `CENY_GEMINI_DATA_TIER=free` mantém currículos reais em revisão manual. O probe privado usa somente texto sintético fixo. Minimização por regex não equivale a anonimização.

Os [termos Google consultados em 16/11/2026](https://aistudio.google.com/docs/terms#data-use-unpaid) descrevem uso de entradas/saídas para desenvolvimento e possibilidade de revisão humana; orientam não submeter dados pessoais, confidenciais ou sensíveis ao serviço gratuito. Não há comprovação da região contratual, retenção efetiva, DPA ou condições específicas desta conta. A integração não envia currículos reais enquanto o bloqueio persistir. Um eventual plano pago exige autorização financeira separada e aprovação contratual verdadeira, abrangendo PDFs/imagens integrais.

Evidência necessária: identificação do projeto Google e conta contratante (em registro restrito), classificação do serviço, versão dos termos, operadores/suboperadores, localidades, transferência internacional, retenção, exclusão, uso para treinamento, base legal e parecer assinado. Somente depois registrar a referência real no secret de aprovação. Nenhuma chave deve constar nesse documento.

## 02 — Registro de tratamento a aprovar

| Decisão | Registro exigido | Situação |
|---|---|---|
| Controlador por empresa | Razão social e responsável contratual, contato autorizado | Pendente |
| Papel da Ceny e operadores | Contrato, instruções documentadas, Supabase e Google quando autorizado | Pendente jurídico |
| Encarregado/canal | Pessoa/equipe, substituto e canal efetivo testado | Pendente |
| Finalidades e bases legais | Recrutamento, banco de talentos, auditoria, suporte; validar separadamente | Pendente jurídico |
| Categorias e destinatários | Currículos, versões, contatos, avaliações, notas, decisões, exportações e acessos | Inventário técnico existente; aprovação pendente |
| Direitos dos titulares | Identificação proporcional, consulta/correção/exportação/eliminação e revisão de decisão | Fluxo técnico existente; operação e prazos pendentes |
| Segurança e incidentes | Responsáveis, evidência protegida, avaliação de comunicação | Procedimento em `operacao-comercial.md`; designação pendente |

Não presumir consentimento, prazo legal ou função jurídica a partir do papel owner do aplicativo. Validar aviso e contrato com cada controlador antes de coletar dados. Proibir dados reais em demonstrações enquanto P0 estiver aberto.

## 03 — Retenção e descarte

| Categoria | Marco e descarte técnico | Prazo/base a aprovar |
|---|---|---|
| Candidato e currículos | Criação do candidato; saga existente remove todas as versões e bytes | Pendente |
| Extrações, análises e avaliações | Eliminadas junto ao candidato e snapshots relacionados | Pendente; compatibilizar com prazo do candidato |
| Relatórios | Eliminados integralmente quando incluem candidato eliminado | Pendente; cópias externas sob responsabilidade de quem as exportou |
| Pedidos e auditoria mínima | Conservação separada; não apagar provas de direitos sem base aprovada | Pendente; automação por idade ainda não habilitada |
| Tombstones e revogações | Conservar enquanto houver backup capaz de ressuscitar dados | Pendente; jamais expirar antes dos backups abrangidos |
| Backups e manifestos | Custódia externa, cifragem e expiração coordenada | Pendente |

`scripts/run-retention.mjs` implementa simulação e execução por empresa usando um token atual de owner/admin e as RPCs existentes. Respeita retenções legais e impede que um cadastro antigo elimine uma identidade mesclada mais recente. O banco revalida autorização, retenções e conjunto exato em transação. Nenhum SQL de DELETE direto ou bypass service role é utilizado.

Arquivo de política restrito (não preencher aprovação fictícia): `version:1`, `company_id`, `approval_reference`, `approved_by`, `approved_at`, `review_at`, `candidate_days` inteiro positivo e `basis:"candidate_created_at"`. Os registros dependentes acompanham a eliminação; pedidos/auditoria/tombstones não têm prazo automático presumido.

Execução inicial: `node scripts/run-retention.mjs <politica.json> --dry-run`. Antes de `--execute`, revisar simulação, autorização de produção, backup e registro externo; definir `CENY_RETENTION_EXECUTION_APPROVED=confirmed` apenas após autorização. Agendar no executor privado depois do ensaio. Credenciais exclusivamente no cofre: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CENY_ADMIN_ACCESS_TOKEN`. Tokens expiram; falha de autenticação interrompe o trabalho. Não há agendamento de exclusão em produção nesta entrega.

## 04 e 05 — Isolamento e análise

Reexecutar a CI descartável para RLS, papéis, arquivos, RPCs, concorrência, eliminação e recuperação. Depois repetir contra staging com dois tenants e usuários de teste, registrar commit, migrations, versões Edge e resultados sem tokens. O projeto Ceny não aparece na conexão Supabase disponível nesta execução; não usar o projeto MecaFlow para os testes.

Os testes automatizados cobrem PDF/DOCX malicioso, prompt injection, saídas inválidas, evidências e revisão humana. Esses resultados não demonstram qualidade do Gemini ao vivo nem equivalência à produção. O ensaio real permanece bloqueado por acesso ao ambiente e privacidade; não liberar com base apenas em fixtures ou documentação histórica.
