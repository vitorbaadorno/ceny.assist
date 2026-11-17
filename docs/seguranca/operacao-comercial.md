# Operação comercial — procedimentos e pendências

## 06 — Backup e recuperação

Ferramentas: `backup-snapshot.mjs` exporta dump lógico e bytes de todos os buckets, cifra cada arquivo com AES-256-GCM e confere a leitura; grava o manifesto cifrado somente ao terminar. O dump é limitado a 512 MB em memória e cada objeto a 50 MB; exceder interrompe sem anunciar sucesso. O projeto atualmente aceita currículos até 10 MB. O executor precisa de `pg_dump` compatível e conexão direta verificada (`PGSSLMODE=verify-full`, certificado raiz, `PGHOST`, `PGUSER`, `PGDATABASE`, segredo via cofre/pgpass). Nunca registrar stderr bruto ou linha de conexão.

Definir `CENY_BACKUP_DIRECTORY` em volume **externo ao projeto e ao conjunto restaurado**; cifragem em `CENY_BACKUP_ENCRYPTION_KEY` (32 bytes aleatórios em base64). Restringir ACL no host; `mode:0600` não garante ACL Windows. O programa não escolhe provedor nem contrata espaço. Manter a chave em cofre independente, com substituto e ensaio de acesso. Credenciais, Vault, chaves de assinatura, SMTP/OAuth, Edge Secrets, domínio e acesso ao cofre devem constar no inventário restrito de recuperação; não exportar esses segredos para GitHub.

Consistência exige pausa efetiva de novas gravações, uploads e workers na infraestrutura. `CENY_BACKUP_WRITES_QUIESCED=confirmed` é uma declaração operacional, não implementa a pausa. Pausar somente em janela autorizada. Aplicar `node scripts/backup-snapshot.mjs`; ausência de `manifest.enc` significa cópia incompleta. A cópia do banco não inclui bytes de Storage por si só, conforme [documentação Supabase](https://supabase.com/docs/guides/platform/backups).

Ensaio: obter autorização para staging isolado, bloquear acesso externo e workers, descriptografar em volume temporário protegido com `decryptRecovery`, verificar hashes, restaurar dump com DBA e objetos via Storage API, aplicar migrations atuais, reconciliar o manifesto externo mais recente com `privacy-recovery.mjs`, concluir exclusões e confirmar que tokens/vínculos anteriores não autorizam acesso. Reaprovar acessos e rotacionar credenciais antes de abrir. Não executar restauração no ambiente publicado.

RPO/RTO, frequência, retenção das cópias, custódia e responsáveis **aguardam aprovação**. Registrar início/fim, idade da cópia, duração, hashes, contagem de objetos, falhas e assinatura do aprovador. O teste SQL/Storage descartável da CI não certifica recuperação hospedada. Nenhuma recuperação hospedada foi executada nesta entrega.

## 07 e 08 — Monitoramento e manifesto externo

`check-operations.mjs` faz GET HTTPS no site e consultas de contagens: trabalhos sem avanço >15 min, eliminações >30 min, três tentativas, bloqueios e falhas de IA. Retorna somente códigos e exit code; nenhuma URL, mensagem de fornecedor, nome ou currículo aparece na saída. `replicate-ledger.mjs` exporta o manifesto assinado, cifra em volume externo e verifica leitura, origem, idade e continuidade dos candidatos/objetos eliminados. Um manifesto com registros desaparecidos falha e preserva os anteriores. A recuperação revoga todos os vínculos e convites restaurados, inclusive os não cobertos por tombstones específicos.

Operador deve configurar executor privado fora do Supabase, destino persistente protegido e alertas por falha/ausência de execução. Frequência proposta: exportar a cada 5 min e verificar logo depois; manifesto com mais de 15 min gera alerta. Isso não é RPO aprovado. `CENY_EXTERNAL_LEDGER_DIRECTORY` deve ser um mount externo com backup e retenção imutável; um diretório diferente no mesmo disco não assegura independência. Arquivo `.ledger-lock` abandonado exige confirmar ausência de exportador ativo antes de removê-lo. Primeiro snapshot é baseline; continuidade não comprova exclusões perdidas antes dele. Monitoramento de ausência precisa existir fora do executor (dead-man switch), senão um host desligado não alerta.

Secrets do executor: `SUPABASE_SERVICE_ROLE_KEY`, `CENY_RECOVERY_SIGNING_KEY`, `CENY_BACKUP_ENCRYPTION_KEY`. Configuração: `SUPABASE_URL`, `CENY_SITE_URL`, `CENY_RECOVERY_SOURCE_PROJECT`; `CENY_LAST_VERIFIED_LEDGER_AT` deve vir do exportador com sucesso de leitura. Nunca usar hora atual como substituto de exportação falha. Não copiar segredo Gemini para o executor. Ainda faltam destino, plantão, custódia e teste de entrega dos alertas; scripts não significam replicação ou monitoramento implantados.

## 09 e 10 — Auth e segredos

`audit-production-auth.mjs` consulta a [Management API](https://supabase.com/docs/reference/api/v1-get-auth-service-config), compara domínio HTTPS, redirects exatos, confirmação, complexidade de senha, proteção contra vazamentos, reautenticação, usuários anônimos e validade de JWT. Usa `SUPABASE_ACCESS_TOKEN`, `CENY_SUPABASE_PROJECT`, `CENY_SITE_URL`; imprime somente nomes dos controles falhos. Não salva configuração bruta (pode conter SMTP). Ausência de proteção disponível apenas em plano pago continua como pendência; não contratar automaticamente.

Executar cadastro, confirmação, convite, recuperação, logout global, expiração e acesso revogado com contas sintéticas no ambiente autorizado. O `config.toml` local não comprova o painel hospedado. Não alterar URLs reais sem conhecer o domínio.

`node scripts/security-scan.mjs --build --history` inspeciona arquivos versionados, histórico local disponível e bundle público sem imprimir valores. Detecta chaves conhecidas, JWT service role, chaves privadas e referências privilegiadas no browser; não substitui scanner corporativo, revisão de logs ou rotação se houver exposição. Testes `edge-boundaries` exercitam ausência de JWT, identidade inválida, token de scheduler falso e métodos indevidos nos handlers reais com dependências instrumentadas.

## 11 — Limites e custos

O monitor exige `CENY_DAILY_TOKEN_BUDGET` inteiro positivo definido pelo operador. Soma recibos concluídos nas últimas 24 horas por páginas, sem ler currículos. Orçamento ausente, ultrapassado ou recibos com consumo desconhecido geram alerta; o serviço gratuito não torna o consumo ilimitado. Esse teto é um alarme adicional, não substitui as cotas atômicas de admissão nem limitações impostas pelo Google.

Limites existentes: 5 arquivos/lote, 10 MB/arquivo, 20 páginas, 8 milhões de pixels, 20 MB descompactados, 60 mil caracteres, até 3 tentativas, timeout do trabalho 120 s e da chamada Gemini 90 s. O banco possui admissão por usuário/empresa e cotas mensais atômicas. O limite de 10 solicitações/minuto do endpoint **não equivale à cota Gemini do projeto**, compartilhada entre empresas; [limites Google](https://aistudio.google.com/docs/rate-limits) variam por modelo/projeto. No plano gratuito nenhum currículo real é enviado; não declarar capacidade ou custo por currículo mensurados.

Ensaiar concorrência com dois tenants e recusas 429, timeout e lease vencida na CI; depois carga sintética em staging com limites reais documentados e autorização de cota. A área de consumo já distingue tokens desconhecidos e valores conciliados; zero não substitui fatura ausente. Confirmar preço comercial somente após medir p50/p95, tentativas, bytes-hora e suporte. Não adicionar retries ilimitados nem fallback para fornecedor não aprovado.

## 16 — Suporte, incidente e titular

Designar titular e substituto para operação, segurança, suporte e privacidade; criar canal real e validar recebimento. Não publicar endereço inventado. Proposta de SLA interno a aprovar: P0 de exposição/isolamento, resposta 30 min e atualização horária; P1 indisponibilidade, resposta 2 h; P2 funcional, próximo dia útil. Estes tempos não são prazo legal nem compromisso comercial contratado.

Incidente: registrar código e horário, conter acessos/processamento afetados, preservar evidências em cofre, avaliar escopo com jurídico/controlador, decidir comunicações e prazos aplicáveis, corrigir, validar isolamento e recuperação, registrar causa e ação preventiva. Evitar conteúdo pessoal em tickets e logs. Não comunicar autoridade/titulares automaticamente sem avaliação responsável.

Titular: abrir pedido em Privacidade e dados, confirmar identidade por referência mínima, identificar controlador, localizar cadastro e versões, registrar prazo aplicável validado, revisar dados de terceiros na exportação, corrigir ou solicitar eliminação pela saga, respeitar retenção justificada, conferir término dos bytes, responder por canal autorizado e manter evidência mínima. Nenhum pedido de eliminação pode ser marcado concluído com arquivos pendentes.

Simulação de mesa reproduzível: empresa A tenta ler B → negar e registrar; titular sintético pede eliminação → identidade, hold ativo impede, liberação justificada, falha Storage mantém pendente, retomada completa, restauração exige tombstone. Controles têm testes; faltam exercício humano com plantão, canal real, medição de resposta e aprovação. Não registrar a simulação operacional como concluída até executá-la com responsáveis.
