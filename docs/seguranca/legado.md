# Revisão e importação do legado

O projeto anexado contém código e migrações, não uma exportação dos registros e arquivos. A conta nova estava sem tabelas da aplicação. Nenhum registro real antigo foi atribuído automaticamente a uma empresa.

`private.legacy_records` e o bucket privado `legacy-quarantine` são a área de quarentena. Usuários da aplicação não têm permissões sobre essa tabela, e não existem políticas que liberem seus arquivos. O schema `private` não deve ser incluído nos schemas expostos pela Data API.

## Procedimento para uma importação autorizada

1. Exportar dados e arquivos da origem autorizada, preservando identificadores, relações candidato/vaga, autor e origem. Não presumir que `created_by` identifica a empresa: um usuário pode trabalhar para várias empresas.
2. Importar os JSONs para `private.legacy_records` com `source_system`, `source_table`, `source_id` e `payload`. Enviar os arquivos para `legacy-quarantine` via API de Storage de servidor, registrando o caminho em `original_object_path`. Não inserir metadados de arquivos diretamente em `storage.objects`.
3. Um responsável autorizado confere contratos, cadastro do cliente, origem do envio e demais provas. Registrar `confirmed_company_id`, `ownership_evidence`, `reviewed_by` e `reviewed_at`. O banco exige os quatro campos para confirmar a atribuição. Evidência ausente, vazia ou autoria duvidosa mantém o registro em quarentena.
4. Validar todo o conjunto de relações. Candidato e vaga devem pertencer à mesma empresa; duplicatas e relações ambíguas ficam em quarentena. Nunca criar uma empresa genérica acessível para dados sem responsável.
5. Preparar um importador específico para o formato do export recebido. Não há importador genérico que copie cegamente o `payload` para tabelas públicas. Usar allowlist de campos, IDs novos e mapa de IDs antigos/novos. Importar relações dentro de transação; chaves estrangeiras compostas rejeitam empresas diferentes.
6. Copiar o original via Storage para o caminho gerado no novo candidato (`empresa/candidato/original`). Conferir conteúdo, hash, tamanho e empresa antes de liberar leitura; a importação deve manter o candidato arquivado até concluir os arquivos. Não preservar URLs públicas antigas como acesso ao original novo.
7. Recalcular pontuações e reconstruir relatórios a partir dos registros conferidos. Não distribuir snapshots antigos com candidatos ainda não conferidos. Só marcar `imported_at` após verificar o destino; o banco proíbe marcar importação sem uma empresa confirmada.
8. Executar testes de isolamento com duas empresas, inclusive download e tentativa de associação cruzada, antes de liberar o lote. Registrar operador, evidências e resultado. A tabela de quarentena é operacional: operadores de banco privilegiados podem alterá-la; não é um log imutável de auditoria.

Esta etapa entrega a quarentena e suas barreiras de acesso. A identificação efetiva dos responsáveis e a migração dos registros reais dependem da exportação e da conferência humana de titularidade.
