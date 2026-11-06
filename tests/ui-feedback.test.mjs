import test from "node:test";
import assert from "node:assert/strict";
import {
  errorFeedback,
  retryQuery,
  processingLabel,
  displayDate,
  requireSavedId,
} from "../src/lib/ui-feedback.ts";
import { documentState, uploadSummary } from "../src/lib/resume-progress.ts";
test("session and permission failures are distinct and never automatically retried", () => {
  for (const error of [
    { status: 401 },
    { code: "PGRST301" },
    new Error("Sua sessão expirou ou não é mais válida."),
  ]) {
    assert.equal(errorFeedback(error).kind, "session");
    assert.equal(retryQuery(0, error), false);
  }
  for (const error of [
    { status: 403 },
    { code: "42501" },
    new Error("Você não tem permissão para esta operação."),
  ]) {
    assert.equal(errorFeedback(error).kind, "permission");
    assert.equal(retryQuery(0, error), false);
  }
});
test("connection errors retain retry action across serialized server boundaries", () => {
  for (const error of [
    new TypeError("Failed to fetch"),
    { status: 503 },
    { name: "AuthRetryableFetchError" },
    { message: "Falha de conexão com o serviço." },
  ]) {
    assert.equal(errorFeedback(error).kind, "connection");
    assert.equal(retryQuery(0, error), true);
    assert.equal(retryQuery(1, error), false);
  }
});
test("missing records are terminal and unknown errors do not reveal SQL or personal data", () => {
  assert.equal(errorFeedback({ code: "PGRST116" }).kind, "missing");
  assert.equal(retryQuery(0, { status: 404 }), false);
  const result = errorFeedback(new Error("private_table contact@example.test"));
  assert.equal(result.message, "Não foi possível concluir a operação.");
});
test("only recognized completed states report completed reading", () => {
  for (const state of [undefined, null, "", "new-status", "completed"])
    assert.notEqual(processingLabel(state).label, "Dados extraídos");
  assert.equal(processingLabel("concluido").label, "Dados extraídos");
  assert.equal(documentState("new-status"), "desconhecido");
  const summary = uploadSummary([
    { state: documentState("new-status") },
    { state: documentState("completed") },
  ]);
  assert.equal(summary.completed, 1);
  assert.equal(summary.unknown, 1);
  assert.equal(summary.pending, 0);
});
test("missing timestamps never silently become the current time", () => {
  assert.equal(displayDate(null), "Data não informada");
  assert.equal(displayDate("broken"), "Data inválida — conferir registro");
  assert.match(displayDate("2026-10-30T12:00:00Z"), /30\/10\/2026/);
});
test("missing mutation receipts cannot be treated as saved", () => {
  for (const value of [null, undefined, "", {}, false, 0])
    assert.throws(() => requireSavedId(value), /não confirmou/);
  assert.equal(requireSavedId("saved-id"), "saved-id");
});
