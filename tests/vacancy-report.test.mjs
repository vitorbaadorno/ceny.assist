import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  csvCell,
  reportCsv,
  reportDate,
  reportSections,
  reportStrengths,
  reportGaps,
} from "../src/lib/vacancy-report.ts";
import { reportPdf } from "../src/lib/vacancy-report-pdf.ts";
import { reportFixture } from "./report-fixture.mjs";

test("report distinguishes automatic evidence from RH, with stable dates and versions", () => {
  const a = reportFixture(),
    text = reportSections(a)
      .map((s) => [s.title, ...s.paragraphs].join("\n"))
      .join("\n");
  for (const fragment of [
    "Conclusões automáticas",
    "Decisões e observações do RH",
    "dados 3; revisão 4",
    "vaga v2",
    "página 2",
    "Extração por IA",
    "Pessoa do RH",
    "experiência com relatórios",
    "Experiência: 0 anos",
  ])
    assert.ok(text.includes(fragment), fragment);
  assert.equal(reportDate("2026-11-04T15:00:00Z"), "04/11/2026, 12:00:00");
  assert.deepEqual(reportStrengths(a.report.candidates[0]), ["Excel"]);
  assert.match(reportGaps(a.report.candidates[0])[0], /Informação insuficiente/);
});
test("missing score is never rendered as zero or missing evidence as incapacity", () => {
  const a = reportFixture(),
    p = a.report.candidates[0];
  p.automatic = { score: null, reason: "Revisão pendente", criteria: [] };
  p.qualifications = { skills: [], experience_years: null, education: [] };
  const text = JSON.stringify(reportSections(a));
  assert.match(text, /Sem pontuação final: Revisão pendente/);
  assert.doesNotMatch(text, /Aderência: 0/);
  assert.match(text, /Não informada/);
});
test("historical and current staleness stay visible without rewriting source", () => {
  const a = reportFixture();
  a.outdated_now = true;
  a.report.candidates[0].stale_at_generation = true;
  const before = structuredClone(a);
  const text = JSON.stringify(reportSections(a));
  assert.match(text, /ATENÇÃO/);
  assert.match(text, /já desatualizada/);
  assert.deepEqual(a, before);
});
test("renderers ignore unauthorized extra fields", () => {
  const a = reportFixture();
  a.report.email = "private@example.invalid";
  a.report.candidates[0].telefone = "11999999999";
  a.report.candidates[0].raw_resume = "SECRET RESUME";
  const text = reportCsv(a) + JSON.stringify(reportSections(a));
  for (const fragment of ["private@example.invalid", "11999999999", "SECRET RESUME"])
    assert.ok(!text.includes(fragment));
});
test("CSV neutralizes formulas including whitespace and control prefixes", () => {
  for (const s of [
    "=1+1",
    "+SUM(A1:A2)",
    "-1+2",
    "@SUM(1)",
    '  =HYPERLINK("x")',
    "\t=1",
    "\r=1",
    "\n=1",
    "\uFEFF=1",
  ])
    assert.ok(csvCell(s).startsWith("\"'"), JSON.stringify(s));
  assert.equal(csvCell('Texto "citado"; linha\n2'), '"Texto ""citado""; linha\n2"');
});
function parseCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ";" && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\r" && text[i + 1] === "\n" && !quoted) {
      row.push(cell);
      rows.push(row);
      cell = "";
      row = [];
      i++;
    } else cell += c;
  }
  return rows;
}
test("CSV round trip keeps accents, multiline evidence, versions and separate RH columns", () => {
  const a = reportFixture();
  a.report.candidates[0].automatic.criteria[0].evidence[0].text =
    'Texto "com aspas"; evidência\nsegunda linha';
  const csv = reportCsv(a),
    rows = parseCsv(csv);
  assert.equal(csv[0], "\uFEFF");
  assert.equal(rows.length, 3);
  for (const row of rows) assert.equal(row.length, rows[0].length);
  assert.equal(
    rows[1][24],
    'Texto "com aspas"; evidência\nsegunda linha (Extração por IA; experiencias.0.descricao; p. 2)',
  );
  assert.match(rows[1][25], /Pessoa do RH/);
  assert.equal(rows[1][11], "3");
});
test("PDF export produces a valid multi-page document for long unbroken Unicode content", async () => {
  const a = reportFixture();
  a.report.candidates[0].rh.notes[0].body =
    "Qualificação e observação válida. ".repeat(200) +
    " X".repeat(300) +
    "漢字🙂" +
    "a".repeat(1200);
  const data = await reportPdf(a);
  const pdf = await PDFDocument.load(data);
  assert.ok(pdf.getPageCount() >= 3);
  assert.equal(pdf.getTitle(), "Ceny - Relatório de vaga");
  for (const p of pdf.getPages()) assert.ok(Math.abs(p.getWidth() - 595.28) < 0.1);
});
