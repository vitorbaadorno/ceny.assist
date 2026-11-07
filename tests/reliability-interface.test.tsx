import { test, expect, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { QueryError } = await import("../src/components/query-feedback");
const { CandidateNotes } = await import("../src/components/candidate-collaboration");
const { JobEditor } = await import("../src/components/job-editor");
const { JobProgress } = await import("../src/components/resume-queue");
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
