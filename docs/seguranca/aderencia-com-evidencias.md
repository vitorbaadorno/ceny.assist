# Aderência com evidências — evidence-v3

Implementada na `ceny-versaonova`, no Supabase novo. A nota representa somente aderência aos critérios aprovados; não prevê desempenho, sucesso ou contratação. A decisão final é do RH.

## Regras

- Somente valores de competências, idiomas, certificações, experiências, projetos, formação e localização entram na comparação. Nome, contato, nascimento, características pessoais, instituições/empregadores, chaves internas e resumo interpretativo não acrescentam pontos. O ranking deixou de excluir automaticamente candidatos por idade.
- Limites de palavras distinguem Java/JavaScript e C/C++/C#. Equivalências explícitas e versionadas incluem JS/JavaScript, TS/TypeScript, Excel/Microsoft Excel, PowerBI/Power BI, Postgres/PostgreSQL, RH/Recursos humanos, gestão/gerenciamento de projetos/project management e inglês/English.
- Negações explícitas são diferenciadas de ausência. Contradição entre afirmação e negação exige revisão. Interesse ou aprendizado, nível inferior/desconhecido e competência sem contexto de trabalho quando se exige experiência recebem atendimento parcial.
- Formação concluída exige declaração explícita; andamento é parcial para exigência de conclusão; incompleta/interrompida não atende. Datas sozinhas não comprovam conclusão. O campo de período da formação pode ser corrigido pelo RH para registrar a situação.
- Quatro estados: atendido, parcialmente comprovado, sem informação suficiente e não atendido por evidência explícita. Ausência não significa incapacidade.
- Cada critério recebe uma parcela proporcional ao peso aprovado: integral 1, parcial 0,5, desconhecido/negação 0. Experiência numérica usa a proporção entre anos registrados e exigidos, limitada a 1. Obrigatório sem atendimento integral limita a nota a 49. Categorias não exigidas não geram pontos. Vaga vazia não gera ranking; candidato vazio não recebe 100.
- Experiência desconhecida é exibida como não informada, nunca como zero comprovado; o filtro numérico também não aceita ausência como zero.
- Cada conclusão traz motivo e evidência do campo pertinente. Trechos conferidos na extração são apresentados com página quando disponível. Dado extraído sem trecho conferido é identificado como tal. Correções humanas prevalecem sobre evidências antigas da IA e têm origem explícita.
- A interface identifica avaliações de fórmulas antigas como desatualizadas. Na inspeção anterior à implantação havia zero avaliações no banco novo; nenhuma migração estrutural foi necessária.

## Medição e limites

31 testes novos passaram: 25 pares de referência de correspondência/negação/equivalência e seis grupos de controles de formação, ausência, dados pessoais, contexto, origem e pontuação. Os 25 pares tiveram 25 classificações esperadas (100% nesta amostra sintética). Isso é evidência de regressão controlada, não estimativa de precisão em currículos reais.

A comparação de significado é limitada ao dicionário e às regras explícitas. Não é compreensão semântica irrestrita: frases complexas, ambiguidades, sinônimos fora do dicionário e níveis subjetivos ainda precisam do RH. Não houve chamadas reais de IA nem avaliação independente com currículos reais, conforme orientação do usuário. A declaração em currículo também não equivale a comprovação externa de habilidade.

Verificação TypeScript, Deno e compilação local aprovadas. A suíte de CI inclui os testes anteriores de autorização, arquivos, revisão, vagas e chamadas HTTP ao ranking em ambiente descartável.
