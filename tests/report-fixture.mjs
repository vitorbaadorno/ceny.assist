export function reportFixture() {
  return {
    access_id: "aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa",
    accessed_at: "2026-11-04T15:30:00Z",
    outdated_now: false,
    report: {
      schema_version: 1,
      id: "bbbbbbbb-1111-4444-8888-bbbbbbbbbbbb",
      created_at: "2026-11-04T15:00:00Z",
      created_by: "rh-id",
      actor: "RH de teste",
      include_names: false,
      include_notes: true,
      job: {
        id: "job",
        title: "Analista de operações",
        version: 2,
        criteria: [
          { kind: "skill", text: "Excel", weight: 5, required: true, min_years: null },
          { kind: "skill", text: "Inglês", weight: 2, required: false, min_years: null },
        ],
      },
      evaluation: { id: "evaluation-id", date: "2026-11-04T14:00:00Z", formula: "evidence-v3" },
      candidates: [
        {
          id: "person-id",
          label: "Candidato 1",
          versions: { data: 3, review: 4, document: "document-id" },
          stale_at_generation: false,
          qualifications: {
            skills: ["Excel", "Análise de dados"],
            experience_years: 0,
            education: [
              { course: "Administração", institution: "Universidade de teste", level: "Superior" },
            ],
          },
          automatic: {
            score: 71,
            reason: null,
            criteria: [
              {
                kind: "skill",
                text: "Excel",
                required: true,
                weight: 5,
                min_years: null,
                state: "atendido",
                reason: "Competência descrita em experiência profissional.",
                evidence: [
                  {
                    field: "experiencias.0.descricao",
                    text: "Elaboração de relatórios e tabelas dinâmicas em Excel.",
                    page: 2,
                    origin: "extracao",
                  },
                ],
              },
              {
                kind: "skill",
                text: "Inglês",
                required: false,
                weight: 2,
                min_years: null,
                state: "sem_informacao",
                reason: "O currículo não informa o nível de inglês.",
                evidence: [],
              },
            ],
          },
          rh: {
            status: "em_analise",
            selected: true,
            version: 2,
            active_link: true,
            decision: {
              actor: "Pessoa do RH",
              actor_id: "rh-id",
              date: "2026-11-04T14:30:00Z",
              reason: "Conferir domínio de planilhas na entrevista.",
            },
            notes: [
              {
                id: "note",
                actor: "Pessoa do RH",
                actor_id: "rh-id",
                date: "2026-11-04T14:40:00Z",
                body: "Perguntar sobre a experiência com relatórios mensais.",
              },
            ],
          },
        },
      ],
    },
  };
}
