import test from "node:test";
import assert from "node:assert/strict";
import { evaluateQuality } from "../scripts/quality-gate.mjs";
test("quality release gate never converts missing evaluation or hallucinations into approval", () => {
  const sample = {
    id: "synthetic",
    status: "concluido",
    metrics: { precision: 1, recall: 1 },
    review_expected: false,
  };
  assert.equal(evaluateQuality({ mode: "live", cases: [sample] }, ["synthetic"]).passed, true);
  for (const report of [
    { mode: "not_run", cases: [sample] },
    { mode: "live", cases: [] },
    { mode: "live", cases: [sample, sample] },
    { mode: "live", cases: [{ ...sample, metrics: { precision: 0.5, recall: 1 } }] },
    { mode: "live", cases: [{ ...sample, review_expected: true, review_matched: false }] },
    { mode: "live", cases: [{ ...sample, metrics: null }] },
  ])
    assert.equal(evaluateQuality(report, ["synthetic"]).passed, false);
});
