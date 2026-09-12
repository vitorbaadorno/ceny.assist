# Ceny

Quero criar uma aplicação web para digitalizar e automatizar a triagem de currículos de uma empresa. O objetivo é substituir o processo manual de análise de currículos físicos por um fluxo automatizado: upload do currículo, extração de dados via IA, armazenamento estruturado, filtragem por vaga e geração de relatório com os melhores candidatos.

## Funcionalidades principais (MVP)

1. **Upload de currículos**

   - Tela onde o RH faz upload de currículos em PDF ou imagem (foto de currículo físico escaneado)

   - Suporte a upload de múltiplos arquivos de uma vez (upload em lote)

   - Cada upload cria um registro de "candidato" no sistema com status "processando"

2. **Extração automática de dados via IA**

   - Ao subir o arquivo, enviar o conteúdo (texto ou imagem) para um modelo de IA que extraia os seguintes campos estruturados: nome completo, e-mail, telefone, cidade/localização, formação acadêmica, experiências profissionais (empresa, cargo, período, descrição), habilidades/skills, idiomas, certificações

   - O resultado deve ser salvo em formato estruturado (JSON) no banco de dados, vinculado ao candidato

   - Se a extração falhar ou tiver baixa confiança em algum campo, marcar o candidato como "revisão manual necessária"

3. **Cadastro de vagas**

   - Tela para criar/editar vagas com: título da vaga, descrição, requisitos obrigatórios (lista de skills), requisitos desejáveis, experiência mínima (anos), formação exigida, localização

4. **Filtro e ranking de candidatos por vaga**

   - Para cada vaga, comparar os candidatos cadastrados com os requisitos definidos

   - Calcular uma pontuação de aderência (score) baseada em quantos requisitos obrigatórios e desejáveis o candidato atende

   - Exibir lista de candidatos ordenada por score, do mais aderente ao menos aderente

   - Permitir filtros manuais adicionais (localização, anos de experiência, etc.)

5. **Dashboard de candidatos**

   - Listagem geral de todos os candidatos com busca e filtros (nome, skills, status)

   - Página de detalhe do candidato mostrando todos os dados extraídos e o currículo original (link para visualizar/baixar)

   - Status do candidato no funil (novo, em análise, aprovado, rejeitado, contratado) — atualizável manualmente pelo RH

6. **Geração de relatório**

   - Botão em cada vaga para "Gerar relatório dos melhores candidatos"

   - O relatório deve trazer: top 5-10 candidatos por score, com nome, principais qualificações, pontos fortes e um breve resumo gerado por IA de por que o candidato é adequado para a vaga

   - Relatório deve poder ser exportado em PDF e/ou enviado por e-mail para o dono da empresa

## Estrutura de dados sugerida

- Tabela `candidates`: id, nome, email, telefone, localização, dados_extraidos (JSON), status, arquivo_original_url, data_cadastro

- Tabela `jobs`: id, titulo, descricao, requisitos_obrigatorios (array), requisitos_desejaveis (array), experiencia_minima, formacao_exigida, localizacao, data_criacao

- Tabela `candidate_scores`: id, candidate_id, job_id, score, detalhes_matching (JSON)

## Requisitos técnicos

- Interface limpa, profissional, fácil de usar por uma equipe de RH sem conhecimento técnico

- Autenticação simples (login para a equipe de RH que vai usar o sistema)

- Todo processamento pesado (OCR, extração via IA, cálculo de score) deve rodar em backend/edge functions, não no frontend

- Preciso integrar com uma API de IA (ex: Anthropic Claude ou OpenAI) para a extração de dados e geração dos resumos do relatório — vou fornecer a chave de API separadamente

- Se o upload for de imagem/foto (não PDF com texto selecionável), preciso de um passo de OCR antes da extração — pode usar a própria API de IA multimodal para isso, se ela suportar leitura de imagem diretamente

- Atenção à LGPD: os dados dos candidatos são dados pessoais sensíveis, então preciso de controle de acesso (só usuários autenticados da empresa acessam) e não expor nenhum dado publicamente

Comece pelo MVP: upload de currículo, extração de dados via IA, cadastro de vaga, e listagem de candidatos com score. Deixe a geração de relatório em PDF e envio por e-mail como uma segunda etapa, mas já estruture o banco de dados pensando nisso.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cennyassist.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ec1c245c-df41-4f5d-9add-eb7c40442941).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
