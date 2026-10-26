# Contas, acesso e permissões

Implementação na branch `ceny-versaonova`; banco novo `wikerxujjvmoksrmjywo`. A `main` do GitHub permanece preservada.

## Comportamento

- Primeiro acesso exige nome da empresa e nome do responsável. O e-mail precisa estar confirmado; somente a conta criadora recebe a responsabilidade inicial.
- Para entrar em empresa existente, o administrador cria um convite vinculado ao e-mail. A pessoa entra com esse e-mail confirmado e aceita o convite em **Empresas e acessos**. Prazo: sete dias. Criar o convite não dá acesso aos dados.
- Convites aparecem dentro da Ceny. **Não há envio automático de e-mail de convite**; a interface informa isso ao administrador. Confirmação de conta e recuperação de senha são e-mails do Supabase Auth.
- O responsável pode gerenciar administradores. Administradores gerenciam RH e gestores. Ninguém altera o próprio papel nem remove o responsável por meio da gestão comum da equipe.
- RH consulta, envia currículos, corrige campos permitidos e solicita avaliações. Gestor tem somente consulta. Administradores também arquivam registros. Pontuações e resultados automáticos continuam protegidos contra escrita direta.
- Alteração de função e retirada de acesso são verificadas no banco, inclusive para sessões já abertas. Convites emitidos pelo membro removido/rebaixado são revogados; códigos de recuperação vinculados ao membro também deixam de valer.
- Trocar de empresa consulta novamente a associação, esconde a tela durante a troca, cancela consultas, limpa os caches e remonta os formulários. A lista de associações é atualizada a cada 15 segundos e ao retornar à janela. O bloqueio no banco é imediato, independentemente desse intervalo visual.
- Sair da conta esconde os dados, limpa caches, solicita logout global e confirma a ausência da sessão local. Em caso de falha, a tela permanece bloqueada com opção de tentar novamente. O Supabase revoga refresh tokens; JWTs já emitidos têm validade própria até expirarem. Remover o vínculo com a empresa bloqueia o uso desses JWTs via RLS.
- Cadastro e redefinição usam a mesma política: mínimo de 12 caracteres, maiúscula, minúscula, número e símbolo; limite de 72 bytes. Login aceita a senha existente. Links incompletos, expirados ou usados não ativam o formulário de redefinição, mesmo se houver outra sessão no navegador.

## Recuperação administrativa

O responsável pode designar um e-mail de emergência e gerar um código aleatório de 256 bits. É necessário confirmar sua senha; o banco exige autenticação recente de até 15 minutos. O código é exibido apenas nessa resposta, não é salvo em cache ou armazenamento do navegador e só seu hash fica no banco privado.

Para usar o código, a pessoa deve entrar na conta do e-mail designado, confirmá-lo e confirmar novamente sua senha. O código vale por um ano, é de uso único e pode ser substituído pelo responsável a qualquer momento. A recuperação remove o acesso do responsável anterior, revoga convites pendentes e torna a conta de emergência responsável pela empresa. Depois, revise os demais membros e gere outro código. Guarde o código separado da conta de e-mail.

Sem código e sem acesso ao e-mail, não existe promoção automática de usuário pela interface. O operador do banco deverá verificar a titularidade da empresa por um procedimento humano documentado antes de qualquer intervenção privilegiada. Não aceite identificação de empresa por nome como prova.

## Configuração do serviço

No projeto novo, confirmação de e-mail está habilitada e contas anônimas estão desabilitadas. A política de senha acima e **Secure password change** foram salvas no painel. Evidência: [política de senha](politica-senhas.png).

Os destinos de autenticação desta etapa são locais: `http://127.0.0.1:8080`, com `/auth` e `/reset-password` explicitamente permitidos, também em `localhost:8080`. Quando houver um domínio definitivo, configure o Site URL e os dois destinos HTTPS correspondentes antes da publicação.

`supabase/config.toml` configura a instância local da CLI. A frequência de e-mail de um segundo e o limite de 30 e-mails pertencem ao capturador de e-mails de teste; não foram aplicados no serviço hospedado. Não há credenciais SMTP no repositório.

O painel do novo Supabase foi conferido: **custom SMTP está desabilitado**. Para atender clientes reais, ainda é necessário configurar um provedor de e-mail e remetente autorizado no painel. O envio padrão do Supabase é restrito; a validação completa desta etapa ocorreu no Mailpit do ambiente isolado, sem mensagens para destinatários reais.

## Validação

- 38 verificações das novas regras passaram no novo banco, com dados temporários e transação revertida. [Resultados](contas-sql-results.json).
- 19 testes de código passaram, incluindo falhas de logout, vínculo revogado, links inválidos com sessão existente e a política de senha.
- Typecheck e build passaram.
- `.github/workflows/accounts-test.yml` cria um Supabase descartável no runner, aplica todas as migrations e usa Mailpit para testar e-mails reais sem enviá-los a terceiros. Os 16 cenários de autenticação passaram, incluindo cadastro, confirmação, login, senha incorreta, redefinição, reutilização e expiração de links. As duas suítes SQL, os 19 testes de código, typecheck e build também passaram na [execução 40252858874](https://github.com/vitorbaadorno/ceny.assist/actions/runs/40252858874), no commit `b119219`.
- As telas de cadastro, link expirado e gestão de equipe foram verificadas no navegador local, com conta de teste descartável. A troca entre empresa administrada e empresa de consulta ocultou os controles administrativos; o logout ocultou os dados e retornou à entrada. As duas empresas temporárias e a conta técnica foram removidas, com contagens residuais iguais a zero confirmadas no banco. [Evidência da limpeza](limpeza-conta-teste.png). O botão Google foi retirado porque esse provedor está desabilitado no novo projeto.
- O advisor de segurança só apontou as três tabelas privadas com RLS sem políticas, intencionalmente inacessíveis aos clientes: quarentena de legado, códigos de recuperação e trilha administrativa.

Fontes: [senhas no Supabase](https://supabase.com/docs/guides/auth/password-security), [testes locais de e-mail](https://supabase.com/docs/guides/local-development/cli/testing-and-linting), [API do Mailpit](https://mailpit.axllent.org/docs/api-v1/).
