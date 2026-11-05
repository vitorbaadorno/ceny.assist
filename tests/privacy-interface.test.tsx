import { test, expect, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
let canAdmin = true;
mock.module("@/hooks/useCompany", () => ({
  useCompany: () => ({ companyId: "company", canAdmin }),
}));
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
mock.module("@/lib/privacy.functions", () => ({
  exportPrivacySubject: async () => new Response(),
}));
mock.module("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
const { PrivacyCenter, EraseCandidate } = await import("../src/components/privacy-center");
function render(admin: boolean) {
  canAdmin = admin;
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cache.setQueryData(["privacy-candidates", "company", 0], []);
  cache.setQueryData(["privacy-history", "company", 0], {
    operations: [],
    holds: [],
    requests: [],
    events: [],
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={cache}>
      <PrivacyCenter />
    </QueryClientProvider>,
  );
  cache.clear();
  return html;
}
test("privacy administration denies recruiter and viewer controls", () => {
  const html = render(false);
  expect(html).toContain("Somente responsáveis e administradores");
  expect(html).not.toContain("Registrar pedido");
});
test("retention legal AI and hosted backup decisions remain explicit pending items", () => {
  const html = render(true);
  expect(html).toContain("pendente");
  expect(html).toContain("desativada");
  expect(html).toContain("não representam uma certificação");
  expect(html).toContain("identidade");
  expect(html).toContain("Nenhum envio ao titular");
});
test("erasure starts with a preview action and cannot immediately delete", () => {
  const cache = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={cache}>
      <EraseCandidate companyId="c" candidateId="p" />
    </QueryClientProvider>,
  );
  expect(html).toContain("Eliminar dados…");
  expect(html).not.toContain("Solicitar eliminação definitiva");
  cache.clear();
});
