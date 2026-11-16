import fs from "node:fs/promises";
const source = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";
const response = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error("Catálogo IBGE indisponível; preserve o snapshot anterior.");
const data = await response.json();
if (!Array.isArray(data) || data.length < 5000 || data.length > 10000)
  throw new Error("Catálogo incompleto.");
const cities = data.map((row) => {
  const state =
    row.microrregiao?.mesorregiao?.UF?.sigla ??
    row["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla;
  if (!Number.isSafeInteger(row.id) || typeof row.nome !== "string" || !/^[A-Z]{2}$/.test(state))
    throw new Error("Município inválido.");
  return { id: String(row.id), city: row.nome, state };
});
if (new Set(cities.map((row) => row.id)).size !== cities.length)
  throw new Error("Municípios duplicados.");
await fs.writeFile(
  "src/data/cities-br.json",
  JSON.stringify({ source, retrieved_at: new Date().toISOString(), cities }),
);
console.log(JSON.stringify({ municipalities: cities.length }));
