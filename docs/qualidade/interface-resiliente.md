# Interface: falhas, confirmação e acessibilidade

Etapa de 6 de novembro de 2026, branch `ceny-versaonova`. Mantém o Supabase novo e não altera schema, RLS, retenção ou bases legais.

## Comportamento implementado

- Detalhes de candidatos e vagas distinguem consulta pendente, erro e registro ausente. Consulta sem registro encerra o carregamento e oferece retorno à lista. Falha de atualização com dados já carregados preserva o formulário; perda de acesso ou sessão impede manter a tela de dados aberta.
- Mensagens compartilhadas para conexão, sessão inválida/expirada, permissão, registro indisponível e conflito de versão. Nova tentativa nas consultas recuperáveis; nova entrada para sessão expirada. Um único retry automático de consulta, sem retry de gravação. Operações não ficam pausadas indefinidamente pelo estado offline do gerenciador de consultas.
- RPCs que retornam recibos precisam confirmar o resultado: identificador de nota/modelo/leitura, registro salvo da revisão/vaga, versão da decisão, resposta de arquivamento e resultado publicado do ranking. RPCs de contrato `void` continuam confirmadas pela resposta HTTP sem erro. Falha ou retorno incompleto conserva o rascunho e não anuncia sucesso.
- Invalidação das consultas relacionadas após mutações inclui detalhes, listas, versões, fila, notas, decisões, rankings, relatórios e administração de privacidade. A eliminação já invalida o cache pela implementação anterior.
- Estados desconhecidos de extração e recebimento não são apresentados como concluídos. O resumo de envio conta situações não confirmadas separadamente.
- Estado local de revisão, notas, decisão, documentos e envio é isolado pela empresa/candidato/vaga. Trocar de pessoa reinicia rascunho, página e confirmação. Notas e datas vêm do registro consultado, sem substituir datas ausentes pela data atual.
- Abertura do original em duas etapas: preparar acesso autorizado e ativar o link. Há alternativa na mesma aba, sem depender de popup automático. Links locais de acesso expiram da interface em 55 segundos (assinatura do serviço: 60 segundos). Documento sem recebimento confirmado ou cadastro sem referência a arquivo mostra ação desativada e explicação.
- Falhas em modelos de vagas, histórico, avaliações auxiliares e conferência especial não impedem digitar informações manuais. A conferência especial só salva depois de obter a versão atual para controlar concorrência; erro de histórico isolado não bloqueia esse salvamento.
- Confirmação de arquivamento permanece aberta durante a gravação e em caso de falha, com mensagem no diálogo. Labels, seleções nativas, checkbox, `role=alert/status`, foco e teclado preservados.

## Verificação

Testes automatizados: `bun run test`, `bun run test:interface`, `bun run typecheck`, lint dos arquivos alterados e `bun run build`. Novos testes em `tests/ui-feedback.test.mjs` e `tests/reliability-interface.test.tsx`; autorização também cobre falha de rede sem confundi-la com acesso negado.

Interface real executada em prévia local com serviços substituídos por cenários sintéticos:

| Cenário                                  | Resultado observado                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Trocar Ana por Bruno com rascunho aberto | Rascunho limpo; nota e data exclusivas de Bruno                                         |
| Salvar nota com resposta vazia           | Mensagem de falha, texto preservado, nenhum sucesso                                     |
| Repetir com confirmação válida           | Nota acrescentada ao histórico e editor limpo                                           |
| Histórico/modelos indisponíveis          | Mensagem e retry; campos editáveis                                                      |
| Vaga/candidato inexistente               | Mensagem terminal e link para lista                                                     |
| Rede, permissão e sessão inválida        | Mensagens distintas; retry ou nova entrada conforme o caso                              |
| Arquivo ainda não recebido               | Botão desativado e motivo visível                                                       |
| Abrir original na mesma aba              | Link navega ao original sintético, sem criar janela                                     |
| Tab/Enter, setas e Espaço                | Envio da nota, escolha de categoria e confirmação acionáveis                            |
| Diálogo com falha                        | Foco inicial no cancelamento; erro no diálogo; Escape fecha e devolve foco ao acionador |
| Árvore de acessibilidade                 | Campos nomeados, estados desativados, confirmação e mensagens expostos                  |

A validação de leitor de tela nesta etapa cobre a árvore de acessibilidade e os controles de foco, sem ensaio de fala com NVDA/JAWS. A alternativa de abertura na mesma aba foi exercitada; não foram alteradas configurações de bloqueio de popup do navegador. A prévia não representa um teste integral autenticado em produção. Sem chamadas de IA ou operações de eliminação reais. Artefatos locais ignorados pelo Git ficam em `artifacts/`.

## Limites

- Falha de rede após o servidor salvar pode deixar o resultado incerto. A tela orienta consultar histórico/versão antes de repetir, sem prometer que nada foi salvo. Idempotência e controle de versão existentes permanecem ativos.
- A camada de interface não concede acesso: autorização, RLS e verificações de identidade continuam obrigatórias no servidor.
- Não há nova publicação de site público ou alteração do fornecedor de IA nesta etapa. As pendências jurídicas, retenção, contrato/DPA e backup hospedado continuam registradas em `docs/seguranca/privacidade-ciclo-de-vida.md` e no `context.md` local.
