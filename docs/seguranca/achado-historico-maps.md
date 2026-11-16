# Chave Maps no histórico — pendência de segurança

Em 16/11/2026, a varredura local de todos os objetos Git alcançáveis encontrou o mesmo valor com formato de chave Google em sete blobs antigos de `.env`, sob `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`. Nenhum valor foi impresso, copiado para este documento ou reintroduzido na branch. Não é evidência de exposição de GEMINI_API_KEY ou service role.

Fingerprint SHA-256 abreviado para correlação pelo responsável: `e57948c797a5`. Blob de referência: `0453ed93428049dc8af2c401b6a5bf6f6cde4efb`. A chave era de navegador; esse tipo de integração pode utilizar chave pública restringida, mas as restrições de API/referrer, titularidade, uso e situação de revogação **não foram comprovadas**.

O código atual usa IBGE e não depende dessa chave. A varredura do código atual/bundle passa. O check independente `history-security` permanece bloqueante ao detectar material histórico. Outros testes rodam em job separado, sem `continue-on-error`; aprovação da engenharia não encerra o achado.

Responsável Google/Lovable deve localizar a credencial no projeto correto, verificar restrições, APIs habilitadas e uso, revogar/rotacionar se aplicável, avaliar exposição e registrar evidência restrita. Não testar a chave contra APIs de terceiros nem assumir que continua ativa. Depois de comprovar que é chave pública adequadamente restrita ou revogada, definir tratamento auditável do scanner sem liberar chaves privadas novas. Nenhuma exceção foi criada nesta entrega.

Não reescrever o histórico publicado: o projeto está conectado ao Lovable e o AGENTS.md proíbe force push/rebase/amend de commits publicados. Rotação/restrição é a contenção primária. Uma eventual limpeza de histórico exige coordenação e autorização separadas.
