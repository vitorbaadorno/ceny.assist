# Relatórios de vagas

Implementação na `ceny-versaonova`, com o Supabase novo `wikerxujjvmoksrmjywo`. A `main` foi preservada.

## Uso

No detalhe da vaga, abra **Relatórios da vaga → Gerar novo relatório**. Escolha uma avaliação publicada e de 1 a 100 candidatos dessa avaliação. A busca consulta a base autorizada antes da paginação; a seleção permanece ao navegar entre páginas. É possível incluir candidatos sem pontuação final, com a respectiva pendência explícita.

O relatório salva as qualificações profissionais, pontos fortes comprovados, lacunas e informações insuficientes, critérios, pesos, obrigatoriedade, justificativas e evidências com origem/campo/página. Formação e competências correspondem ao retrato avaliado. A seção automática identifica o uso de extração por IA e regras de aderência; ela não é uma decisão de contratação. Decisões, seleção e justificativas do RH são apresentadas separadamente, com autoria, data e versão. Notas específicas da vaga são opcionais; notas gerais e observações legadas não são incluídas.

Cada relatório tem ID e versão de formato. Registra data e ID da avaliação, método de pontuação, versão da vaga, versões dos dados e da revisão do candidato, documento utilizado e momento da geração. Decisões e notas do RH correspondem à geração do relatório, e suas próprias datas aparecem junto aos registros. Horários são exibidos em Brasília.

Relatórios salvos são imutáveis. Alterações posteriores nos dados, revisão, documento, vaga, decisão, vínculo ou notas incluídas geram um aviso de desatualização na próxima consulta/exportação, sem reescrever o conteúdo original. Avaliações antigas podem ser usadas, com sinalização explícita. Para atualizar o conteúdo, gere outro relatório.

## Permissões e auditoria

| Perfil autorizado na empresa                  | Consultar | Gerar | Baixar PDF/CSV |
| --------------------------------------------- | --------- | ----- | -------------- |
| Responsável, administrador e RH               | Sim       | Sim   | Sim            |
| Gestor (`viewer`)                             | Sim       | Não   | Não            |
| Sem vínculo vigente, outra empresa ou anônimo | Não       | Não   | Não            |

RLS protege metadados e histórico. O navegador não tem permissão de SELECT da coluna de conteúdo nem de escrita nas novas tabelas. As operações públicas usam funções invoker que delegam a funções privadas com privilégios controlados, `search_path` vazio e validação explícita da identidade, papel, empresa, vaga e **todos** os candidatos. Revogar o vínculo bloqueia novas operações mesmo com um JWT anterior. Arquivar qualquer candidato incluído ou a vaga bloqueia o relatório inteiro. Os registros são preservados para retenção, sem apagamento automático pela rotina legada de `job_reports`.

Geração, consultas e solicitações autorizadas de PDF/CSV registram usuário autenticado, nome no momento da ação, data, relatório e tipo de operação. A geração usa chave de idempotência para permitir repetir uma tentativa sem duplicar relatório ou evento. Escrita direta não pode falsificar autor, conteúdo ou histórico.

O registro de download significa que o servidor autorizou/liberou o conteúdo para aquela solicitação. Não comprova que o navegador concluiu a transferência ou que a pessoa salvou o arquivo no dispositivo. A interface explicita esse limite. Depois que um arquivo foi obtido legitimamente, a aplicação não consegue revogar cópias locais ou impedir cópia manual de conteúdo já consultado.

## Exportações e minimização

- PDF paginado com identificação da versão, data, evidências e seções de IA/RH. A fonte cobre português; caracteres fora da fonte são preservados como código Unicode, sem perda silenciosa ou falha da exportação.
- Planilha em **CSV UTF-8 com BOM e separador `;`**, compatível com Excel/LibreOffice. Há uma linha por candidato/critério, inclusive critérios ainda sem avaliação, e colunas próprias para os registros do RH. Textos iniciados por operadores de fórmula, inclusive após espaços/caracteres de controle, são neutralizados.
- Downloads passam por função autenticada no servidor, com nova verificação no banco e `Cache-Control: private, no-store`. Não há bucket público, link permanente ou conteúdo de relatório aceito do cliente.
- Nomes dos candidatos são opcionais, desmarcados por padrão. O padrão usa `Candidato 1`, `Candidato 2` etc. Isso reduz exposição; **não é anonimização garantida**, pois textos profissionais ou observações podem identificar alguém.
- A lista explícita de campos exclui contatos, nascimento, endereços completos, currículo integral, anexos e caminhos de Storage. E-mails, links e sequências de contato/documentos em textos livres são mascarados. O filtro não substitui revisão humana de texto livre antes de compartilhamento.
- IDs de relatório, avaliação e documento e autoria das decisões são mantidos para rastreabilidade. Limite de 100 candidatos e de 8 MB para o conjunto de candidatos; relatórios maiores pedem redução da seleção ou retirada das notas.

## Verificação

Em 5 de novembro de 2026:

- 49 verificações SQL no Supabase novo, com dados sintéticos e rollback: seleção, versões, minimização, idempotência, mutações bloqueadas, isolamento, revogação, perfis, exportações, auditoria e arquivamento.
- 125 testes unitários, incluindo conteúdo, CSV, PDF e handler real com fronteiras de rede instrumentadas; 9 testes de renderização da interface e TypeScript.
- Compilação de produção; a CI inclui a suíte SQL de relatórios na recriação do banco descartável.
- Inspeção visual de PDF normal e documento longo com paginação, acentos e palavras longas.
- Teste interativo dos componentes reais em prévia com banco simulado: seleção em duas páginas, geração, consulta, downloads PDF/CSV e gestor sem controles de geração/exportação. Esse teste não substitui o teste SQL do banco real ou uma validação autenticada ponta a ponta do ambiente publicado.
- Nenhuma chamada real de IA. Os Advisors não acrescentaram alertas; continuam os avisos preexistentes de quatro tabelas privadas fechadas por RLS e proteção de senhas vazadas desativada.

Migrações aplicadas: `20261104203831_vacancy_reports` e `20261104204306_vacancy_report_validation`. Os arquivos locais foram alinhados às versões registradas pelo conector no banco remoto.
