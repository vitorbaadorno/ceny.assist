import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const paths = execFileSync(
  "git",
  ["ls-files", "supabase", "package.json", "bun.lock", "vite.config.ts"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n");
const manifest = {
  version: 1,
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  generated_at: new Date().toISOString(),
  files: paths.map((file) => ({
    file,
    sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
  })),
};
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/release-manifest.json", JSON.stringify(manifest, null, 2));
console.log("Manifesto técnico criado sem valores de variáveis ou credenciais.");
