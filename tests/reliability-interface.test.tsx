import { test, expect, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { QueryError } = await import("../src/components/query-feedback");
const { CandidateNotes } = await import("../src/components/candidate-collaboration");
const { JobEditor } = await import("../src/components/job-editor");
const { JobProgress } = await import("../src/components/resume-queue");
const { ProductQuality } = await import("../src/components/product-quality");

test("quality telemetry preserves missing measurements and isolates company caches", () => {
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  cache.setQueryData(["product-quality", "company-a"], {
    upload_failure_rate: null,
    analysis_p50_ms: null,
    analysis_p95_ms: null,
    abandoned_files: 0,
    pending_files: 1,
    analysis_failed: 0,
    analysis_blocked: 2,
    human_reviews_recorded: 3,
    formats: [{ format: "docx", total: 4, rejected: 0 }],
  });
  const render = (companyId: string) =>
    renderToStaticMarkup(
      <QueryClientProvider client={cache}>
        <ProductQuality companyId={companyId} />
      </QueryClientProvider>,
    );
  const own = render("company-a");
  expect(own.match(/Sem medição/g)?.length).toBe(3);
  expect(own).not.toContain("0.0%");
  expect(own).toContain("docx");
  const other = render("company-b");
  expect(other).toContain("Consultando qualidade");
  expect(other).not.toContain("docx");
  cache.clear();
});

test("quality request failure is retryable and never reports successful empty metrics", () => {
  const html = renderFailure(
    ["product-quality", "company"],
    <ProductQuality companyId="company" />,
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("Tentar novamente");
  expect(html).not.toContain("Envios por formato");
});
test("errors expose alert semantics, session action and a bounded retry control", () => {
  const session = renderToStaticMarkup(<QueryError error={{ status: 401 }} retry={() => {}} />);
  expect(session).toContain('role="alert"');
  expect(session).toContain("Entrar novamente");
  expect(session).toContain("/auth?reauth=entrar");
  expect(session).not.toContain("Tentar novamente");
  const denied = renderToStaticMarkup(<QueryError error={{ code: "42501" }} retry={() => {}} />);
  expect(denied).toContain("não tem permissão");
  expect(denied).not.toContain("Tentar novamente");
  const retry = renderToStaticMarkup(
    <QueryError error={new TypeError("Failed to fetch")} retry={() => {}} busy />,
  );
  expect(retry).toContain("disabled");
  expect(retry).toContain("Tentando novamente");
});
function renderFailure(key: unknown[], node: React.ReactNode) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, refetchOnMount: false } },
  });
  const query = cache.getQueryCache().build(cache, { queryKey: key });
  query.setState({ status: "error", fetchStatus: "idle", error: new TypeError("Failed to fetch") });
  const result = renderToStaticMarkup(
    <QueryClientProvider client={cache}>{node}</QueryClientProvider>,
  );
  cache.clear();
  return result;
}
test("failed notes history leaves manual draft and retry available without reporting empty history", () => {
  const html = renderFailure(
    ["candidate-notes", "company", "ana", null, 0],
    <CandidateNotes companyId="company" candidateId="ana" canEdit />,
  );
  expect(html).toContain("textarea");
  expect(html).toContain("Tentar novamente");
  expect(html).not.toMatch(/<textarea[^>]*disabled="/);
  expect(html).not.toContain("Nenhuma nota registrada");
});
test("failed templates never disable manual vacancy fields", () => {
  const html = renderFailure(
    ["job-templates", "company"],
    <JobEditor companyId="company" onSaved={() => {}} onCancel={() => {}} />,
  );
  expect(html).toContain("manualmente");
  expect(html).not.toMatch(/<fieldset[^>]*disabled="/);
  expect(html).toContain("Tentar novamente");
});
test("unknown queue state has no success claim", () => {
  const html = renderToStaticMarkup(
    <JobProgress
      job={
        { state: "new-state", generation: 1, attempts: 0 } as React.ComponentProps<
          typeof JobProgress
        >["job"]
      }
    />,
  );
  expect(html).toContain("Situação da leitura não confirmada");
  expect(html).not.toContain("Concluído");
});

test("Gemini clarification and interview suggestions appear once in the report", async () => {
  const { CandidateAnalysis } = await import("../src/components/candidate-analysis");
  const html = renderToStaticMarkup(
    <CandidateAnalysis
      value={{
        schema_version: "2",
        pontos_esclarecer: ["Confirmar projeto"],
        perguntas_entrevista: ["Como usou SQL?"],
      }}
    />,
  );
  expect(html.split("Esclarecimentos e entrevista").length - 1).toBe(1);
  expect(html).toContain("Como usou SQL?");
});
