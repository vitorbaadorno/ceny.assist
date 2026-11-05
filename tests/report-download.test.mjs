import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { z } from "zod";
import { reportFixture } from "./report-fixture.mjs";
import { reportCsv } from "../src/lib/vacancy-report.ts";
import { reportPdf } from "../src/lib/vacancy-report-pdf.ts";
const auth = {};
let source = stripTypeScriptTypes(fs.readFileSync("src/lib/vacancy-report.functions.ts", "utf8"))
  .replace(/^import\b[\s\S]*?;\s*/gm, "")
  .replaceAll("export ", "")
  .replaceAll('import("./vacancy-report-pdf")', "loadPdf()")
  .replaceAll('import("./vacancy-report")', "loadCsv()");
let rendered = 0;
const createServerFn = ({ method }) => {
  assert.equal(method, "POST");
  let validator;
  return {
    middleware(list) {
      assert.deepEqual(list, [auth]);
      return this;
    },
    inputValidator(fn) {
      validator = fn;
      return this;
    },
    handler(fn) {
      return ({ data, context }) => fn({ data: validator(data), context });
    },
  };
};
const handler = new Function(
  "createServerFn",
  "z",
  "requireSupabaseAuth",
  "loadPdf",
  "loadCsv",
  source + ";return downloadVacancyReport;",
)(
  createServerFn,
  z,
  auth,
  () => {
    rendered++;
    return { reportPdf };
  },
  () => {
    rendered++;
    return { reportCsv };
  },
);
const data = {
  companyId: "aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa",
  reportId: "bbbbbbbb-1111-4444-8888-bbbbbbbbbbbb",
  format: "pdf",
};
test("download refuses invalid formats and client-supplied payload before access", async () => {
  for (const input of [
    { ...data, format: "html" },
    { ...data, companyId: "bad" },
    { ...data, payload: { secret: true } },
  ]) {
    let called = false;
    assert.throws(() =>
      handler({
        data: input,
        context: {
          supabase: {
            rpc() {
              called = true;
            },
          },
        },
      }),
    );
    assert.equal(called, false);
  }
});
test("download fails closed before rendering when DB revokes access or audit fails", async () => {
  const before = rendered;
  await assert.rejects(
    handler({
      data,
      context: {
        supabase: { rpc: async () => ({ error: { message: "private internal details" } }) },
      },
    }),
    /Download indisponível/,
  );
  assert.equal(rendered, before);
});
test("download returns the server snapshot with explicit scope, format and private headers", async () => {
  for (const format of ["pdf", "csv"]) {
    let call;
    const response = await handler({
      data: { ...data, format },
      context: {
        supabase: {
          rpc: async (name, args) => {
            call = { name, args };
            return { error: null, data: reportFixture() };
          },
        },
      },
    });
    assert.deepEqual(call, {
      name: "access_vacancy_report",
      args: { p_company: data.companyId, p_report: data.reportId, p_action: format },
    });
    assert.match(response.headers.get("Cache-Control"), /no-store/);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(
      response.headers.get("Content-Disposition"),
      `attachment; filename="ceny-relatorio-${data.reportId}.${format}"`,
    );
    const text = new TextDecoder().decode(await response.arrayBuffer());
    if (format === "pdf") assert.ok(text.startsWith("%PDF-"));
    else assert.match(text, /Candidato 1/);
  }
});
