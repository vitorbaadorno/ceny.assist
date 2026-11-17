import fs from "node:fs";
import { evaluateQuality } from "./quality-gate.mjs";
try {
  const manifest = JSON.parse(fs.readFileSync("tests/fixtures/quality/manifest.json", "utf8"));
  const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const result = evaluateQuality(
    report,
    manifest.cases.map((item) => item.id),
  );
  console.log(JSON.stringify(result));
  if (!result.passed) process.exitCode = 1;
} catch {
  console.error("Avaliação de qualidade ausente ou inválida; aceite bloqueado.");
  process.exitCode = 1;
}
