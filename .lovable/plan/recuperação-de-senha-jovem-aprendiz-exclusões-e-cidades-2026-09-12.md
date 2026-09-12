# Recuperação de senha, Jovem Aprendiz, exclusões e cidades

## Objetivo
Adicionar os quatro fluxos solicitados preservando a privacidade dos currículos, o histórico dos registros e uma experiência simples para o RH.

## Implementação

### 1. Recuperação de senha
- Adicionar “Esqueci minha senha” na tela de entrada, com envio do link para o e-mail informado e confirmação neutra para não revelar contas existentes.
- Criar a página pública `/reset-password`, validando que o acesso veio de uma recuperação válida.
- Solicitar nova senha e confirmação, aplicar a alteração pelo sistema de autenticação existente e retornar o usuário à tela de entrada.
- Tratar links inválidos/expirados, senhas divergentes e estados de carregamento; incluir os metadados próprios da nova página.

### 2. Jovem Aprendiz por idade
- Adicionar às vagas a categoria `regular` ou `jovem_aprendiz`, mantendo vagas existentes como regulares.
- Adicionar data de nascimento ao candidato. A IA tentará extraí-la do currículo; o RH poderá informar ou corrigir no perfil.
- Calcular a idade pela data atual. Um candidato será elegível apenas entre 14 e 24 anos; data ausente será considerada não elegível até correção.
- Incluir a categoria no cadastro e nos detalhes da vaga, além de filtro no topo da listagem.
- Mostrar data de nascimento, idade e elegibilidade no perfil do candidato.
- Em vagas Jovem Aprendiz, calcular e exibir ranking somente para candidatos elegíveis; vagas regulares continuam usando todos os candidatos ativos.

### 3. Exclusão com histórico
- Adicionar marca de exclusão e data da exclusão em candidatos e vagas.
- Revogar exclusão física direta dessas duas tabelas para preservar os registros históricos.
- Criar ações autenticadas no servidor:
  - candidato: apagar o arquivo privado, remover definitivamente seus scores e marcar o candidato como excluído;
  - vaga: remover definitivamente seus scores e marcar a vaga como excluída, sem alterar candidatos.
- Adicionar confirmação com o texto “Tem certeza que deseja excluir? Essa ação não pode ser desfeita” nos detalhes do candidato e nos detalhes/listagem de vagas.
- Filtrar registros excluídos em todas as listas, detalhes, reprocessamento, abertura de arquivo e recálculo de ranking, evitando que voltem a aparecer ou sejam processados.

### 4. Autocomplete de cidades com Google Maps
- Vincular ao projeto a conexão Google Maps Platform já disponível na conta; não solicitar nova chave.
- Criar funções autenticadas no servidor para sugestões e confirmação da cidade pela Places API, com credenciais mantidas fora do navegador.
- Limitar a busca a cidades brasileiras, usar idioma português, no máximo cinco sugestões, sessão por interação, debounce e descarte de respostas antigas.
- Criar um único campo reutilizável que padroniza a seleção como `Cidade - UF`.
- Usar esse campo no cadastro de vaga, na correção da cidade do candidato e no filtro por cidade do ranking.
- Interromper novas tentativas em erros de autorização ou cota e manter o valor atual editável.

## Alterações no banco
- `jobs`: categoria, marca/data de exclusão e validação dos valores aceitos.
- `candidates`: data de nascimento e marca/data de exclusão.
- Índices parciais para listas ativas e rankings.
- Migração aplicada pelo fluxo seguro do Lovable Cloud; sem alterar ou remover dados existentes.

## Validação
- Testar envio do e-mail, link de recuperação, confirmação de senha e link expirado.
- Testar limites de idade, aniversário, data ausente e exclusão de candidato/vaga.
- Confirmar que arquivo e scores são removidos conforme definido, enquanto os registros ficam ocultos e preservados.
- Testar digitação, sugestões, seleção e padronização de cidades nas três telas, sem chamadas diretas do navegador ao Google Places.
- Validar login, upload, extração, criação de vaga e ranking existentes em desktop e celular.
