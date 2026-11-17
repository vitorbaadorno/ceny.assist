# Dependência vulnerável — picomatch

Em 17/11/2026, a auditoria automática passou a reportar **GHSA-fc5q-39xc-vjpf / CVE-2026-112366**, severidade alta, para `picomatch <=4.0.7`. O lockfile contém 4.0.7 e cópias transitivas 4.0.5, trazidas por Vite, TanStack e ferramentas de build/lint.

O [aviso revisado do GitHub](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) informa ausência de versão corrigida. Consulta ao [registro oficial](https://registry.npmjs.org/picomatch) confirmou `latest=4.0.7`. A atualização compatível não está disponível; não se fixou uma versão inexistente, não se adotou fork não revisado e não houve exclusão do alerta.

Risco: negação de serviço por processamento de padrões glob maliciosos. A presença transitiva não comprova exploração na aplicação Ceny, mas o alcance em artefatos e ferramentas publicados ainda precisa de avaliação. Não expor o servidor de desenvolvimento a entradas não confiáveis. Essa orientação não encerra o achado.

O job `dependency-security` executa `bun audit --audit-level=high` e permanece reprovado. Ele roda separadamente da regressão, assim como `history-security`; a execução geral continua vermelha e o gate comercial não libera. Não há `continue-on-error` nem supressão de advisory.

Para encerrar: obter release oficial corrigida (ou correção submetida a revisão e validação específicas), atualizar o lockfile, verificar todas as cópias transitivas, repetir auditoria, build, tipos e jornadas. Até lá, registrar a vulnerabilidade como pendência P1/NO-GO. As três Edge Functions publicadas antes desse achado não utilizam o lockfile Bun do frontend; o deploy autorizado não publicou novos pacotes Bun.
