import { CandidateJobWorkspace, CandidateFavorite } from "./candidate-collaboration";
import { CandidateComparison } from "./candidate-comparison";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { useBrowse, type BrowseFilters, type CandidateListItem } from "@/lib/company-browse";
import { CompanySearch, BrowseSummary } from "./company-search";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function CandidateJobButton({
  companyId,
  candidateId,
  jobId,
  remove = false,
  disabled = false,
}: {
  companyId: string;
  candidateId: string;
  jobId: string;
  remove?: boolean;
  disabled?: boolean;
}) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const r = await supabase.rpc("set_candidate_job_link", {
        p_company: companyId,
        p_candidate: candidateId,
        p_job: jobId,
        p_active: !remove,
      });
      if (r.error) throw r.error;
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["candidate-job-links", companyId] });
      toast.success(
        remove
          ? "Vínculo retirado. O candidato continua no acervo."
          : "Candidato associado à vaga.",
      );
    },
    onError: () =>
      toast.error(
        "Não foi possível alterar o vínculo. Confira se a vaga está aberta e se você tem permissão.",
      ),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {remove ? "Retirar desta vaga" : "Associar à vaga"}
    </Button>
  );
}

export function CandidateJobLinks({
  companyId,
  candidateId,
  canEdit,
}: {
  companyId: string;
  candidateId: string;
  canEdit: boolean;
}) {
  const [page, setPage] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [jobPage, setJobPage] = useState(0);
  const links = useQuery({
    queryKey: ["candidate-job-links", companyId, "person", candidateId, page, showInactive],
    queryFn: async () => {
      let q = supabase
        .from("candidate_job_links")
        .select("*,jobs(titulo,status)", { count: "exact" })
        .eq("company_id", companyId)
        .eq("candidate_id", candidateId);
      if (!showInactive) q = q.eq("active", true);
      const r = await q.order("job_id").range(page * 20, page * 20 + 20);
      if (r.error) throw r.error;
      return r;
    },
  });
  const jobs = useQuery({
    queryKey: ["linkable-jobs", companyId, jobPage],
    enabled: canEdit,
    queryFn: async () => {
      const r = await supabase
        .from("jobs")
        .select("id,titulo", { count: "exact" })
        .eq("company_id", companyId)
        .eq("status", "aberta")
        .order("id")
        .range(jobPage * 20, jobPage * 20 + 20);
      if (r.error) throw r.error;
      return r;
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vagas associadas ({links.data?.count ?? "…"})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Uma pessoa pode participar de várias vagas. A associação é registrada pela equipe e não
          significa aprovação ou contratação.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => {
              setShowInactive(e.target.checked);
              setPage(0);
            }}
          />
          Incluir vínculos retirados para consultar o histórico
        </label>
        {links.isError && <p role="alert">Não foi possível carregar os vínculos.</p>}
        {links.data?.count === 0 && <p className="text-sm">Nenhuma vaga associada.</p>}
        {links.data?.data.slice(0, 20).map((l) => (
          <div
            key={l.job_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
          >
            <Link className="underline" to="/vagas/$id" params={{ id: l.job_id }}>
              {l.jobs?.titulo} · {l.jobs?.status}
            </Link>
            <CandidateJobWorkspace link={l} canEdit={canEdit} open={l.jobs?.status === "aberta"} />
            {canEdit && l.active && (
              <CandidateJobButton
                companyId={companyId}
                candidateId={candidateId}
                jobId={l.job_id}
                remove
              />
            )}
          </div>
        ))}
        <Pages page={page} setPage={setPage} more={(links.data?.count ?? 0) > (page + 1) * 20} />
        {canEdit && (
          <details>
            <summary className="cursor-pointer">Associar a outra vaga aberta</summary>
            <div className="space-y-3 pt-3">
              {jobs.data && (
                <p className="text-sm">
                  {jobs.data.count} vagas abertas · {jobs.data.data.slice(0, 20).length} nesta
                  página
                </p>
              )}
              {jobs.isError && <p role="alert">Não foi possível carregar as vagas.</p>}
              {jobs.data?.data.slice(0, 20).map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-3">
                  <span>{j.titulo}</span>
                  <CandidateJobButton
                    companyId={companyId}
                    candidateId={candidateId}
                    jobId={j.id}
                  />
                </div>
              ))}
              <Pages
                page={jobPage}
                setPage={setJobPage}
                more={(jobs.data?.count ?? 0) > (jobPage + 1) * 20}
              />
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export function JobTalentPool({
  companyId,
  jobId,
  canEdit,
  open,
}: {
  companyId: string;
  jobId: string;
  canEdit: boolean;
  open: boolean;
}) {
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState("all");
  const [ids, setIds] = useState<string[]>([]);
  const toggleCompare = (id: string) =>
    setIds((current) =>
      current.includes(id)
        ? current.filter((v) => v !== id)
        : current.length < 4
          ? [...current, id]
          : current,
    );
  const compareChoice = (id: string, name: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        aria-label={`Comparar ${name}`}
        checked={ids.includes(id)}
        disabled={!ids.includes(id) && ids.length >= 4}
        onChange={() => toggleCompare(id)}
      />
      Comparar
    </label>
  );

  const [filters, setFilters] = useState<BrowseFilters>({});
  const [poolPage, setPoolPage] = useState(0);
  const links = useQuery({
    queryKey: ["candidate-job-links", companyId, "job", jobId, page, selection],
    queryFn: async () => {
      let q = supabase
        .from("candidate_job_links")
        .select("*,candidates(nome,email)", { count: "exact" })
        .eq("company_id", companyId)
        .eq("job_id", jobId);
      if (selection !== "inactive") q = q.eq("active", true);
      else q = q.eq("active", false);
      if (selection === "selected") q = q.eq("shortlisted", true);
      else if (!["all", "inactive"].includes(selection)) q = q.eq("decision_status", selection);
      const r = await q.order("candidate_id").range(page * 20, page * 20 + 20);
      if (r.error) throw r.error;
      return r;
    },
  });
  const pool = useBrowse<CandidateListItem>(
    "candidates",
    companyId,
    filters,
    poolPage,
    undefined,
    "talent-pool",
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidatos associados à vaga ({links.data?.count ?? "…"})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Aqui aparecem os vínculos escolhidos pelo RH. O ranking consulta todo o acervo autorizado
          para sugerir pessoas, mesmo que ainda não estejam vinculadas.
        </p>
        <CandidateComparison
          companyId={companyId}
          jobId={jobId}
          ids={ids}
          onRemove={(id) => setIds((current) => current.filter((v) => v !== id))}
        />
        <label className="block text-sm">
          Lista desta vaga{" "}
          <select
            className="ml-2 rounded border bg-background p-2"
            value={selection}
            onChange={(e) => {
              setSelection(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todos os associados</option>
            <option value="selected">Selecionados</option>
            <option value="aprovado">Aprovados</option>
            <option value="rejeitado">Não aprovados</option>
            <option value="em_analise">Em análise</option>
            <option value="novo">Não decididos</option>
            <option value="contratado">Contratados</option>
            <option value="inactive">Vínculos retirados (histórico)</option>
          </select>
        </label>
        {links.isError && <p role="alert">Não foi possível carregar as associações.</p>}
        {links.data?.count === 0 && <p>Nenhum candidato nesta lista da vaga.</p>}
        {links.data?.data.slice(0, 20).map((l) => (
          <div
            key={l.candidate_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
          >
            <Link className="underline" to="/candidatos/$id" params={{ id: l.candidate_id }}>
              {l.candidates?.nome ?? "Cadastro sem nome"} ·{" "}
              {l.candidates?.email ?? "E-mail não informado"}
            </Link>
            {compareChoice(l.candidate_id, l.candidates?.nome ?? "candidato")}
            <CandidateJobWorkspace link={l} canEdit={canEdit} open={open} />
            {canEdit && l.active && (
              <CandidateJobButton
                companyId={companyId}
                candidateId={l.candidate_id}
                jobId={jobId}
                remove
              />
            )}
          </div>
        ))}
        <Pages page={page} setPage={setPage} more={(links.data?.count ?? 0) > (page + 1) * 20} />
        <details>
          <summary className="cursor-pointer">Buscar pessoas já cadastradas no acervo</summary>
          <div className="space-y-3 pt-3">
            <CompanySearch
              kind="candidates"
              filters={filters}
              onChange={(f) => {
                setFilters(f);
                setPoolPage(0);
              }}
            />
            {pool.isLoading && <p>Pesquisando o acervo…</p>}
            {pool.data && !pool.isError && (
              <BrowseSummary data={pool.data} setPage={setPoolPage} fetching={pool.isFetching} />
            )}
            {pool.isError && <p role="alert">Não foi possível pesquisar o acervo.</p>}
            {!pool.isError && pool.data?.filtered === 0 && (
              <p>
                {pool.data.total === 0
                  ? "A empresa ainda não tem candidatos."
                  : "Nenhum candidato corresponde à busca e aos filtros."}
              </p>
            )}
            {(!pool.isError ? pool.data?.items : undefined)?.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
              >
                <div>
                  <Link className="underline" to="/candidatos/$id" params={{ id: c.id }}>
                    {c.nome ?? "Cadastro sem nome"}
                  </Link>
                  <p className="text-xs">
                    {c.localizacao ?? "Local não informado"} ·{" "}
                    {c.review_status === "completed" ? "Revisado" : "Revisão pendente"}
                  </p>
                </div>
                {compareChoice(c.id, c.nome ?? "candidato")}
                <CandidateFavorite companyId={companyId} candidateId={c.id} value={c.is_favorite} />
                {canEdit && open && (
                  <CandidateJobButton companyId={companyId} candidateId={c.id} jobId={jobId} />
                )}
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
function Pages({
  page,
  setPage,
  more,
}: {
  page: number;
  setPage: (v: number) => void;
  more: boolean;
}) {
  if (page === 0 && !more) return null;
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
        Anterior
      </Button>
      <span className="text-sm">Página {page + 1}</span>
      <Button variant="outline" disabled={!more} onClick={() => setPage(page + 1)}>
        Próxima
      </Button>
    </div>
  );
}
