export type ReportCriterion = {
  kind: string;
  text: string;
  required: boolean;
  weight: number;
  min_years: number | null;
  state?: string;
  reason?: string | null;
  evidence?: { field: string; text: string; page: number | null; origin: string }[];
};
export type ReportPerson = {
  id: string;
  label: string;
  versions: { data: number; review: number; document: string | null };
  stale_at_generation: boolean;
  qualifications: {
    skills: string[] | null;
    experience_years: number | null;
    education: { course: string | null; institution: string | null; level: string | null }[];
  };
  automatic: { score: number | null; reason: string | null; criteria: ReportCriterion[] };
  rh: {
    status: string | null;
    selected: boolean | null;
    version: number | null;
    active_link: boolean;
    decision: {
      actor: string | null;
      actor_id: string | null;
      date: string;
      reason: string;
    } | null;
    notes: {
      id: string;
      actor: string | null;
      actor_id: string | null;
      date: string;
      body: string;
    }[];
  };
};
export type VacancyReport = {
  schema_version: number;
  id: string;
  created_at: string;
  created_by: string | null;
  actor: string | null;
  include_names: boolean;
  include_notes: boolean;
  job: { id: string; title: string; version: number; criteria: ReportCriterion[] };
  evaluation: { id: string; date: string; formula: string };
  candidates: ReportPerson[];
};
export type ReportAccess = {
  report: VacancyReport;
  outdated_now: boolean;
  access_id: string;
  accessed_at: string;
};
export const reportDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
export const reportStates: Record<string, string> = {
  atendido: "Atendido",
  parcial: "Parcialmente comprovado",
  sem_informacao: "Informação insuficiente",
  nao_atendido: "Não atendido",
};
export const reportDecisions: Record<string, string> = {
  novo: "Não decidido",
  em_analise: "Em análise",
  aprovado: "Aprovado pelo RH",
  rejeitado: "Não aprovado pelo RH",
  contratado: "Contratado",
};
export const reportOrigins: Record<string, string> = {
  trecho_conferido: "Trecho conferido",
  extracao: "Extração por IA",
  correcao_rh: "Correção do RH",
};
export function reportStrengths(p: ReportPerson) {
  return p.automatic.criteria.filter((c) => c.state === "atendido").map((c) => c.text);
}
export function reportGaps(p: ReportPerson) {
  return p.automatic.criteria
    .filter((c) => c.state !== "atendido")
    .map((c) => `${c.text}: ${reportStates[c.state ?? ""] ?? "Sem avaliação"}`);
}
export function reportQualifications(p: ReportPerson) {
  const q = p.qualifications;
  return [
    `Competências: ${q.skills?.length ? q.skills.join(", ") : "Não informadas"}`,
    `Experiência: ${q.experience_years === null ? "Não informada" : `${q.experience_years} anos`}`,
    `Formação: ${q.education.length ? q.education.map((e) => [e.course, e.institution, e.level].filter(Boolean).join(" - ") || "Não informada").join("; ") : "Não informada"}`,
  ].join("\n");
}
export function reportHumanText(p: ReportPerson, notesIncluded: boolean) {
  return [
    `Decisão: ${reportDecisions[p.rh.status ?? ""] ?? "Sem decisão nesta vaga"}`,
    `Lista de selecionados: ${p.rh.selected === null ? "Sem vínculo" : p.rh.selected ? "Sim" : "Não"}. Vínculo ativo: ${p.rh.active_link ? "Sim" : "Não"}. Versão RH: ${p.rh.version ?? "Não disponível"}.`,
    ...(p.rh.decision
      ? [
          `${p.rh.decision.actor || "Autor não disponível"} (${p.rh.decision.actor_id ?? "ID não disponível"}) em ${reportDate(p.rh.decision.date)}: ${p.rh.decision.reason}`,
        ]
      : []),
    notesIncluded
      ? p.rh.notes.length
        ? p.rh.notes
            .map(
              (n) =>
                `Nota de ${n.actor || "Autor não disponível"} (${n.actor_id ?? "ID não disponível"}) em ${reportDate(n.date)}: ${n.body}`,
            )
            .join("\n")
        : "Sem notas específicas desta vaga."
      : "Notas não incluídas nesta versão do relatório.",
  ].join("\n");
}
export type ReportSection = { title: string; paragraphs: string[] };
export function reportSections(access: ReportAccess): ReportSection[] {
  const r = access.report;
  return [
    {
      title: `Relatório da vaga: ${r.job.title}`,
      paragraphs: [
        `Relatório ${r.id} · formato v${r.schema_version}`,
        `Gerado em ${reportDate(r.created_at)} por ${r.actor || "Autor não disponível"} (${r.created_by ?? "ID não disponível"}).`,
        `Avaliação de ${reportDate(r.evaluation.date)} · ${r.evaluation.id} · método ${r.evaluation.formula} · vaga v${r.job.version}.`,
        `Consulta/exportação em ${reportDate(access.accessed_at)} · registro ${access.access_id}. Horários: Brasília.`,
        access.outdated_now
          ? "ATENÇÃO: informações alteradas desde a avaliação ou geração. Este relatório é histórico; gere outro após conferir a base."
          : "Retrato histórico das informações utilizadas. Alterações futuras não modificam esta versão.",
        "Conclusões automáticas usam extração por IA e regras de aderência aos critérios aprovados. Não constituem decisão de contratação. Ausência de evidência não comprova falta de capacidade.",
        "Dados de contato, nascimento, currículo completo e arquivos originais não fazem parte do relatório. Textos livres devem ser conferidos antes de compartilhar.",
      ],
    },
    {
      title: "Critérios da vaga na avaliação",
      paragraphs: r.job.criteria.map(
        (c) =>
          `${c.text} · ${c.required ? "Obrigatório" : "Desejável"} · peso ${c.weight}${c.min_years === null ? "" : ` · mínimo ${c.min_years} anos`}`,
      ),
    },
    ...r.candidates.flatMap((p): ReportSection[] => [
      {
        title: p.label,
        paragraphs: [
          `Versões utilizadas: dados ${p.versions.data}; revisão ${p.versions.review}; documento ${p.versions.document ?? "Não disponível"}.`,
          ...(p.stale_at_generation
            ? ["Avaliação já desatualizada na geração deste relatório."]
            : []),
          reportQualifications(p),
        ],
      },
      {
        title: `${p.label} — Conclusões automáticas (IA e regras)`,
        paragraphs: [
          p.automatic.score === null
            ? `Sem pontuação final: ${p.automatic.reason || "Avaliação indisponível"}`
            : `Aderência: ${p.automatic.score}%.`,
          `Pontos fortes comprovados: ${reportStrengths(p).join("; ") || "Nenhum identificado nesta avaliação"}.`,
          `Lacunas e informações a conferir: ${reportGaps(p).join("; ") || (p.automatic.score === null ? "Sem avaliação final" : "Nenhuma identificada nos critérios avaliados")}.`,
          ...p.automatic.criteria.map((c) =>
            [
              `${c.text} · ${c.required ? "Obrigatório" : "Desejável"} · peso ${c.weight}: ${reportStates[c.state ?? ""] ?? "Sem avaliação"}.`,
              c.reason,
              c.evidence?.length
                ? c.evidence
                    .map(
                      (e) =>
                        `Evidência (${reportOrigins[e.origin] ?? e.origin}; ${e.field}${e.page ? `; página ${e.page}` : ""}): ${e.text}`,
                    )
                    .join("\n")
                : "Sem trecho de evidência disponível.",
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        ],
      },
      {
        title: `${p.label} — Decisões e observações do RH`,
        paragraphs: [reportHumanText(p, r.include_notes)],
      },
    ]),
  ];
}

// Every untrusted cell is quoted AND neutralized before Excel/LibreOffice can parse a formula.
export function csvCell(value: unknown) {
  let s = String(value ?? "").replaceAll("\0", "");
  if (/^[\s\uFEFF]*[=+@-]/u.test(s) || /^[\t\r\n]/u.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
export function reportCsv(access: ReportAccess) {
  const r = access.report;
  const rows: unknown[][] = [
    [
      "Relatório",
      "Gerado em (Brasília)",
      "Gerado por",
      "Autor ID",
      "Avaliação em (Brasília)",
      "Avaliação ID",
      "Método",
      "Vaga",
      "Versão vaga",
      "Histórico/desatualizado",
      "Candidato",
      "Versão dados",
      "Versão revisão",
      "Documento utilizado",
      "Qualificações",
      "Aderência automática (%)",
      "Sem pontuação: motivo",
      "Pontos fortes automáticos",
      "Lacunas automáticas",
      "Critério",
      "Obrigatório",
      "Peso",
      "Estado automático",
      "Justificativa automática",
      "Evidências",
      "Decisões e observações do RH",
      "Registro de exportação",
      "Exportado em (Brasília)",
    ],
  ];
  for (const p of r.candidates)
    for (const c of p.automatic.criteria.length
      ? p.automatic.criteria
      : r.job.criteria.length
        ? r.job.criteria
        : [null])
      rows.push([
        r.id,
        reportDate(r.created_at),
        r.actor,
        r.created_by,
        reportDate(r.evaluation.date),
        r.evaluation.id,
        r.evaluation.formula,
        r.job.title,
        r.job.version,
        access.outdated_now || p.stale_at_generation ? "Sim" : "Não",
        p.label,
        p.versions.data,
        p.versions.review,
        p.versions.document,
        reportQualifications(p),
        p.automatic.score,
        p.automatic.reason,
        reportStrengths(p).join("; "),
        reportGaps(p).join("; "),
        c ? c.text + (c.min_years === null ? "" : ` (mínimo ${c.min_years} anos)`) : "",
        c ? (c.required ? "Sim" : "Não") : "",
        c?.weight,
        c ? (reportStates[c.state ?? ""] ?? "Sem avaliação") : "Sem avaliação",
        c?.reason,
        c?.evidence
          ?.map(
            (e) =>
              `${e.text} (${reportOrigins[e.origin] ?? e.origin}; ${e.field}${e.page ? `; p. ${e.page}` : ""})`,
          )
          .join("\n"),
        reportHumanText(p, r.include_notes),
        access.access_id,
        reportDate(access.accessed_at),
      ]);
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
