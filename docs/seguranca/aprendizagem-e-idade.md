# Aprendizagem e idade — conferência jurídica pendente

O usuário informou que ainda não há parecer jurídico. Esta etapa implementa controles e conferência preliminar; não registra aprovação jurídica inexistente. A decisão sobre contratação e exceções permanece humana. Trabalho exclusivo na branch `ceny-versaonova`, com o Supabase novo `wikerxujjvmoksrmjywo`.

## Regra preliminar e fontes

A faixa geral consultada é a partir de 14 anos completos e antes do aniversário de 24 anos. O limite máximo não se aplica às pessoas com deficiência nos termos do art. 428, § 5º. Essa exceção não permite presumir a condição do candidato nem dispensa as demais verificações do contrato. Fontes oficiais consultadas em 28/10/2026:

- [CLT, arts. 403, 428 e 433 — Planalto](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm).
- [CLT atualizada — Câmara dos Deputados](https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-5452-1-maio-1943-415500-normaatualizada-pe.html).
- [Aprendizagem profissional — Ministério do Trabalho e Emprego](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/areas-de-atuacao/insercao-de-aprendiz-1/insercao-de-aprendiz).

Não é uma revisão jurídica concluída. O responsável jurídico deverá confirmar a regra aplicável à atividade, restrições ocupacionais, escolaridade, inscrição no programa, duração contratual, exceções e data efetiva de contratação.

## Comportamento implementado

- O antigo teste booleano que incluía 24 anos foi substituído por estados de conferência: data pendente, data inválida, faixa geral e conferência especial. A lista geral não rotula mais a pessoa como “Jovem Aprendiz” apenas pela idade.
- Data ausente permanece desconhecida. O sistema não usa foto, nome, escolaridade ou experiência para estimá-la. Nem ausência nem idade fora da faixa retiram candidatos do ranking ou alteram a nota profissional.
- Datas civis são validadas sem conversão permissiva: meses, dias, ano bissexto, regra dos séculos e datas futuras. O banco também protege inserções e atualizações. O intervalo cadastral aceito começa em 1900.
- A referência preliminar é a data de criação da análise em `America/Sao_Paulo`, não o relógio local do navegador. Data, idade calculada, situação e versão da regra ficam nos detalhes da avaliação. A consulta posterior não recalcula a idade com o dia atual.
- Para nascimentos em 29/02, a comparação preliminar do mês e dia muda a idade em 01/03 nos anos sem 29/02. O tratamento jurídico desse limite deve ser confirmado pelo responsável; não há exclusão automática por esse cálculo.
- Avaliações antigas sem conferência etária gravada exibem essa ausência e pedem novo cálculo, sem inventar um histórico.
- Administradores e responsáveis pela empresa podem registrar casos especiais no detalhe da avaliação. Justificativa, autor, horário, versões e data de referência são preservados. Registrar parecer recebido exige nome do responsável jurídico e referência do parecer; não gera decisão automática de elegibilidade.
- O registro é acumulativo e protegido contra edição direta, exclusão pelo cliente, conflitos e repetição do mesmo pedido. Mudanças na base ou na vaga exigem recálculo antes de nova conferência.
- Notas de casos especiais são restritas a `owner/admin`; profissionais de RH comuns, gestores de consulta e outras empresas não as acessam. Arquivamento do candidato ou da vaga retira o acesso normal. O formulário orienta a registrar procedimento e referência, sem copiar laudos ou diagnósticos.
- A extração da IA recebeu instrução explícita para não inferir nem extrair deficiência, saúde, raça, religião, orientação sexual e outros dados sensíveis, inclusive em resumos e evidências. O formato estruturado recusa campos adicionais de condição sensível, e esses registros administrativos não são enviados à IA nem usados na pontuação. Instruções e formato reduzem risco, mas não constituem garantia de que texto livre gerado por um modelo jamais contenha uma inferência: a revisão humana continua necessária.

## Validação

108 testes unitários aprovados, incluindo sete novos cenários de limites, datas, fuso, ausência de idade, invariância da nota e recusa de campos sensíveis. Dezoito verificações SQL passaram no Supabase novo, com dados sintéticos em transação desfeita, incluindo autorização, histórico, conflitos, idempotência e manutenção de candidatos com data ausente ou fora da faixa geral. A suíte HTTP descartável também verifica o registro da referência pelo servidor e duas conferências simultâneas.

Não foram realizadas chamadas reais à IA, conforme orientação anterior do usuário. A aprovação do responsável jurídico continua pendente. Os avisos de segurança preexistentes sobre tabelas privadas fechadas e [proteção de senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) permanecem fora do escopo desta etapa.

Verificação completa aprovada no commit `0565c94`: [execução 40801337239](https://github.com/vitorbaadorno/ceny.assist/actions/runs/40801337239). Além das regressões, a integração HTTP confirmou candidatos com data ausente e fora da faixa preservados, mesma nota profissional, referência etária gravada pelo servidor e conflito explícito entre duas conferências simultâneas. Em 29/10/2026 foram publicados `ceny-worker` versão 12 e `ceny-queue` versão 3 no projeto novo. A `main` remota permanece em `58df482099e187f25ef2c154789321df8b0b1815`.

A interface real foi conferida em prévia local com dados fictícios, sem gravação no banco: estados de data desconhecida e aniversário de 24 anos, confirmação obrigatória, salvamento e exibição do histórico. [Registro visual](aprendizagem-interface.png).
