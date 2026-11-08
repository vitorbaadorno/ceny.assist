import { vacancyStates } from "@/lib/workflow-states";
import { QueryError } from "@/components/query-feedback";
import { useCompany } from "@/hooks/useCompany";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useBrowse, type JobListItem, type BrowseFilters } from "@/lib/company-browse";
import { CompanySearch, BrowseSummary } from "@/components/company-search";
import { useState } from "react";
import { JobEditor } from "@/components/job-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vagas/")({
  head: () => ({
    meta: [
      { title: "Vagas | Ceny" },
      { name: "description", content: "Gerencie vagas, critérios e avaliações da sua empresa." },
    ],
  }),
  component: JobsPage,
});
function JobsPage() {
  const { companyId, canEdit } = useCompany();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [page, setPage] = useState(0);
  const query = useBrowse<JobListItem>("jobs", companyId, filters, page);
  const { data, isLoading, isError } = query;
  const visible = data?.items ?? [];
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vagas</h1>
          <p className="text-sm text-muted-foreground">
            Defina as exigências, aprove os critérios e acompanhe os candidatos.
          </p>
        </div>
        <Button disabled={!canEdit} onClick={() => setOpen(!open)}>
          <Plus className="size-4" /> Nova vaga
        </Button>
      </header>
      {open && canEdit && (
        <JobEditor
          key={companyId}
          companyId={companyId}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
      <CompanySearch
        kind="jobs"
        filters={filters}
        onChange={(f) => {
          setFilters(f);
          setPage(0);
        }}
      />
      {data && !isError && (
        <BrowseSummary data={data} setPage={setPage} fetching={query.isFetching} />
      )}
      {isError ? (
        <QueryError
          error={query.error}
          retry={() => query.refetch()}
          busy={query.isFetching}
          fallback="Não foi possível carregar as vagas."
        />
      ) : isLoading ? (
        <p role="status">Carregando vagas…</p>
      ) : !visible.length ? (
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {data?.total === 0
            ? "A empresa ainda não tem vagas cadastradas."
            : filters.category === "jovem_aprendiz"
              ? "Nenhuma vaga de Jovem Aprendiz corresponde à busca e aos filtros."
              : filters.category === "regular"
                ? "Nenhuma vaga regular corresponde à busca e aos filtros."
                : "Nenhuma vaga corresponde à busca e aos filtros."}
        </p>
      ) : (
        <div className="grid gap-3">
          {visible.map((job) => (
            <Link
              key={job.id}
              to="/vagas/$id"
              params={{ id: job.id }}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{job.titulo}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {vacancyStates[job.status] ?? "Situação a conferir"}
                  </Badge>
                  <Badge variant={job.approved_hash ? "secondary" : "outline"}>
                    {job.approved_hash ? "Critérios aprovados" : "Critérios a conferir"}
                  </Badge>
                  <Badge variant="outline">
                    {job.categoria === "jovem_aprendiz" ? "Jovem Aprendiz" : "Vaga regular"}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {job.descricao || "Sem descrição"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.requisitos_obrigatorios.slice(0, 8).map((text) => (
                  <Badge key={text} variant="secondary">
                    {text}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
