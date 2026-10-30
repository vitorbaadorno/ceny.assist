import { test, expect, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
mock.module("@tanstack/react-router", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
const { CandidateNotes, CandidateJobDecision, CandidateFavorite } =
  await import("../src/components/candidate-collaboration");
const { CandidateComparison } = await import("../src/components/candidate-comparison");
const link: any = {
  company_id: "company",
  candidate_id: "ana",
  job_id: "job",
  active: true,
  decision_version: 0,
  decision_status: "novo",
  shortlisted: false,
};
function render(component: React.ReactNode, seeds: [unknown[], unknown][] = []) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const [key, data] of seeds) cache.setQueryData(key, data);
  const html = renderToStaticMarkup(
    <QueryClientProvider client={cache}>{component}</QueryClientProvider>,
  );
  cache.clear();
  return html;
}
const note = (id: string, body: string) => ({
  id,
  body,
  actor_name: "RH de teste",
  actor_id: "user",
  created_at: "2026-10-30T12:00:00Z",
});
test("notes render scoped history with author/date and hide editor for manager", () => {
  const html = render(<CandidateNotes companyId="company" candidateId="ana" canEdit={false} />, [
    [
      ["candidate-notes", "company", "ana", null, 0],
      {
        data: [note("1", "Primeira nota preservada"), note("2", "Complemento preservado")],
        count: 2,
      },
    ],
  ]);
  expect(html).toContain("Primeira nota preservada");
  expect(html).toContain("Complemento preservado");
  expect(html).toContain("RH de teste");
  expect(html).toContain("30/10/2026");
  expect(html).not.toContain("textarea");
  expect(html).not.toContain("Acrescentar nota");
});
test("RH notes append action is explicit and never offers replacement", () => {
  const html = render(
    <CandidateNotes companyId="company" candidateId="ana" jobId="job" canEdit />,
    [[["candidate-notes", "company", "ana", "job", 0], { data: [], count: 0 }]],
  );
  expect(html).toContain("Notas específicas desta vaga");
  expect(html).toContain("Acrescentar nota");
  expect(html).toContain("Nenhuma nota registrada neste contexto.");
});
test("manager and closed vacancy show history but no decision form", () => {
  for (const props of [
    { canEdit: false, open: true },
    { canEdit: true, open: false },
  ]) {
    const html = render(<CandidateJobDecision link={link} {...props} />, [
      [["candidate-decisions", "company", "ana", "job", 0], { data: [], count: 0 }],
    ]);
    expect(html).toContain("Histórico de decisões");
    expect(html).not.toContain("Salvar decisão nesta vaga");
    expect(html).not.toContain("textarea");
  }
});
test("RH decision requires justification and exposes selection independent of approval", () => {
  const html = render(<CandidateJobDecision link={link} canEdit open />, [
    [["candidate-decisions", "company", "ana", "job", 0], { data: [], count: 0 }],
  ]);
  expect(html).toContain("Justificativa da alteração (obrigatória)");
  expect(html).toContain("Incluir na lista de selecionados desta vaga");
  expect(html).toContain("não significa aprovação ou contratação");
  expect(html).toMatch(/disabled=""[^>]*>Salvar decisão nesta vaga/);
});
test("personal favorite control communicates current selection", () => {
  expect(render(<CandidateFavorite companyId="company" candidateId="ana" value />)).toContain(
    'aria-pressed="true"',
  );
  expect(
    render(<CandidateFavorite companyId="company" candidateId="ana" value={false} />),
  ).toContain("Adicionar aos meus favoritos");
});
test("comparison renders missing data, pending review and outdated evidence in same criterion row", () => {
  const criterion = { kind: "skill", text: "Excel", weight: 5, required: true, min_years: null };
  const current = {
    id: "ana",
    nome: "Ana",
    localizacao: null,
    skills: [],
    anos_experiencia: null,
    processing_status: "concluido",
    review_status: "completed",
    data_version: 1,
    review_version: 1,
    active_document_id: null,
  };
  const entry = {
    snapshot: current,
    score: 80,
    reason: null,
    details: {
      criterios: [{ ...criterion, estado: "atendido", motivo: "Trecho conferido", evidencias: [] }],
    },
  };
  const data = {
    job: { version: 2 },
    run: {
      stale: true,
      formula: "evidence-v3",
      completed_at: "2026-10-30T12:00:00Z",
      job_snapshot: { version: 1, criteria: [criterion] },
    },
    candidates: [
      { current, entry },
      {
        current: { ...current, id: "bruno", nome: "Bruno", review_status: "pending" },
        entry: null,
      },
    ],
  };
  const html = render(
    <CandidateComparison
      companyId="company"
      jobId="job"
      ids={["ana", "bruno"]}
      onRemove={() => {}}
    />,
    [[["candidate-comparison", "company", "job", ["ana", "bruno"]], data]],
  );
  expect(html).toContain("Análise desatualizada");
  expect(html).toContain("Não informado");
  expect(html).toContain("revisão pendente");
  expect(html).toContain("Sem avaliação deste critério");
  expect(html).toContain("peso 5");
  expect(html).toContain("80% de aderência");
});
