import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { refreshCompanyLists } from "@/lib/company-browse";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";

export const decisionLabels: Record<string, string> = {
  novo: "Não decidido",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Não aprovado",
  contratado: "Contratado",
};
const when = (s: string) => new Date(s).toLocaleString("pt-BR");
const author = (row: { actor_name: string | null; actor_id: string | null }) =>
  row.actor_name || row.actor_id || "Responsável não disponível";
function errorMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "40001"
    ? "Outra pessoa alterou esta decisão. Confira a versão atual antes de salvar."
    : code === "42501"
      ? "Acesso indisponível. Confira sua permissão e o cadastro."
      : "Não foi possível confirmar o salvamento. Confira o histórico e tente novamente; os registros anteriores foram preservados.";
}
function HistoryPages({
  page,
  count,
  onPage,
}: {
  page: number;
  count: number;
  onPage: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span>
        {count} registros · página {page + 1}
      </span>
      <Button variant="outline" size="sm" disabled={!page} onClick={() => onPage(page - 1)}>
        Anteriores
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={(page + 1) * 20 >= count}
        onClick={() => onPage(page + 1)}
      >
        Mais antigos
      </Button>
    </div>
  );
}
export function CandidateFavorite({
  companyId,
  candidateId,
  value,
}: {
  companyId: string;
  candidateId: string;
  value?: boolean;
}) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["candidate-favorites", companyId, candidateId],
    enabled: value === undefined,
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase
        .from("candidate_favorites")
        .select("candidate_id")
        .eq("company_id", companyId)
        .eq("candidate_id", candidateId)
        .maybeSingle();
      if (r.error) throw r.error;
      return !!r.data;
    },
  });
  const favorite = value ?? query.data ?? false;
  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      const r = await supabase.rpc("set_candidate_favorite", {
        p_company: companyId,
        p_candidate: candidateId,
        p_favorite: next,
      });
      if (r.error) throw r.error;
    },
    onSuccess: async () => {
      await Promise.all([
        refreshCompanyLists(cache, companyId),
        cache.invalidateQueries({ queryKey: ["candidate-favorites", companyId] }),
      ]);
    },
  });
  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant={favorite ? "secondary" : "outline"}
        aria-pressed={favorite}
        aria-label={favorite ? "Retirar dos meus favoritos" : "Adicionar aos meus favoritos"}
        disabled={mutation.isPending || (value === undefined && (query.isLoading || query.isError))}
        onClick={() => mutation.mutate(!favorite)}
      >
        {mutation.isPending ? "Salvando…" : favorite ? "★ Meu favorito" : "☆ Favoritar"}
      </Button>
      {(mutation.isError || query.isError) && (
        <p role="alert" className="text-xs">
          Não foi possível atualizar os favoritos. Tente novamente.
        </p>
      )}
    </div>
  );
}
export function CandidateNotes({
  companyId,
  candidateId,
  jobId = null,
  canEdit,
  legacy,
}: {
  companyId: string;
  candidateId: string;
  jobId?: string | null;
  canEdit: boolean;
  legacy?: string | null;
}) {
  const cache = useQueryClient();
  const [body, setBody] = useState("");
  const [page, setPage] = useState(0);
  const request = useRef<{ body: string; id: string } | null>(null);
  const notes = useQuery({
    queryKey: ["candidate-notes", companyId, candidateId, jobId, page],
    refetchInterval: 5000,
    queryFn: async ({ signal }) => {
      let q = supabase
        .from("candidate_notes")
        .select("*", { count: "exact" })
        .eq("company_id", companyId)
        .eq("candidate_id", candidateId);
      q = jobId ? q.eq("job_id", jobId) : q.is("job_id", null);
      const r = await q
        .order("created_at", { ascending: false })
        .order("id")
        .range(page * 20, page * 20 + 19)
        .abortSignal(signal);
      if (r.error) throw r.error;
      return r;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!request.current || request.current.body !== body)
        request.current = { body, id: crypto.randomUUID() };
      const r = await supabase.rpc("add_candidate_note", {
        p_company: companyId,
        p_candidate: candidateId,
        p_job: jobId,
        p_body: body,
        p_request: request.current.id,
      });
      if (r.error) throw r.error;
    },
    onSuccess: async () => {
      setBody("");
      request.current = null;
      setPage(0);
      await cache.invalidateQueries({ queryKey: ["candidate-notes", companyId, candidateId] });
    },
  });
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">
        {jobId ? "Notas específicas desta vaga" : "Notas gerais do candidato"}
      </h3>
      <p className="text-sm text-muted-foreground">
        As notas são internas e mantidas em histórico. Para corrigir uma informação, acrescente uma
        nova nota identificando a anterior.
      </p>
      {legacy && (
        <details className="rounded border p-3 text-sm">
          <summary>Observação geral anterior</summary>
          <p className="mt-2 whitespace-pre-wrap">{legacy}</p>
          <p className="mt-2 text-muted-foreground">
            Registro anterior a este histórico. Autoria e data não presumidas; consulte também o
            histórico de revisões.
          </p>
        </details>
      )}
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) save.mutate();
          }}
          className="space-y-2"
        >
          <label className="block text-sm">
            Nova nota {jobId ? "nesta vaga" : "geral"}
            <Textarea
              value={body}
              disabled={save.isPending}
              maxLength={10000}
              onChange={(e) => {
                setBody(e.target.value);
                save.reset();
              }}
            />
          </label>
          <Button disabled={save.isPending || !body.trim()}>
            {save.isPending ? "Salvando nota…" : "Acrescentar nota"}
          </Button>
        </form>
      )}
      {save.isSuccess && (
        <p role="status" className="text-sm">
          Nota salva no histórico.
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-sm">
          {errorMessage(save.error)}
        </p>
      )}
      {notes.isError ? (
        <p role="alert">
          Não foi possível consultar as notas.{" "}
          <Button variant="outline" onClick={() => notes.refetch()}>
            Tentar novamente
          </Button>
        </p>
      ) : notes.isLoading ? (
        <p>Carregando notas…</p>
      ) : (
        <>
          {notes.data?.count === 0 && (
            <p className="text-sm">Nenhuma nota registrada neste contexto.</p>
          )}
          {notes.data?.data.map((n) => (
            <article key={n.id} className="space-y-2 rounded border p-3 text-sm">
              <p className="font-medium">
                {author(n)} · {when(n.created_at)}
              </p>
              <p className="whitespace-pre-wrap break-words">{n.body}</p>
            </article>
          ))}
          <HistoryPages page={page} count={notes.data?.count ?? 0} onPage={setPage} />
        </>
      )}
    </section>
  );
}
export function CandidateJobDecision({
  link,
  canEdit,
  open,
}: {
  link: Tables<"candidate_job_links">;
  canEdit: boolean;
  open: boolean;
}) {
  const cache = useQueryClient();
  const [status, setStatus] = useState(link.decision_status);
  const [selected, setSelected] = useState(link.shortlisted);
  const [version, setVersion] = useState(link.decision_version);
  const [reason, setReason] = useState("");
  const [dirty, setDirty] = useState(false);
  const [page, setPage] = useState(0);
  const request = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    if (!dirty) {
      setStatus(link.decision_status);
      setSelected(link.shortlisted);
      setVersion(link.decision_version);
    }
  }, [link, dirty]);
  const conflict = version !== link.decision_version;
  const history = useQuery({
    queryKey: ["candidate-decisions", link.company_id, link.candidate_id, link.job_id, page],
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase
        .from("candidate_decision_events")
        .select("*", { count: "exact" })
        .eq("company_id", link.company_id)
        .eq("candidate_id", link.candidate_id)
        .eq("job_id", link.job_id)
        .order("version", { ascending: false })
        .range(page * 20, page * 20 + 19);
      if (r.error) throw r.error;
      return r;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const key = JSON.stringify([status, selected, reason, version]);
      if (!request.current || request.current.key !== key)
        request.current = { key, id: crypto.randomUUID() };
      const r = await supabase.rpc("save_candidate_decision", {
        p_company: link.company_id,
        p_candidate: link.candidate_id,
        p_job: link.job_id,
        p_version: version,
        p_status: status,
        p_selected: selected,
        p_reason: reason,
        p_request: request.current.id,
      });
      if (r.error) throw r.error;
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["candidate-job-links", link.company_id] }),
        cache.invalidateQueries({ queryKey: ["candidate-decisions", link.company_id] }),
      ]);
      setDirty(false);
      setReason("");
      request.current = null;
      setPage(0);
    },
    onError: () => {
      void cache.invalidateQueries({ queryKey: ["candidate-job-links", link.company_id] });
    },
  });
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">Decisão nesta vaga</h3>
      <p className="text-sm">
        Situação atual: <strong>{decisionLabels[link.decision_status]}</strong> ·{" "}
        {link.shortlisted ? "Na lista de selecionados" : "Fora da lista de selecionados"} · versão{" "}
        {link.decision_version}
      </p>
      <p className="text-xs text-muted-foreground">
        A seleção organiza a lista desta vaga; não significa aprovação ou contratação. A decisão
        final é do RH.
      </p>
      {canEdit && link.active && open ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <fieldset disabled={save.isPending} className="space-y-3">
            <label className="block text-sm">
              Situação nesta vaga{" "}
              <select
                className="ml-2 rounded border bg-background p-2"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setDirty(true);
                  save.reset();
                }}
              >
                {Object.entries(decisionLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => {
                  setSelected(e.target.checked);
                  setDirty(true);
                  save.reset();
                }}
              />
              Incluir na lista de selecionados desta vaga
            </label>
            <label className="block text-sm">
              Justificativa da alteração (obrigatória)
              <Textarea
                value={reason}
                minLength={5}
                maxLength={2000}
                onChange={(e) => {
                  setReason(e.target.value);
                  setDirty(true);
                  save.reset();
                }}
              />
            </label>
            <Button
              disabled={
                conflict ||
                reason.trim().length < 5 ||
                (status === link.decision_status && selected === link.shortlisted)
              }
            >
              {save.isPending ? "Salvando decisão…" : "Salvar decisão nesta vaga"}
            </Button>
          </fieldset>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          {!canEdit
            ? "Acesso somente para consulta."
            : !open
              ? "Vaga encerrada: reabra para alterar a decisão."
              : "Vínculo retirado: histórico preservado para consulta."}
        </p>
      )}
      {conflict && (
        <div role="alert" className="rounded border border-amber-500 p-3 text-sm">
          A decisão mudou enquanto você editava. Confira o histórico antes de descartar ou refazer o
          rascunho.
          <Button
            variant="outline"
            onClick={() => {
              setDirty(false);
              setReason("");
              save.reset();
            }}
          >
            Descartar rascunho e carregar decisão atual
          </Button>
        </div>
      )}
      {save.isSuccess && <p role="status">Decisão salva e histórico registrado.</p>}
      {save.isError && <p role="alert">{errorMessage(save.error)}</p>}
      <h4 className="text-sm font-semibold">Histórico de decisões e seleção</h4>
      {history.isError ? (
        <p role="alert">Não foi possível carregar o histórico.</p>
      ) : history.isLoading ? (
        <p>Carregando histórico…</p>
      ) : (
        <>
          {history.data?.count === 0 && (
            <p className="text-sm">Nenhuma mudança de decisão registrada.</p>
          )}
          {history.data?.data.map((e) => (
            <article key={e.id} className="space-y-1 rounded border p-3 text-sm">
              <p>
                {author(e)} · {when(e.created_at)}
              </p>
              <p>
                {decisionLabels[e.before_status]} → {decisionLabels[e.after_status]} · Selecionado:{" "}
                {e.before_selected ? "sim" : "não"} → {e.after_selected ? "sim" : "não"}
              </p>
              <p className="whitespace-pre-wrap break-words">{e.reason}</p>
            </article>
          ))}
          <HistoryPages page={page} count={history.data?.count ?? 0} onPage={setPage} />
        </>
      )}
    </section>
  );
}
export function CandidateJobWorkspace({
  link,
  canEdit,
  open,
}: {
  link: Tables<"candidate_job_links">;
  canEdit: boolean;
  open: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details className="w-full" onToggle={(e) => setExpanded(e.currentTarget.open)}>
      <summary className="cursor-pointer text-sm">
        Decisão, notas e histórico desta vaga{" "}
        <Badge variant="outline">{decisionLabels[link.decision_status]}</Badge>
        {link.shortlisted && <Badge variant="secondary">Selecionado</Badge>}
      </summary>
      {expanded && (
        <div className="mt-3 space-y-3">
          <CandidateJobDecision link={link} canEdit={canEdit} open={open} />
          <CandidateNotes
            companyId={link.company_id}
            candidateId={link.candidate_id}
            jobId={link.job_id}
            canEdit={canEdit && link.active}
          />
        </div>
      )}
    </details>
  );
}
