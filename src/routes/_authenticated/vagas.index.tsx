import { useCompany } from "@/hooks/useCompany";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [category, setCategory] = useState("todas");
  const [status, setStatus] = useState("todas");
  const {
    data: jobs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["jobs", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const visible = jobs.filter(
    (j) =>
      (category === "todas" || j.categoria === category) &&
      (status === "todas" || j.status === status),
  );
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
      <div className="flex flex-wrap gap-4 text-sm">
        <label>
          Categoria{" "}
          <select
            className="ml-2 rounded-md border bg-background p-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="todas">Todas</option>
            <option value="regular">Regulares</option>
            <option value="jovem_aprendiz">Jovem Aprendiz</option>
          </select>
        </label>
        <label>
          Situação{" "}
          <select
            className="ml-2 rounded-md border bg-background p-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="todas">Todas</option>
            <option value="aberta">Abertas</option>
            <option value="encerrada">Encerradas</option>
          </select>
        </label>
      </div>
      {isLoading ? (
        <p>Carregando vagas…</p>
      ) : isError ? (
        <p role="alert">Não foi possível carregar as vagas.</p>
      ) : !visible.length ? (
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Nenhuma vaga nesta seleção.
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
                    {job.status === "aberta" ? "Aberta" : "Encerrada"}
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
