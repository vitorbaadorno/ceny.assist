import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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
  const [jobPage, setJobPage] = useState(0);
  const links = useQuery({
    queryKey: ["candidate-job-links", companyId, "person", candidateId, page],
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase
        .from("candidate_job_links")
        .select("*,jobs(titulo,status)")
        .eq("company_id", companyId)
        .eq("candidate_id", candidateId)
        .eq("active", true)
        .order("job_id")
        .range(page * 20, page * 20 + 20);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const jobs = useQuery({
    queryKey: ["linkable-jobs", companyId, jobPage],
    enabled: canEdit,
    queryFn: async () => {
      const r = await supabase
        .from("jobs")
        .select("id,titulo")
        .eq("company_id", companyId)
        .eq("status", "aberta")
        .order("id")
        .range(jobPage * 20, jobPage * 20 + 20);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vagas associadas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Uma pessoa pode participar de várias vagas. A associação é registrada pela equipe e não
          significa aprovação ou contratação.
        </p>
        {links.isError && <p role="alert">Não foi possível carregar os vínculos.</p>}
        {links.data?.length === 0 && <p className="text-sm">Nenhuma vaga associada.</p>}
        {links.data?.slice(0, 20).map((l) => (
          <div
            key={l.job_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
          >
            <Link className="underline" to="/vagas/$id" params={{ id: l.job_id }}>
              {l.jobs?.titulo} · {l.jobs?.status}
            </Link>
            {canEdit && (
              <CandidateJobButton
                companyId={companyId}
                candidateId={candidateId}
                jobId={l.job_id}
                remove
              />
            )}
          </div>
        ))}
        <Pages page={page} setPage={setPage} more={(links.data?.length ?? 0) > 20} />
        {canEdit && (
          <details>
            <summary className="cursor-pointer">Associar a outra vaga aberta</summary>
            <div className="space-y-3 pt-3">
              {jobs.isError && <p role="alert">Não foi possível carregar as vagas.</p>}
              {jobs.data?.slice(0, 20).map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-3">
                  <span>{j.titulo}</span>
                  <CandidateJobButton
                    companyId={companyId}
                    candidateId={candidateId}
                    jobId={j.id}
                  />
                </div>
              ))}
              <Pages page={jobPage} setPage={setJobPage} more={(jobs.data?.length ?? 0) > 20} />
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
  const [search, setSearch] = useState("");
  const [poolPage, setPoolPage] = useState(0);
  const links = useQuery({
    queryKey: ["candidate-job-links", companyId, "job", jobId, page],
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase
        .from("candidate_job_links")
        .select("*,candidates(nome,email)")
        .eq("company_id", companyId)
        .eq("job_id", jobId)
        .eq("active", true)
        .order("candidate_id")
        .range(page * 20, page * 20 + 20);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const pool = useQuery({
    queryKey: ["talent-pool", companyId, search, poolPage],
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase.rpc("search_candidates", {
        p_company: companyId,
        p_query: search,
        p_offset: poolPage * 50,
      });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipe de candidatos desta vaga</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Aqui aparecem os vínculos escolhidos pelo RH. O ranking consulta todo o acervo autorizado
          para sugerir pessoas, mesmo que ainda não estejam vinculadas.
        </p>
        {links.isError && <p role="alert">Não foi possível carregar as associações.</p>}
        {links.data?.length === 0 && <p>Nenhum candidato associado.</p>}
        {links.data?.slice(0, 20).map((l) => (
          <div
            key={l.candidate_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
          >
            <Link className="underline" to="/candidatos/$id" params={{ id: l.candidate_id }}>
              {l.candidates?.nome ?? "Cadastro sem nome"} ·{" "}
              {l.candidates?.email ?? "E-mail não informado"}
            </Link>
            {canEdit && (
              <CandidateJobButton
                companyId={companyId}
                candidateId={l.candidate_id}
                jobId={jobId}
                remove
              />
            )}
          </div>
        ))}
        <Pages page={page} setPage={setPage} more={(links.data?.length ?? 0) > 20} />
        <details>
          <summary className="cursor-pointer">Buscar pessoas já cadastradas no acervo</summary>
          <div className="space-y-3 pt-3">
            <Input
              aria-label="Buscar no acervo"
              placeholder="Nome, e-mail, cidade ou competência"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPoolPage(0);
              }}
            />
            {pool.isError && <p role="alert">Não foi possível pesquisar o acervo.</p>}
            {pool.data?.length === 0 && <p>Nenhuma pessoa encontrada.</p>}
            {pool.data?.slice(0, 50).map((c) => (
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
                {canEdit && open && (
                  <CandidateJobButton companyId={companyId} candidateId={c.id} jobId={jobId} />
                )}
              </div>
            ))}
            <Pages page={poolPage} setPage={setPoolPage} more={(pool.data?.length ?? 0) > 50} />
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
