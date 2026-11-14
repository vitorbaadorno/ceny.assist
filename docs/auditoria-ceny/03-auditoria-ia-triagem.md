# Auditoria do motor de triagem

Referências E01–E28: [catálogo de evidências](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>). Para escopo e limites, consulte o [resumo executivo](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>).

## O que é IA e o que é regra

**A IA extrai o currículo; o ranking é uma fórmula determinística de texto.** Não há chamada de modelo em scoreCandidate/rankJobCandidates, embeddings, comparação semântica ou modelo que gere o percentual. E06–E09.

O identificador configurado é openai/gpt-6-astra, via gateway Lovable Responses. Não foram verificados disponibilidade, preço ou execução desse modelo no ambiente publicado. Não houve consumo de créditos nesta auditoria.

## Entrada de currículos

| Aspecto | Evidência atual | Diagnóstico |
|---|---|---|
| PDF com texto | input accept .pdf; input_file com Base64 | caminho implementado, leitura real não testada |
| PDF digitalizado | instrução pede leitura de digitalizados/fotos | depende do modelo; não há OCR separado/fallback |
| Imagens | accept image/*; input_image para MIME image | mais amplo que JPG/PNG anunciados; sem inspeção de conteúdo |
| DOCX | não oferecido no seletor, sem parser | não implementado/verificado |
| Lote | loop await por arquivo | sequência testada U04, sem paralelismo/retomada |
| Limites | só bytes.length === 0 no servidor | sem tamanho máximo, páginas, dimensões, quantidade/lote ou cota |
| Tipo | file.type, fallback por extensão | confiança em metadados; sem magic bytes/sandbox |
| Duplicados | nome sanitizado + UUID aleatório | todo upload vira novo candidato; sem hash/mesclagem |
| Armazenamento | resumes, path sem organização | autorização ampla; bucket efetivo não inspecionado |
| Falhas | erro por item e processing_error | não há compensação, fila ou retry controlado |
| Reprocessamento | botão chama mesmo handler | sem idempotência, lock, histórico ou preservação de correção |

U03 usa somente metadados fictícios de um arquivo de 1 GiB para provar que o handler não bloqueia tamanho; **não foi enviado ou criado um arquivo desse tamanho**. U01 comprova ausência de remoção compensatória após falha de INSERT no adaptador simulado.

## Extração estruturada

O schema contém nome, e-mail, telefone, nascimento, localização, formação, experiências com empresa/cargo/período/descrição, skills, idiomas, certificações, anos totais de experiência, confiança e campos incertos. Não contém resumo profissional nem projetos como campos próprios. Períodos são strings livres; não há cálculo independente de duração nem tratamento explícito de experiências sobrepostas.

São pontos positivos: strict JSON schema solicitado ao provedor; null para campos ausentes; instrução de não inventar; sinalização de revisão se faltam nome/contato ou confiança < 0,6. Testes P01/P03/P05 validam esses ramos com respostas sintéticas.

Limitações:

1. O TypeScript Extraction e o cast Json não validam a resposta em runtime. I03/I09: o helper aceita objeto incompatível e null.
2. Confiança é autodeclarada, não probabilidade calibrada. Não há confiabilidade por campo ou validação da escala 0–1.
3. campos_incertos não participa do needsReview: P02 conclui com campo incerto. A UI também não permite resolver adequadamente essa revisão.
4. Ausência de contato é representada por null, mas anos ausentes viram zero no score e na UI.
5. A extração completa é sobrescrita; não há texto/página de evidência, versão de schema/prompt/modelo, fingerprint do arquivo, tokens ou horário da execução.
6. Corrigir cidade/nascimento manualmente não protege o dado: P04 mostra sobrescrita pelo reprocessamento.
7. Não há avaliação de precisão com PDFs, fotos, tabelas, múltiplas colunas ou documentos ilegíveis.

## Fórmula atual

score = 55 × proporção de obrigatórios encontrados + 20 × proporção de desejáveis encontrados + até 10 por experiência + 8 por local + 7 por formação; arredonda e limita entre 0 e 100.

Quando não há requisitos de uma categoria, a categoria recebe pontuação cheia. Experiência e formação sem exigência também recebem todos os pontos. Um candidato vazio numa vaga vazia recebe 100. Uma vaga com apenas “Excel obrigatório” dá 45 a quem não comprova Excel, por causa dos outros grupos vazios.

O texto pesquisado contém skills e JSON.stringify(dados_extraidos), incluindo nome, e-mail e nomes das chaves. É usado includes após normalizar caixa e acentos. Descrição/título da vaga, nível de competência, recência e contexto não são avaliados. Requisitos obrigatórios não são eliminatórios: têm somente peso maior.

## Resultados reproduzidos

| Teste | Entrada resumida | Resultado do código | Consequência |
|---|---|---|---|
| S03 | JavaScript para Java | 100 e obrigatório atendido | falso positivo por substring |
| S04 | “Não possui experiência com Excel” | 100 para Excel | negação ignorada |
| S05 | nome “Ana Java” | 100 para Java | dado pessoal contamina score |
| S06 | JS para JavaScript | 45 | falso negativo por sinônimo |
| S07 | candidato e vaga vazios | 100 | falsa certeza |
| S09/S10 | cidade "" versus null, vaga Recife | true versus false | semântica inconsistente de ausência |
| S11 | ensino médio incompleto | formação atendida | nível/conclusão ignorados |
| S12 | repetir Excel em requisitos | 73 → 82 | ponderação acidental |
| S13 | chave JSON email | obrigatório “email” atendido | estrutura técnica contamina score |
| R01 | candidato em erro/revisão | incluído | resultado sem qualidade mínima |
| R02 | erro no upsert | ranking prévio já apagado | perda de avaliação |
| S15 | input repetido | resultado idêntico | fórmula determinística, ponto positivo |

Esses testes **não são benchmark do modelo de IA**. Um erro de extração pode agravar o problema, mas os falsos matches demonstrados ocorrem independentemente da IA.

## Explicabilidade e revisão humana

MatchDetails fornece listas atendido/faltante e três booleanos, sem evidência textual. A UI usa “Atende”/“Falta”; a ausência de palavra não prova ausência de competência. É necessário representar atendido, parcialmente evidenciado, evidência insuficiente e não atendido quando demonstrável; cada resultado deve guardar requisito, fonte e trecho/página.

A pontuação deve ser descrita como aderência aos critérios informados, nunca probabilidade de contratação ou sucesso. Retirar atributos pessoais irrelevantes do cálculo. Critério obrigatório deve ter semântica explícita e revisável por RH. Manter decisão humana separada e auditável.

Aprendizagem usa idade do relógio, exclui nascimento desconhecido, inclui 24 anos completos e não representa exceções. Ver E21, testes A01–A06 e documento 05. A ausência de dado não deve se transformar automaticamente em rejeição.

## Robustez do gateway

I01/I02: parser suporta deltas e linhas divididas em chunks. I06/I07/I10: mensagens para 429/402 e ausência de chave funcionam. I08: JSON inválido é rejeitado.

I04: response.failed depois de JSON completo é ignorado. Não exige response.completed; também não trata explicitamente incomplete, refused, canceled ou erro de stream. I05 mostra perda do buffer final num stream truncado sem newline; não deve ser confundido com defeito garantido de um stream SSE bem formado.

fetch não define timeout/AbortSignal, limite de saída ou retry com backoff. Não coleta usage, duração, custo ou modelo efetivo. Erros upstream têm trecho do corpo incluído na mensagem e podem ser persistidos em processing_error: risco de dados de diagnóstico inadequados à tela, não vazamento confirmado.

## Prompt injection e privacidade

Currículos são conteúdo não confiável. A instrução “nunca invente” e o schema não impedem o modelo de obedecer a instruções embutidas ou inventar skills plausíveis. Nenhum ataque foi enviado ao gateway; risco identificado por ausência de isolamento semântico e validação por evidência. Não há ferramentas de execução conectadas ao modelo neste helper; o risco demonstrável no desenho é contaminar extração/ranking, não execução remota de comandos.

Todo o documento é enviado ao fornecedor, incluindo dados irrelevantes que estejam no arquivo. Não há etapa de minimização/redação. Termos de retenção, treinamento, localização do processamento e suboperadores são não verificados.

## Melhorias recomendadas

P0: validar schema local, eventos terminais, intervalos e formatos; recusar saída inválida; timeout; erros sanitizados; limitar upload; bloquear score para extração inválida; retirar JSON bruto do matching; corrigir atomização do ranking.

P1: separar documento/extração/resultado/revisão; evidência por critério; versão de regras/prompt; fila simples com retries limitados, idempotência e consumo medido; editor humano completo; tratamento conservador de ausência.

P2: correspondência semântica por critério com evidência, usando sinônimos controlados e/ou IA como apoio. Não substituir a fórmula atual por um percentual livre de LLM. A nota final pode continuar determinística sobre critérios verificados, pesos versionados e dados ausentes explícitos.

## Benchmark proposto (não executado)

Preparar inicialmente 60–100 documentos fictícios/autorizados, balanceados entre PDFs textuais, digitalizados, fotos, duas colunas, baixa resolução, português/inglês, datas sobrepostas e lacunas. Incluir DOCX quando suportado. Rotular campos e evidências com dois revisores RH, resolver discordâncias; separar conjunto de ajuste e avaliação.

Usar 10–15 vagas com critérios claros e pares positivos/negativos; testar negações, sinônimos, requisitos duplicados, instruções maliciosas, mudança de ordem/layout e troca de nome mantendo qualificações. Repetir extração três vezes por item para estabilidade.

Medir precisão/recall de campos e competências, taxa de informação inventada, erro de datas/experiência, concordância por critério, recuperação de candidatos relevantes no top-k, estabilidade do ranking, qualidade das evidências, taxa de revisão, falhas, latência p50/p95 e custo por documento. Limiares devem ser aprovados antes da avaliação; recomendar zero informação pessoal inventada nos casos críticos e zero exclusão automática por dado desconhecido.

Custo deve usar usage real × tarifa vigente + armazenamento + tráfego + execução + retries. Não há base para estimar reais por currículo hoje. Não usar a confiança autodeclarada como métrica de acurácia.

