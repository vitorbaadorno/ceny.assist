import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validateFile } from "../supabase/functions/_shared/validate-file.ts";
import { validateExtraction } from "../supabase/functions/_shared/extraction-quality.ts";
import { extractionFixture, fixtureSource } from "./extraction-fixture.mjs";
test("ten synthetic benchmark documents pass actual structural validation without AI calls", async () => {
  const root = new URL("./fixtures/quality/", import.meta.url);
  const manifest = JSON.parse(await fs.readFile(new URL("manifest.json", root), "utf8"));
  assert.equal(manifest.cases.length, 10);
  for (const item of manifest.cases) {
    const doc = await validateFile(
      item.file,
      new Uint8Array(await fs.readFile(new URL(item.file, root))),
    );
    assert.equal(doc.pages, 1, item.file);
    if (item.id === "docx-table") {
      assert.match(doc.text, /Empresa Alfa.*\|.*Desenvolvedora.*\|.*01\/2020/);
    }
    if (item.id === "low-resolution") assert.ok(doc.warnings.includes("baixa_resolucao"));
  }
});
test("server-detected low resolution requires review regardless of model confidence", () => {
  const result = validateExtraction(extractionFixture(), {
    ...fixtureSource,
    warnings: ["baixa_resolucao"],
  });
  assert.equal(result.status, "revisao_manual");
});
test("quote that exists but does not contain the reported name is inconsistent", () => {
  const value = extractionFixture();
  value.nome_completo = "Nome Inventado";
  const result = validateExtraction(value, fixtureSource);
  assert.equal(result.status, "revisao_manual");
  assert.equal(result.extraction.evidencias[0].verificacao, "inconsistente");
});
