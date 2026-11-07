import test from "node:test";
import assert from "node:assert/strict";
import { decodeBrowsePage } from "../src/lib/browse-page.ts";
import { analysisView } from "../src/lib/analysis-view.ts";
import { documentInProgress, isActiveJob } from "../src/lib/workflow-states.ts";
import { reportDate } from "../src/lib/vacancy-report.ts";
const envelope = (items) => ({ total: 1, filtered: 1, page: 0, pageSize: 25, items });
test("historic list rows have safe arrays, malformed batches cannot be mistaken for empty pages", () => {
  assert.deepEqual(
    decodeBrowsePage(
      "jobs",
      envelope([{ id: "x", titulo: "Teste", status: "indefinida", requisitos_obrigatorios: null }]),
    ).items[0].requisitos_obrigatorios,
    [],
  );
  for (const v of [
    null,
    {},
    envelope([null]),
    envelope([{ id: "x", titulo: {}, status: "aberta" }]),
  ])
    assert.throws(() => decodeBrowsePage("jobs", v), { code: "INVALID_RESPONSE" });
});
test("partial historic analysis renders available fields and rejects malformed evidence", () => {
  assert.deepEqual(
    analysisView.parse({ schema_version: "2", resumo_profissional: { titulo: null } })
      .resumo_profissional.areas,
    [],
  );
  assert.equal(analysisView.safeParse({ schema_version: "2", evidencias: [null] }).success, false);
  assert.equal(reportDate("invalid"), "Data não informada");
});
test("polling only follows work that can progress", () => {
  assert.equal(isActiveJob({ state: "retry_wait" }), true);
  for (const state of ["succeeded", "blocked", "cancelled", "review", "failed", "unknown"])
    assert.equal(isActiveJob({ state }), false);
  assert.equal(documentInProgress({ state: "reading" }), true);
  assert.equal(documentInProgress({ state: "completed" }), false);
});
