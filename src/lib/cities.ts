import catalog from "../data/cities-br.json" with { type: "json" };
const normalized = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
const rows = catalog.cities.map((row) => ({
  placeId: `ibge:${row.id}`,
  label: `${row.city} - ${row.state}`,
  search: normalized(`${row.city} ${row.state}`),
}));
export function searchCities(input: string) {
  const query = normalized(input).replace(/\s*-\s*/g, " ");
  if (query.length < 2 || query.length > 100) return [];
  return rows
    .filter((row) => row.search.includes(query))
    .sort(
      (a, b) =>
        Number(b.search.startsWith(query)) - Number(a.search.startsWith(query)) ||
        a.label.localeCompare(b.label, "pt-BR"),
    )
    .slice(0, 8)
    .map(({ placeId, label }) => ({ placeId, label }));
}
export function cityById(id: string) {
  const row = rows.find((row) => row.placeId === id);
  if (!row) throw new Error("Cidade indisponível. Digite o nome e a UF manualmente.");
  return { city: row.label };
}
