# Envio e leitura de currículos

Implementação em `ceny-versaonova`, no Supabase novo `wikerxujjvmoksrmjywo`. A `main` permanece preservada.

Atualização: a leitura passou a usar a [fila persistente](fila-curriculos.md), com agendamento independente, retentativas limitadas e reprocessamento explícito. As descrições abaixo de reserva única sem repetição e de início manual por falta de configuração registram o comportamento da etapa anterior; o comportamento atual está no documento da fila.

## Formatos e limites

- PDF, Word DOCX, JPEG/JPG e PNG. DOC, DOCM, arquivos com senha, macros, anexos executáveis, scripts e referências externas ativas são recusados.
- 5 arquivos por lote, 10 MiB por arquivo, 20 páginas por PDF e 8 megapixels por imagem. O tamanho também é limitado no corpo HTTP, no banco e no bucket privado.
- DOCX: até 20 páginas **declaradas/estimadas**, 60.000 caracteres, 200 componentes ZIP, 20 MiB descompactados no total, 4 MiB por componente e expansão máxima de 200:1. A paginação depende de fontes e do Word; não há renderização de layout no servidor. Usa-se o maior valor entre metadados, quebras e estimativa de 3.000 caracteres por página. O limite de caracteres/descompactação é efetivo mesmo com metadados falsificados.
- O conteúdo real é conferido independentemente do MIME do navegador. DOCX passa por validação ZIP, CRC, XML, tipo de documento e referências. Imagens são decodificadas com limites. PDFs passam por análise estrutural, árvore de páginas, conteúdo ativo e streams.
- A leitura não executa código do documento nem resolve referências externas. PDFs com codecs de imagem especializados (JBIG2, JPEG2000, CCITT), PNG entrelaçado/16 bits e DOCX com campos ativos ou componentes não suportados recebem orientação de exportação. Não é um serviço de antivírus e não promete detectar toda ameaça possível.
- `pdf-lib` está fixado em 1.17.1: o adaptador limita alocações de descompactação **antes** de expandir, profundidade, número de objetos e duração do parser. Mudanças de versão exigem repetir os testes de documentos hostis. A instância Edge acrescenta limites de CPU/memória da plataforma; uma interrupção desse tipo nunca autoriza armazenamento ou leitura por IA automaticamente.

## Registro, deduplicação e falhas

O serviço valida os bytes e calcula SHA-256. Uma reserva atômica cria candidato e documento antes de armazenar o original. A chave `(company_id, sha256)` e o bloqueio transacional impedem duplicatas entre abas, lotes e pedidos simultâneos. Renomear o mesmo arquivo não cria outro candidato. Arquivos de conteúdo diferente não são mesclados automaticamente, mesmo que se refiram à mesma pessoa.

Somente o serviço pode criar candidatos e gravar/remover originais. O navegador não pode contornar a validação usando diretamente a API do banco ou do Storage. Autor, horário e origem ficam registrados no documento; a origem é declarada pelo remetente, enquanto usuário e horário são obtidos no servidor. Vínculo e permissão são conferidos novamente na persistência.

Se o armazenamento ou sua confirmação falharem, há compensação pela API do Storage. Caso o processo seja interrompido ou a remoção falhe, o documento permanece vinculado e conciliável. A conciliação ocorre antes de novos lotes e também pelo botão administrativo **Conferir e limpar envios interrompidos**. Usa uma carência de uma hora, superior à vida da função, para não remover envios em andamento. Remove arquivos órfãos e uploads interrompidos, preservando originais associados a candidatos e referências da quarentena. Não há agendamento independente: sem novos lotes, o administrador aciona a conferência.

Uma reserva exclusiva e persistente libera uma única chamada à IA por documento. Reenvios e falhas ambíguas não repetem a chamada: documentos interrompidos passam para revisão. Isso evita cobrança duplicada pela repetição do envio, mas não garante estorno de uma chamada já recebida pelo provedor. A falta de configuração da IA mantém o arquivo em **enviado**, sem consumir a reserva de processamento; a leitura pendente pode ser iniciada depois de configurar o serviço.

## Interface

A seleção cria uma fila antes de iniciar o lote. São mostrados separadamente: aguardando, enviando/validando, enviado, em leitura, concluído, revisão e erro. Cada recusa possui seu motivo. O resumo conta concluídos, falhas, revisões, pendentes e registros reaproveitados; todos os arquivos falharem resulta em aviso de erro.

O cache de candidatos é invalidado imediatamente após cada registro/resposta e ao concluir a leitura. O histórico da empresa consulta o banco a cada cinco segundos e preserva andamento e auditoria após recarregar a página. Sair da tela ou trocar de empresa cancela os próximos envios; pedidos já recebidos continuam protegidos pelo registro no banco. O original mantém o nome/extensão no download autorizado.

## Validação

- `supabase/tests/resume_intake.sql`: 28 verificações passaram no banco novo, em transação revertida.
- Testes locais cobrem documentos válidos, extensão falsa, corrupção, macros, scripts, ciclos, expansão excessiva, páginas, imagens grandes, corpo HTTP sem Content-Length, deduplicação da chamada à IA e resumos com falhas.
- O workflow testa também a API Edge e o Storage em Supabase descartável, sem enviar currículos reais ou contratar processamento de IA.
- O advisor de segurança mantém apenas os três avisos informativos das tabelas privadas intencionalmente sem políticas de acesso.
- A [execução 40299509430](https://github.com/vitorbaadorno/ceny.assist/actions/runs/40299509430), no commit `44ec3d4`, passou: 31 testes de código, 7 cenários reais de envio/Storage, 16 cenários de autenticação, as três suítes SQL, typecheck e build. Os sete cenários incluem os quatro formatos, repetição simultânea, rejeição antes do cadastro, bloqueio de acesso direto ao Storage, limites no servidor, IA ausente sem consumo da reserva e remoção real de arquivo órfão.
- A interface autenticada foi conferida visualmente: [captura](envio-curriculos-interface.png). A autorização do navegador para anexar o arquivo sintético foi recusada; por isso, o envio completo foi validado no ambiente descartável do CI, sem contornar o bloqueio. A conta e a empresa temporárias da conferência visual foram removidas, com contagens residuais zero confirmadas no banco; não receberam arquivos.
- O backend foi publicado como `ceny-worker` versão 3, correspondente aos arquivos testados. As duas migrations desta etapa estão aplicadas no projeto novo. Nenhuma chave de IA foi criada ou contratada nesta etapa.

Referências: [limites do Storage](https://supabase.com/docs/guides/storage/uploads/file-limits), [limites de execução Edge](https://supabase.com/docs/guides/functions/limits), [opções do parser PDF](https://pdf-lib.js.org/docs/api/interfaces/loadoptions).
