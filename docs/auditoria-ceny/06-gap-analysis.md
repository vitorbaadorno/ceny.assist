# Distância entre o protótipo e os objetivos da Ceny

Referências E01–E28: [catálogo de evidências](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>). Para escopo e limites, consulte o [resumo executivo](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>).

“Já existe” significa implementação encontrada, não certificação de produção. A execução e os limites estão no inventário e no plano de testes. A visão prioritária continua B2B, multiempresa, apoio ao RH, sem portal de candidatos e sem transformar a Ceny em ATS completo.

## A — Central de currículos

| Objetivo | Situação | Evidência / próximo passo |
|---|---|---|
| Upload individual | Precisa melhorar | E10; limite, validação e compensação |
| Upload em lote | Existe parcialmente | sequência em aba aberta; fila/retomada |
| Leitura PDF/DOCX | Existe parcialmente | PDF/imagem encaminhados à IA; DOCX ausente |
| Extração estruturada | Precisa melhorar | schema remoto, sem validação local/benchmark; E08/E09 |
| Duplicados | Precisa implementar | UUID não deduplica; hash por empresa e revisão de identidade |
| Histórico de versões | Precisa implementar | um arquivo e um JSON sobrescrito |
| Origem do currículo | Existe parcialmente | nome/path/data; sem origem de negócio |
| Correção manual | Existe parcialmente | cidade/nascimento/notas/status; demais campos sem editor |

## B — Gestão de vagas

| Objetivo | Situação | Evidência / próximo passo |
|---|---|---|
| Cadastro | Já existe | E14; persistência real não verificada |
| Importação de descrições | Existe parcialmente | textarea permite colar texto; não há importação/estruturação |
| Extração automática de requisitos | Precisa implementar | descrição não participa do score |
| Requisitos obrigatórios | Precisa melhorar | lista textual com peso 55%, sem semântica eliminatória/revisão |
| Desejáveis | Precisa melhorar | lista textual com peso fixo e duplicação |
| Pesos configuráveis | Precisa implementar | fórmula fixa E06 |
| Modelos de vaga | Precisa implementar | não há entidade/ação |
| Histórico de alterações | Precisa implementar | sem versões, sem edição na UI |
| Editar/encerrar vaga | Precisa implementar | status no schema não basta |

## C — Triagem inteligente

| Objetivo | Situação | Evidência / próximo passo |
|---|---|---|
| Matching semântico | Precisa implementar | includes sobre JSON não é semântico |
| Pontuação explicável | Existe parcialmente | fórmula/listas disponíveis, mas correspondências incorretas |
| Evidências por critério | Precisa implementar | sem trecho/página/origem |
| Resumo individual | Precisa implementar | não há campo/gerador de resumo profissional |
| Análise de lacunas | Existe parcialmente | faltantes textuais sem distinguir ausência de evidência |
| Filtros avançados | Existe parcialmente | texto/status/local/experiência; somente cliente |
| Reprocessamento | Precisa melhorar | sem versão/lock/proteção de revisão |
| Revisão humana | Existe parcialmente | decisão de funil e notas, sem validação da extração |
| Integridade de execução | Precisa implementar | nenhuma execução versionada/atômica |

## D — Comparação e colaboração

| Objetivo | Situação | Evidência / próximo passo |
|---|---|---|
| Lado a lado | Precisa implementar | somente ranking |
| Shortlists | Precisa implementar | sem associação/coleção |
| Favoritos | Precisa implementar | ausente |
| Notas internas | Precisa melhorar | coluna única sem autor/histórico; E12 |
| Exportação de relatórios | Precisa implementar | job_reports sem fluxo; E01/E26 |
| Compartilhar com gestores autorizados | Precisa implementar | sem papéis/permissões específicas |

## E — Banco de talentos

| Objetivo | Situação | Evidência / próximo passo |
|---|---|---|
| Base histórica | Existe parcialmente | candidatos persistidos, sem versões de currículo |
| Busca semântica | Precisa implementar | substring local |
| Candidato em múltiplas vagas | Existe parcialmente | scores N:N, mas sem vínculo/decisão/revisão por vaga |
| Redescoberta | Existe parcialmente | recálculo reavalia base retornada; sem busca ativa/recomendação |
| Recomendações para novas vagas | Precisa implementar | não há serviço/ação específica |

## F — Assistente de IA

| Objetivo | Situação | Dependência |
|---|---|---|
| Pesquisa em linguagem natural | Precisa implementar (P2) | base isolada, busca e evidências |
| Respostas fundamentadas | Precisa implementar (P2) | fontes/versionamento e autorização |
| Comparações sob demanda | Precisa implementar (P2) | critérios comparáveis e dados validados |
| Sugestões de entrevista | Precisa implementar (P2) | lacunas justificadas e revisão de RH |
| Explicação dos rankings | Precisa implementar (P2) | não inventar motivos de scores atuais; reconstruir evidências primeiro |

## G — Integrações

API, webhooks, CSV, armazenamento externo, ATS e LinkedIn: **não recomendado neste momento**, por escopo explícito do usuário. Nenhuma dessas integrações de importação foi localizada. Não foi feita análise de viabilidade comercial/API do LinkedIn. Autenticação Google e autocomplete já existentes são somente dependências inventariadas no documento 11.

## H — Administração

| Objetivo | Situação | Próximo passo |
|---|---|---|
| Multiempresa | Precisa implementar (P0) | organização, membership, RLS, storage e FKs |
| Usuários | Existe parcialmente | Auth/profiles; falta gestão B2B |
| Permissões | Precisa implementar (P0) | autenticação não equivale a papel/tenant |
| Configurações | Precisa implementar | critérios, retenção e limites por empresa |
| Logs/auditoria | Existe parcialmente | erros técnicos; faltam ações/decisões |
| Indicadores de uso | Precisa implementar | consumo/documentos/erros/revisões |
| Controle de processamento | Existe parcialmente | status sem execução durável |
| Preparação para cobrança | Precisa implementar | medição/cotas internas antes de gateway de cobrança |

## Ordem de valor

O MVP comercial precisa de A+B+C+H confiáveis: ingestão segura, revisão, critérios de vaga, ranking fundamentado e empresa isolada. D amplia colaboração e entrega para gestores. E/F dependem de uma base historicamente consistente. G fica fora da fase atual. Não adicionar complexidade de ATS, portal de candidato ou automação externa para compensar lacunas do núcleo.

