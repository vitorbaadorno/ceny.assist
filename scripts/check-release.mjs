import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { evaluateRelease } from "./release-policy.mjs";
try {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const file = process.env.CENY_RELEASE_EVIDENCE;
  const result = evaluateRelease(file ? JSON.parse(fs.readFileSync(file, "utf8")) : {}, commit);
  console.log(JSON.stringify(result));
  if (!result.commercial_release) process.exitCode = 1;
} catch {
  console.error("NO-GO: evidência de release ausente ou inválida.");
  process.exitCode = 1;
}
