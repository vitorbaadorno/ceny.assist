import fs from "node:fs";
import path from "node:path";
const packages = new Map(),
  visited = new Set();
function scan(root) {
  if (!fs.existsSync(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const folder = path.join(root, entry.name);
    if (entry.name.startsWith("@")) {
      scan(folder);
      continue;
    }
    const manifest = path.join(folder, "package.json");
    if (!fs.existsSync(manifest)) continue;
    const real = fs.realpathSync(manifest);
    if (visited.has(real)) continue;
    visited.add(real);
    const p = JSON.parse(fs.readFileSync(manifest, "utf8"));
    const license =
      typeof p.license === "string" ? p.license : (p.license?.type ?? "PENDENTE_VALIDACAO");
    packages.set(`${p.name}@${p.version}`, { name: p.name, version: p.version, license });
    scan(path.join(folder, "node_modules"));
  }
}
scan("node_modules");
if (!packages.size) throw new Error("Dependências instaladas ausentes; inventário não executado.");
const output = [...packages.values()].sort(
  (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
);
fs.mkdirSync("docs/auditoria", { recursive: true });
fs.writeFileSync(
  "docs/auditoria/licencas-instaladas.json",
  JSON.stringify(
    {
      scope:
        "Installed packages; validate notices, transitive/platform dependencies and locked CI separately",
      packages: output,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    packages: output.length,
    missing: output.filter((p) => p.license === "PENDENTE_VALIDACAO").length,
  }),
);
