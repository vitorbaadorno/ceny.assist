import test from "node:test";
import assert from "node:assert/strict";
import { measureExtraction } from "./quality-metrics.mjs";
test("quality measurement uses reference facts, penalizes inventions and ignores model confidence", () => {
  const expected = { nome_completo: "Ana", email: null, skills: ["Python", "SQL"] };
  const report = measureExtraction(
    {
      nome_completo: "Ana",
      email: "invented@example.test",
      skills: ["SQL", "Python"],
      confianca: 1,
    },
    expected,
  );
  assert.equal(report.exact_accuracy, 2 / 3);
  assert.equal(report.precision, 2 / 3);
  assert.equal(report.recall, 1);
  assert.ok(!JSON.stringify(report).includes("invented"));
});
