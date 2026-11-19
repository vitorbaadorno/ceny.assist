# Análise com Google Gemini

## Estado vigente em 16/11/2026

O responsável informou uso do **plano gratuito**, preservado nesta entrega. Manter `GEMINI_API_KEY` exclusivamente nos Secrets Supabase e `CENY_GEMINI_DATA_TIER=free`; não configurar `paid` para liberar análises. Currículos reais continuam bloqueados, com revisão manual disponível. O probe privado transmite apenas texto sintético fixo. Os [termos Google](https://aistudio.google.com/docs/terms#data-use-unpaid) orientam não enviar dados pessoais, sensíveis ou confidenciais ao serviço gratuito. Não houve contratação de serviços pagos.

As instruções abaixo sobre plano pago descrevem uma condição futura que exige autorização financeira e aprovação jurídica reais; não são autorização para alterar a conta. Consulte [governança de lançamento](governanca-lancamento.md) e o relatório de implementação. Testes locais/CI não certificam configurações hospedadas nem qualidade do modelo ao vivo.

O upload validado permanece no bucket privado resumes. analisar-curriculo autentica pelo Supabase e usa os mesmos comandos de fila e cotas da plataforma. O banco limita a 10 chamadas por minuto por usuário e empresa, usando atualização atômica da janela. O agendador ceny-queue processa o original em segundo plano com reserva, recuperação e limite de tentativas. Novas chamadas com action=analyze recebem companyId, candidateId, jobId e requestId. Elas exigem vínculo ativo com a vaga aprovada e reservam a análise pelo documento ativo. A avaliação por vaga continua usando os snapshots, versões, critérios aprovados e evidências da plataforma.

A configuração do modelo está em _shared/gemini-config.ts. O identificador inicial é gemini-2.5-flash. GEMINI_MODEL permite uma troca pelo backend. Confirme disponibilidade e condições antes de trocar. A API pode redirecionar identificadores depreciados. model_requested e model_reported registram essa diferença.

A credencial é lida somente no runtime Edge. Configure também CENY_GEMINI_DATA_TIER=paid e CENY_GEMINI_PRIVACY_REVIEW_REFERENCE com a referência real da validação contratual e de privacidade do projeto Google associado. Esses controles devem ser preenchidos após confirmar billing e condições do fornecedor. A existência da credencial não comprova essas condições. A validação anterior do fornecedor Lovable não libera o Gemini. Enquanto pendente, a fila registra bloqueio de configuração e permite revisão humana.

DOCX usa o extrator local já limitado, com minimização de identificação. PDF e imagens passam pela validação de tamanho, estrutura e páginas e usam entrada binária inline somente após a validação do serviço pago. A transmissão integral desses formatos pode conter identificação pessoal. A referência de aprovação deve abranger esse uso. Os originais permanecem na infraestrutura privada da Ceny. A integração não usa a Files API do Google. Não há ferramentas, navegação ou URLs externas comandadas pelo currículo.

A resposta tem esquema JSON, temperatura 0,1 e limite de saída. A extração validada inclui experiências, formação, certificações, resumo, evidências, pontos a esclarecer e perguntas de entrevista. As avaliações por vaga reutilizam a regra auditada de aderência. O RH continua responsável por decisões. Dados protegidos são excluídos dos critérios e das perguntas no prompt. Evidências e resultados precisam de conferência humana.

Tokens, modelo, duração, tentativas e erros são registrados pelo mecanismo existente. Mensagens do fornecedor são descartadas. Repetições são contabilizadas como tentativas e preservam a identidade da análise. O custo efetivo permanece sujeito à conciliação com a fatura, conforme a área de consumo.

O endpoint possui uma verificação interna com conteúdo exclusivamente sintético e esquema de teste. Somente o segredo privado do agendador, validado no banco, libera essa verificação. Ela permite verificar disponibilidade técnica sem transmitir currículos reais. Os testes locais instrumentam o HTTP e os testes isolados do Supabase verificam RLS, documentos e persistência.

Publique analisar-curriculo, ceny-worker e ceny-queue, incluindo _shared e os mapas de importação. verify_jwt=false mantém a verificação interna por auth.getUser ou pelo token privado da fila. O frontend só chama a infraestrutura Supabase.

Fontes consultadas em 7 de novembro de 2026.

- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/terms
