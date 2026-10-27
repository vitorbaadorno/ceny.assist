# Qualidade e rastreabilidade da leitura de currículos

Etapa de 27/10/2026 na branch `ceny-versaonova`, usando o Supabase `wikerxujjvmoksrmjywo`. A validação com o serviço real de IA foi adiada a pedido do usuário. Não há precisão medida nem confirmação de qualidade de OCR em produção.

## Implementação

- PDFs seguem como documento original para leitura multimodal; fotos usam detalhe alto. DOCX preserva parágrafos, separadores de células, tabelas, cabeçalhos e rodapés. As instruções orientam a leitura de colunas, períodos, português, inglês e espanhol. Imagens com lado menor que 600 pixels recebem sinalização de baixa resolução; é uma heurística, não uma medida de legibilidade.
- Um único esquema estrito define os campos obrigatórios e seus tipos. Informações ausentes permanecem `null` ou listas vazias. Respostas vazias, campos ausentes, tipos incorretos, e-mails inválidos, datas impossíveis e números fora dos limites são recusados antes da gravação. Datas futuras ou períodos insuficientes geram revisão, sem completar informações por suposição.
- O receptor SSE verifica UTF-8, limites de bytes/eventos, término da resposta, erros, recusas, interrupções e consistência entre deltas e conteúdo final. JSON parcial nunca equivale a sucesso. Há limites de 2 MB por transmissão, 1 MB de saída e 10 mil eventos, além dos tempos máximos da fila.
- Cada fato pode ter trecho, página ou parágrafo, tipo e confiança próprios. No DOCX, o trecho é conferido no parágrafo extraído; nome, e-mail e competências também precisam estar presentes no trecho. Em PDF/imagem, a fonte continua indicada pela IA, sem validação independente do texto visual. A interface explicita essa diferença.
- Evidência ausente, contraditória ou com confiança inferior a 85%, campos declarados duvidosos e problemas de qualidade encaminham o resultado para revisão, mesmo com confiança geral alta. Cobertura de evidências não é apresentada como precisão.
- Resumo profissional estruturado é identificado como interpretação. Projetos têm campo próprio. Competências e experiências encontradas ficam separadas dessas interpretações; resumos e citações não entram automaticamente como palavras-chave de pontuação.
- Experiência usa a união de intervalos mensais inclusivos, sem somar períodos sobrepostos. Trabalho atual precisa ser explícito. Datas incompletas, invertidas ou futuras impedem um total definitivo; dados ausentes não viram zero.
- Cada tentativa registra modelo solicitado/reportado, versão e hash das instruções, cópia das instruções e esquema, identificador da resposta, início, duração e tokens. Consumo não informado pelo provedor permanece desconhecido. O conteúdo do currículo não é incorporado à cópia das instruções. O resultado validado também fica associado à tentativa.
- A gravação exige reserva válida e autorização vigente. Apenas o serviço registra análises; os usuários consultam tentativas da empresa autorizada sob RLS. Resultados com motivos de revisão não podem ser gravados como sucesso pelo novo contrato.
- Currículos são tratados como dados não confiáveis. As instruções proíbem obedecer comandos do documento, abrir URLs ou usar ferramentas; padrões suspeitos no DOCX geram revisão. Isso reduz o risco de manipulação, sem prometer eliminar todas as formas de injeção de instruções.
- Falhas exibem mensagens controladas, sem repassar respostas brutas do provedor, detalhes internos ou dados pessoais contidos nas exceções.

Versão das instruções: `ceny-resume-v2-2026-10-27`. Modelo solicitado: `openai/gpt-6-astra`, mantido da configuração anterior. Compatibilidade e desempenho do modelo no gateway ainda dependem do teste real autorizado.

## Verificação e avaliação pendente

- 57 testes de código passaram, incluindo transmissão interrompida, resposta inválida, conferência de evidências, datas, sobreposição de experiências, documentos hostis e métricas independentes.
- 15 verificações SQL da nova análise passaram no banco novo, em transação revertida: reserva, auditoria, imutabilidade das instruções, resultado, revisão e isolamento entre empresas.
- TypeScript da aplicação, Deno das duas funções e do avaliador, e build de produção passaram localmente.
- Durante a publicação, a atualização remota de segurança do TanStack (`6ba50dd`) foi incorporada por merge, sem reescrever histórico. O componente de erro foi adaptado ao tipo `ErrorComponentProps` do roteador atualizado; tipos e os 57 testes passaram novamente.
- [GitHub Actions 40547971940](https://github.com/vitorbaadorno/ceny.assist/actions/runs/40547971940), commit `71efb93`: execução concluída com sucesso, incluindo 57 testes de código, cinco suítes SQL, dez cenários de envio/fila/Storage, 16 cenários de autenticação e build de produção. O ambiente descartável foi encerrado. Nenhuma chamada ao serviço real de IA foi feita.
- A `main` remota foi conferida em `58df482099e187f25ef2c154789321df8b0b1815`, sem alteração.
- A migration `20261027090439_resume_analysis_quality.sql` está aplicada. Funções publicadas: `ceny-worker` versão 5 e `ceny-queue` versão 2.
- Há dez documentos fictícios em `tests/fixtures/quality`: PDF textual, colunas, tabela, PDF digitalizado, foto, imagem de baixa resolução, inglês, DOCX com tabela, espanhol e tentativa de manipulação. Os arquivos foram validados estruturalmente; o contato visual dos PDFs/imagens foi conferido.
- `tests/evaluate-resumes.ts` compara a extração com respostas esperadas, calculando acerto por campo, precisão e revocação independentemente da confiança declarada pela IA. O conjunto cobre 11 campos de referência e é sintético e limitado: não representa a diversidade de currículos reais.
- O avaliador só faz chamadas ao provedor com `--live` e credencial configurada. A execução desta etapa foi sem chamadas externas, com todos os casos `not_run`, conforme [relatório pendente](qualidade-avaliacao-pendente.json). Não é possível afirmar melhoria medida da leitura de PDFs, fotos, DOCX, idiomas ou layouts antes dessa avaliação.

O advisor também apontou proteção contra senhas vazadas desativada, configuração preexistente e independente desta etapa, além das quatro tabelas privadas intencionalmente fechadas. Ver [proteção de senhas do Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Referências de implementação: [eventos de transmissão da Responses API](https://developers.openai.com/api/reference/resources/responses/streaming-events), [entrada de arquivos](https://developers.openai.com/api/docs/guides/file-inputs), [Lovable AI](https://docs.lovable.dev/features/ai). Operação e limites da fila: [fila de currículos](fila-curriculos.md).
