# Política de Cookies e Armazenamento

**MINUTA — NÃO VALIDADA JURIDICAMENTE**

Versão: 0.1 · Data: 18/11/2026 · Publicação/vigência: PENDENTE_VALIDACAO

## Inventário observado
O cliente Supabase mantém sessão no localStorage, com chave derivada do projeto. Esse estado contém material de autenticação: não enviar a analytics, suporte ou logs. Logout tenta revogação global e limpa a sessão local e caches; JWTs emitidos possuem validade própria, e o banco verifica vínculos correntes.

React Query mantém consultas em memória e limpa o cache na troca de empresa/saída. Formulários mantêm rascunhos em memória. O componente de biblioteca sidebar contém cookie sidebar_state, mas não foi encontrado importador ativo no aplicativo. O módulo previewAuthStorage contém broker de sessão Lovable, porém não está conectado ao cliente atual. Código disponível não comprova uso em produção.

Fontes são servidas pelo próprio aplicativo. Não foi identificada integração ativa de marketing ou analytics em src. Cookies ou scripts acrescentados pelo hospedeiro final permanecem PENDENTE_VALIDACAO.

## Preferências e mudanças
Não foi introduzido banner de consentimento genérico sem cookies não necessários comprovados. Antes de incluir analytics, marketing ou terceiros, inventariar finalidade, duração e destinatários, validar base e eventual mecanismo de preferências. Classificação jurídica, canal e períodos de armazenamento: PENDENTE_VALIDACAO. Esta descrição deverá ser conferida no domínio publicado antes de entrar em vigor.

Validação por profissional habilitado e responsável pela aprovação: PENDENTE_VALIDACAO.
