# Observabilidade, acessibilidade e auditoria recorrente

## 17 — Métricas

Nova RPC `product_quality_metrics` retorna apenas agregados do tenant para owner/admin: falhas por formato, recebidos, cancelados/não recebidos, pendências, mediana/p95 do tempo desde enfileiramento até análise concluída, falhas/bloqueios e revisões humanas registradas. Pendências não contam como abandono; nenhum dado disponível não vira tempo zero. As revisões refletem o histórico ainda retido. Não há coleta de currículo, e-mail, navegação, texto ou ferramenta externa de analytics. SQL valida janela de até 90 dias e autorização corrente; interface consulta últimos 30 dias. A migration foi aplicada à Ceny e as permissões foram verificadas; testes SQL validam owner, outro tenant, consulta e anônimo. Testes de renderização validam ausência de medição, cache separado por empresa e erro recuperável. Publicação do frontend continua dependente do ambiente Lovable.

## 18 — Acessibilidade e erros

Autocomplete com combobox/listbox, setas, Enter/Escape, estado acessível e entrada manual em falhas; resultados atrasados são descartados. Link de salto e indicação da página atual na navegação. Erros gerais e 404 em português. Teste Chromium verifica layout 390 px, acesso anônimo e alternância de senha. Testes de renderização cobrem alertas e ações sem permissões. Revisão completa WCAG/contraste/leitor de tela das jornadas autenticadas continua pendente; não declarar certificação a partir desses testes.

## 20 — Bloqueios de release

CI em push/PR executa tipos, regressão, interfaces, limites/privacidade, scanner de segredos, auditoria de dependências, banco descartável/Storage real, métricas SQL, navegador e build. Testes nunca recebem GEMINI_API_KEY nem dados reais. O gate comercial `node scripts/check-release.mjs` falha por padrão (NO-GO). `CENY_RELEASE_EVIDENCE` aponta para arquivo protegido com `items` contendo os 20 IDs e, para cada um, `status:validated`, `reference`, `approved_by`, `validated_at` e `commit`. Evidências precisam ser do commit atual e ter menos de 30 dias. Referências devem apontar para provas reais; o programa valida estrutura/atualidade, não autenticidade jurídica.

Antes de publicar, exigir checks de engenharia **e** liberação comercial no ambiente/provedor. O workflow de liberação executa o gate e permanece vermelho sem evidências. Não há segredos ou evidências jurídicas embutidos no YAML. Configurar proteção de branch e deploy no GitHub/Lovable é uma verificação externa pendente; jobs no repositório não conseguem, sozinhos, impedir um provedor de publicar antes da CI.

Consulta em 16/11/2026: endpoint de rulesets retornou lista vazia; leitura da proteção clássica da branch retornou 403 (`Resource not accessible by integration`). Não se afirma ausência de toda proteção, mas não há comprovação de que os gates sejam obrigatórios no provedor.

Repetir auditoria antes de cada release e após mudança de fornecedor/modelo/permissão. Registrar diferenças, alertas, parecer, regressões e responsáveis. Dependência indisponível ou scanner não executado não equivale a aprovação. Não usar `continue-on-error` para testes críticos.

Em 17/11/2026, os gates `history-security` e `dependency-security` permanecem reprovados, respectivamente pela chave Maps histórica sem comprovação de contenção e por GHSA-fc5q-39xc-vjpf sem versão oficial corrigida. Ambos são jobs independentes da regressão; a execução geral continua vermelha. Ver `../seguranca/dependencia-picomatch-2026-11-17.md`.
