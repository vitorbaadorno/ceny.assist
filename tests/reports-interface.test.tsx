import { test, expect, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { reportFixture } from "./report-fixture.mjs";
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
mock.module("@/lib/vacancy-report.functions", () => ({
  downloadVacancyReport: async () => new Response(),
}));
mock.module("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
const { VacancyReports, ReportPreview } = await import("../src/components/vacancy-reports");
function render(canEdit: boolean, seeds: [unknown[], unknown][] = []) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const [key, value] of seeds) cache.setQueryData(key, value);
  const html = renderToStaticMarkup(
    <QueryClientProvider client={cache}>
      <VacancyReports companyId="company" jobId="job" canEdit={canEdit} />
    </QueryClientProvider>,
  );
  cache.clear();
  return html;
}
test("viewer sees consultation but no generation or download controls", () => {
  const html = render(false, [
    [
      ["vacancy-reports", "company", "job", 0],
      [
        {
          id: "r",
          created_at: "2026-11-04T15:00:00Z",
          actor_name: "RH",
          candidate_ids: ["c"],
          include_names: false,
          include_notes: false,
        },
      ],
    ],
  ]);
  expect(html).toContain("Consultar relatório");
  expect(html).toContain("Seu perfil permite consultar");
  expect(html).not.toContain("Gerar novo relatório");
  expect(html).not.toContain("Baixar PDF");
  expect(html).not.toContain("Exportar planilha");
});
test("RH sees explicit candidate selection and privacy options, no default selected candidates", () => {
  const html = render(true, [
    [
      ["report-runs", "company", "job", 0],
      [{ id: "run", completed_at: "2026-11-04T14:00:00Z", stale: false }],
    ],
  ]);
  expect(html).toContain("Incluídos no relatório: 0/100");
  expect(html).toContain("Incluir nomes dos candidatos");
  expect(html).toContain("Incluir observações do RH específicas");
  expect(html).toMatch(/disabled=""[^>]*>Gerar relatório dos candidatos escolhidos/);
  expect(html).not.toContain('checked=""');
});
test("preview preserves distinct automatic and RH sections and escapes untrusted markup", () => {
  const access = reportFixture();
  access.report.candidates[0].rh.notes[0].body = '<script>alert("x")</script>';
  const html = renderToStaticMarkup(<ReportPreview access={access} />);
  expect(html).toContain("Conclusões automáticas");
  expect(html).toContain("Decisões e observações do RH");
  expect(html).toContain("dados 3; revisão 4");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
});
