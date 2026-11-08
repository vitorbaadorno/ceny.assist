# AnÃ¡lise com Google Gemini

O upload validado permanece no bucket privado resumes. analisar-curriculo autentica pelo Supabase e usa os mesmos comandos de fila e cotas da plataforma. O banco limita a 10 chamadas por minuto por usuário e empresa, usando atualização atômica da janela. O agendador ceny-queue processa o original em segundo plano com reserva, recuperaÃ§Ã£o e limite de tentativas. Novas chamadas com action=analyze recebem companyId, candidateId, jobId e requestId. Elas exigem vÃ­nculo ativo com a vaga aprovada e reservam a anÃ¡lise pelo documento ativo. A avaliaÃ§Ã£o por vaga continua usando os snapshots, versÃµes, critÃ©rios aprovados e evidÃªncias da plataforma.

A configuraÃ§Ã£o do modelo estÃ¡ em _shared/gemini-config.ts. O identificador inicial Ã© gemini-2.5-flash. GEMINI_MODEL permite uma troca pelo backend. Confirme disponibilidade e condiÃ§Ãµes antes de trocar. A API pode redirecionar identificadores depreciados. model_requested e model_reported registram essa diferenÃ§a.

A credencial Ã© lida somente no runtime Edge. Configure tambÃ©m CENY_GEMINI_DATA_TIER=paid e CENY_GEMINI_PRIVACY_REVIEW_REFERENCE com a referÃªncia real da validaÃ§Ã£o contratual e de privacidade do projeto Google associado. Esses controles devem ser preenchidos apÃ³s confirmar billing e condiÃ§Ãµes do fornecedor. A existÃªncia da credencial nÃ£o comprova essas condiÃ§Ãµes. A validaÃ§Ã£o anterior do fornecedor Lovable nÃ£o libera o Gemini. Enquanto pendente, a fila registra bloqueio de configuraÃ§Ã£o e permite revisÃ£o humana.

DOCX usa o extrator local jÃ¡ limitado, com minimizaÃ§Ã£o de identificaÃ§Ã£o. PDF e imagens passam pela validaÃ§Ã£o de tamanho, estrutura e pÃ¡ginas e usam entrada binÃ¡ria inline somente apÃ³s a validaÃ§Ã£o do serviÃ§o pago. A transmissÃ£o integral desses formatos pode conter identificaÃ§Ã£o pessoal. A referÃªncia de aprovaÃ§Ã£o deve abranger esse uso. Os originais permanecem na infraestrutura privada da Ceny. A integraÃ§Ã£o nÃ£o usa a Files API do Google. NÃ£o hÃ¡ ferramentas, navegaÃ§Ã£o ou URLs externas comandadas pelo currÃ­culo.

A resposta tem esquema JSON, temperatura 0,1 e limite de saÃ­da. A extraÃ§Ã£o validada inclui experiÃªncias, formaÃ§Ã£o, certificaÃ§Ãµes, resumo, evidÃªncias, pontos a esclarecer e perguntas de entrevista. As avaliaÃ§Ãµes por vaga reutilizam a regra auditada de aderÃªncia. O RH continua responsÃ¡vel por decisÃµes. Dados protegidos sÃ£o excluÃ­dos dos critÃ©rios e das perguntas no prompt. EvidÃªncias e resultados precisam de conferÃªncia humana.

Tokens, modelo, duraÃ§Ã£o, tentativas e erros sÃ£o registrados pelo mecanismo existente. Mensagens do fornecedor sÃ£o descartadas. RepetiÃ§Ãµes sÃ£o contabilizadas como tentativas e preservam a identidade da anÃ¡lise. O custo efetivo permanece sujeito Ã  conciliaÃ§Ã£o com a fatura, conforme a Ã¡rea de consumo.

O endpoint possui uma verificaÃ§Ã£o interna com conteÃºdo exclusivamente sintÃ©tico e esquema completo. Somente o segredo privado do agendador, validado no banco, libera essa verificaÃ§Ã£o. Ela permite verificar disponibilidade tÃ©cnica sem transmitir currÃ­culos reais. Os testes locais instrumentam o HTTP e os testes isolados do Supabase verificam RLS, documentos e persistÃªncia.

Publique analisar-curriculo, ceny-worker e ceny-queue, incluindo _shared e os mapas de importaÃ§Ã£o. verify_jwt=false mantÃ©m a verificaÃ§Ã£o interna por auth.getUser ou pelo token privado da fila. O frontend sÃ³ chama a infraestrutura Supabase.

Fontes consultadas em 7 de novembro de 2026.

- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/terms
