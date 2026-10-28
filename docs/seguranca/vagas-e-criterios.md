# Vagas e critérios aprovados

Implementação na branch `ceny-versaonova`, banco novo `wikerxujjvmoksrmjywo`.

- Edição, encerramento e reabertura preservam candidatos. Administradores e RH podem gerenciar vagas; consulta não permite alterações.
- Validação no banco e na interface: título de 3–160 caracteres, descrição até 20.000, até 60 critérios, pesos inteiros 1–100, experiência de 0–100 anos. Campos desconhecidos e critérios escalares conflitantes são recusados.
- Ranking exige vaga aberta, descrição com ao menos 20 caracteres e ao menos uma competência, formação ou experiência positiva, com aprovação explícita do RH.
- Repetições de competências ignoram caixa, acentos e espaços; mantém-se o maior peso e a obrigatoriedade, sem somar repetições. Sinônimos diferentes continuam sujeitos à conferência humana.
- Pontuação proporcional aos pesos. Experiência admite proporção parcial. Um obrigatório não comprovado limita o resultado a 49%; isso não exclui automaticamente o candidato. O detalhamento informa os pontos por critério.
- Sugestões locais reconhecem seções Requisitos e Diferenciais, um item por linha. Não usam IA, não interpretam toda descrição livre e não aprovam requisitos automaticamente. Trechos de origem são preservados e conferidos na aprovação.
- Alterações invalidam a aprovação quando o conteúdo muda. Hash e versão aprovados acompanham a avaliação. O banco rejeita resultados de uma versão ultrapassada, inclusive lotes vazios.
- Histórico registra versões, antes/depois, responsável e horário. Modelos reutilizáveis são isolados por empresa e não copiam aprovação.
- Avaliações existentes são marcadas desatualizadas; o recálculo substitui a pontuação corrente. O histórico permanente desta etapa é o da vaga e dos critérios, não um histórico de todas as execuções de ranking.
- Controle de versão impede sobrescrita silenciosa entre editores; o rascunho local permanece disponível após conflito.

## Evidências

- Migração remota `20261028001604_job_criteria_governance` aplicada.
- `job_governance.sql`: 38 verificações aprovadas no banco novo, em transação revertida.
- Regressões remotas: 56 verificações de isolamento e 29 de revisão humana aprovadas.
- Testes unitários cobrem pesos, obrigatórios, repetição, limites, termos distintos e sugestões; compilação e verificação TypeScript/Deno aprovadas.
- Serviço `ceny-worker` atualizado. A autenticação é conferida no corpo da função com `getUser`, seguida de associação e papel na empresa.
- CI executa também testes HTTP em Supabase descartável: ranking ponderado, dois editores concorrentes, bloqueio de rascunho e vaga encerrada, reabertura com candidatos preservados.
- Nenhuma chamada real de IA nesta etapa. Não houve validação visual no navegador nesta continuação; a ferramenta de controle de navegador ficou indisponível.
- Auditor de segurança sem novos alertas: permanecem o aviso anterior sobre proteção contra senhas vazadas e quatro informações sobre tabelas privadas fechadas por RLS.
