import { Input } from "./ui/input";
import { Button } from "./ui/button";
import type { BrowseFilters, BrowsePage } from "@/lib/company-browse";

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: [string, string][];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block">{label}</span>
      <select
        disabled={disabled}
        className="w-full rounded-md border bg-background p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
export function CompanySearch({
  kind,
  filters,
  onChange,
}: {
  kind: "candidates" | "jobs" | "ranking";
  filters: BrowseFilters;
  onChange: (filters: BrowseFilters) => void;
}) {
  const set = (key: keyof BrowseFilters, value: string) => onChange({ ...filters, [key]: value });
  const field = (key: keyof BrowseFilters, label: string, numeric = false) => (
    <label className="space-y-1 text-sm">
      <span className="block">{label}</span>
      <Input
        aria-label={label}
        type={numeric ? "number" : "text"}
        min={numeric ? 0 : undefined}
        max={numeric ? 100 : undefined}
        step={numeric ? "0.1" : undefined}
        maxLength={200}
        value={filters[key] ?? ""}
        onChange={(e) =>
          set(
            key,
            numeric && e.target.value
              ? String(Math.round(Math.min(100, Math.max(0, Number(e.target.value))) * 100) / 100)
              : e.target.value,
          )
        }
      />
    </label>
  );
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {field("q", kind === "jobs" ? "Buscar vagas" : "Buscar pessoas")}
        {field("location", "Localização")}
        {kind !== "jobs" && field("minExperience", "Experiência mínima (anos)", true)}
        {kind === "candidates" && (
          <>
            {field("skill", "Competências (todas as informadas)")}
            <FilterSelect
              label="Etapa do funil"
              value={filters.status ?? "todos"}
              onChange={(v) => set("status", v)}
              options={[
                ["todos", "Todas"],
                ["novo", "Novo"],
                ["em_analise", "Em análise"],
                ["aprovado", "Aprovado"],
                ["rejeitado", "Rejeitado"],
                ["contratado", "Contratado"],
              ]}
            />
            <FilterSelect
              label="Leitura"
              value={filters.processing ?? "todos"}
              onChange={(v) => set("processing", v)}
              options={[
                ["todos", "Todas"],
                ["processando", "Em processamento"],
                ["concluido", "Concluída"],
                ["revisao_manual", "Revisão manual"],
                ["erro", "Erro na leitura"],
              ]}
            />
            <FilterSelect
              label="Revisão humana"
              value={filters.review ?? "todos"}
              onChange={(v) => set("review", v)}
              options={[
                ["todos", "Todas"],
                ["pending", "Pendente"],
                ["draft", "Em revisão"],
                ["completed", "Concluída"],
              ]}
            />
          </>
        )}
        {kind === "jobs" && (
          <>
            <FilterSelect
              label="Categoria"
              value={filters.category ?? "todas"}
              onChange={(v) => set("category", v)}
              options={[
                ["todas", "Todas"],
                ["regular", "Regulares"],
                ["jovem_aprendiz", "Jovem Aprendiz"],
              ]}
            />
            <FilterSelect
              label="Situação"
              value={filters.status ?? "todas"}
              onChange={(v) => set("status", v)}
              options={[
                ["todas", "Todas"],
                ["aberta", "Abertas"],
                ["encerrada", "Encerradas"],
              ]}
            />
          </>
        )}
        {kind === "ranking" && (
          <>
            {field("minScore", "Aderência mínima (%)", true)}
            <FilterSelect
              label="Resultado"
              value={filters.outcome ?? "final"}
              onChange={(v) => set("outcome", v)}
              options={[
                ["final", "Com avaliação final"],
                ["pending", "Sem avaliação final"],
                ["all", "Todos"],
              ]}
            />
            <FilterSelect
              label="Requisitos obrigatórios"
              value={filters.required ?? "all"}
              onChange={(v) => set("required", v)}
              options={[
                ["all", "Todos"],
                ["met", "Todos atendidos"],
              ]}
            />
            {field("criterion", "Requisito da vaga")}
            <FilterSelect
              label="Situação do requisito pesquisado"
              disabled={!filters.criterion?.trim()}
              value={filters.criterionState ?? "all"}
              onChange={(v) => set("criterionState", v)}
              options={[
                ["all", "Todas"],
                ["atendido", "Atendido"],
                ["parcial", "Parcialmente comprovado"],
                ["sem_informacao", "Informação insuficiente"],
                ["nao_atendido", "Não atendido"],
              ]}
            />
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Busca por palavras, sem diferenciar maiúsculas ou acentos, com equivalências conhecidas como
        JS/JavaScript e RH/Recursos Humanos. Todos os termos são considerados. A busca não substitui
        a avaliação dos requisitos.
      </p>
      {kind !== "jobs" && (
        <p className="text-xs text-muted-foreground">
          Ao filtrar por local ou experiência, informações não informadas ficam fora dos resultados.
        </p>
      )}
      <Button variant="outline" onClick={() => onChange({ q: filters.q ?? "" })}>
        Limpar filtros e manter busca
      </Button>
    </div>
  );
}
export function BrowseSummary({
  data,
  setPage,
  fetching = false,
  scope = "na base",
}: {
  data: BrowsePage<unknown>;
  setPage: (page: number) => void;
  fetching?: boolean;
  scope?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-live="polite">
      <span>
        {data.total} {scope} · {data.filtered} encontrados · {data.items.length} nesta página
        {fetching ? " · Atualizando…" : ""}
      </span>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={!data.page || fetching}
          onClick={() => setPage(data.page - 1)}
        >
          Anterior
        </Button>
        <span>
          Página {data.page + 1} de {Math.max(1, Math.ceil(data.filtered / data.pageSize))}
        </span>
        <Button
          variant="outline"
          disabled={(data.page + 1) * data.pageSize >= data.filtered || fetching}
          onClick={() => setPage(data.page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
