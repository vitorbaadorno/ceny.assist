# Decisões e plano — 17/11/2026

Base: `6ec0ef9`, branch `ceny-versaonova`. Implementação: `codex/lgpd-lancamento`.

O responsável aprovou todas as recomendações das 17 perguntas com: “Faça tudo que recomendou. Trabalhe na nova branch derivada da ceny-versaonova”. Essa aprovação técnica não constitui aprovação jurídica, comprovação de infraestrutura ou autorização para produção.

| Pergunta | Decisão / limite |
|---|---|
| 1 | Demonstração sintética; dados reais dependem do fechamento dos bloqueadores, inclusive no modo manual. |
| 2 | Gemini gratuito preservado; região e documentação contratual: `PENDENTE_VALIDACAO`. |
| 3 | PDF/imagem integral bloqueado; leitura e revisão manual privadas preservadas; OCR fora desta etapa. |
| 4 | Inventário somente de fluxos comprovados; integrações externas não identificadas: `PENDENTE_VALIDACAO`. |
| 5 | Menores/aprendizagem sem liberação para dados reais; preservar funcionalidade de conferência humana. |
| 6 | Papéis jurídicos são hipóteses; identificação empresarial: `PENDENTE_VALIDACAO`. |
| 7 | Canal, responsáveis operacionais e advogado: `PENDENTE_VALIDACAO`. |
| 8 | Minutas e páginas apenas para revisão local; sem aceite contratual fictício nem publicação. |
| 9 | Nenhum prazo inventado; execução de retenção depende da política aprovada; sem agendamentos. |
| 10 | Registro/encaminhamento administrativo restrito; anonimização e bloqueio não são sinônimos de arquivamento. |
| 11 | Escritas/testes de banco somente em CI/local descartável; hospedagem, staging e acessos: `PENDENTE_VALIDACAO`. |
| 12 | Fontes locais e proteção de incorporação; prévia deve ser segregada da produção. |
| 13 | Piloto por convite; uma empresa criada por usuário; MFA privilegiado condicionado a recuperação validada. |
| 14 | Assinatura de arquivos centralizada no backend, TTL fixo e revalidação de autorização. |
| 15 | Maps histórico permanece aberto até comprovação pelo responsável Google/Lovable. |
| 16 | Migrations aditivas forward; compensação aditiva e rollback de aplicação compatível, nunca apagar aplicada. |
| 17 | Branch derivada, commits para revisão; sem merge/deploy. Documentos de legado marcados históricos. |

## Ordem de implementação e validação

1. P0: `ai-privacy`, `resumes`, download Edge/Storage, cabeçalhos e fontes. Testes de conteúdo sintético, ausência de rede, acesso cruzado, limites e cabeçalhos. Risco: omissão profissional, download e hidratação.
2. P0: migrations aditivas de convite/cota, cobertura de catálogo/RLS, preparação de MFA. SQL/HTTP em CI descartável, autenticação e concorrência. Risco: onboarding, sessões e recuperação; nenhuma exigência de MFA antes de validar recuperação.
3. P1: direitos, encaminhamento, minutas e inventários, páginas de revisão, procedimentos. SQL de autorização/transições, UI e checagem de versão. Risco: interpretação jurídica e efeitos indevidos de solicitações; não automatizar atendimento jurídico.
4. P1/P2: codificação, lint completo, licenças, regressão/CI e relatório de aceite. Rodar baseline e suítes isoladas; falhas externas continuam bloqueantes.

## Baseline efetivamente observado

Typecheck passou; Node: `tests 162`, `pass 162`, `fail 0`; Bun interface: `19 pass`, `0 fail`, `78 expect() calls`; build exit 0 com avisos; scanner atual/bundle: `{"passed":true,"findings":[]}`. ESLint completo: `21371 problems (21359 errors, 12 warnings)`, incluindo CRLF/Prettier. Bun audit: `1 vulnerabilities (1 high)` em picomatch, GHSA-fc5q-39xc-vjpf. Gate comercial: NO-GO, IDs 1–20 bloqueados por falta de evidência aprovada exigida. Docker indisponível localmente; suítes isoladas não executadas nesta rodada. Histórico Maps não revarrido neste baseline; evidência anterior não comprova contenção.

Alteração pré-existente preservada: `src/routeTree.gen.ts` marcado pelo Git por normalização de linhas, sem diff de conteúdo.
