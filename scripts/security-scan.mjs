import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { secretFindings } from "./secret-patterns.mjs";
const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
const failures = [];
function inspect(name, text, browser = false) {
  for (const kind of secretFindings(text, { browser })) failures.push({ file: name, kind });
}
try {
  const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  for (const file of tracked) {
    if (/\.env(?:\.|$)/.test(file) && file !== ".env.example")
      failures.push({ file, kind: "tracked_environment" });
    if (fs.existsSync(file)) inspect(file, fs.readFileSync(file, "utf8"));
  }
  if (process.argv.includes("--history")) {
    const objects = git(["rev-list", "--objects", "--all"]).trim().split("\n");
    for (const row of objects) {
      const [hash, ...name] = row.split(" ");
      if (!name.length || git(["cat-file", "-t", hash]).trim() !== "blob") continue;
      inspect(`history:${hash}`, git(["cat-file", "blob", hash]));
    }
  }
  const build = process.argv.includes("--build");
  if (build) {
    const root = ".output/public";
    if (!fs.existsSync(root)) throw new Error("Build ausente.");
    const walk = (directory) => {
      for (const file of fs.readdirSync(directory, { withFileTypes: true })) {
        const name = path.join(directory, file.name);
        if (file.isDirectory()) walk(name);
        else if (/\.(?:js|mjs|json|map|html|css)$/.test(name))
          inspect(name, fs.readFileSync(name, "utf8"), true);
      }
    };
    walk(root);
  }
  console.log(JSON.stringify({ passed: failures.length === 0, findings: failures })); // Never print matching values.
  if (failures.length) process.exitCode = 1;
} catch {
  console.error("Varredura incompleta; publicação bloqueada.");
  process.exitCode = 1;
}
