import { ApprenticeAgeNotice, ApprenticeCaseReview } from "./apprentice-age";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { MatchDetails } from "@/lib/scoring";
import { ScoreExplanation } from "./score-explanation";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

type Candidate = Tables<"candidates">;
type Entry = Tables<"ranking_entries">;
type Run = Tables<"ranking_runs">;
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "Não informada";
export function pendingReason(c: Pick<Candidate, "processing_status" | "review_status">) {
  if (c.processing_status === "erro") return "A leitura falhou. Corrija ou reprocesse o currículo.";
  if (!["concluido", "revisao_manual"].includes(c.processing_status))
    return "O currículo ainda precisa de processamento.";
  if (c.review_status !== "completed") return "A revisão humana ainda não foi concluída.";
  return null;
}

export function RankingResult({
  run,
  entries,
  outdated,
  canAdmin = false,
}: {
  run: Run;
  entries: Entry[];
  outdated: boolean;
  canAdmin?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [minExp, setMinExp] = useState("");
  const ranked = entries
    .filter((e) => !e.reason && e.score !== null)
    .sort(
      (a, b) => Number(b.score) - Number(a.score) || a.candidate_id.localeCompare(b.candidate_id),
    );
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Avaliação de {date(run.completed_at)} · {run.eligible} avaliados ·{" "}
        {run.total - run.eligible} sem avaliação final.
      </p>
      {outdated && (
        <p role="status" className="rounded border border-amber-500 p-3 text-sm">
          Resultado desatualizado: a base, a revisão humana ou a vaga mudou. Calcule novamente antes
          de usar esta avaliação.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Os dados abaixo são os que foram usados nesta avaliação. A decisão final é do RH.
      </p>
      <Input
        aria-label="Filtrar candidatos avaliados"
        placeholder="Filtrar por nome ou cidade"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <Input
        type="number"
        min={0}
        aria-label="Experiência mínima em anos"
        placeholder="Experiência mínima (anos)"
        value={minExp}
        onChange={(e) => setMinExp(e.target.value)}
      />
      {ranked.length === 0 && (
        <p>Nenhum candidato estava apto para uma avaliação final neste cálculo.</p>
      )}
      {ranked
        .filter((e) => {
          const c = e.snapshot as unknown as Candidate;
          return (
            (!minExp || (c.anos_experiencia !== null && c.anos_experiencia >= Number(minExp))) &&
            `${c.nome ?? ""} ${c.localizacao ?? ""}`
              .toLocaleLowerCase()
              .includes(filter.toLocaleLowerCase())
          );
        })
        .map((e) => {
          const c = e.snapshot as unknown as Candidate;
          return (
            <Card key={e.candidate_id}>
              <CardContent className="space-y-3 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    to="/candidatos/$id"
                    params={{ id: e.candidate_id }}
                    className="font-medium hover:underline"
                  >
                    {c.nome || "Currículo sem nome"}
                  </Link>
                  <Badge variant={outdated ? "outline" : "default"}>
                    {Math.round(Number(e.score))}% de aderência{outdated ? " · desatualizada" : ""}
                  </Badge>
                </div>
                <p className="text-sm">
                  {c.localizacao || "Local não informado"} · Experiência:{" "}
                  {c.anos_experiencia === null ? "não informada" : `${c.anos_experiencia} ano(s)`}
                </p>
                {(run.job_snapshot as unknown as Tables<"jobs">).categoria === "jovem_aprendiz" && (
                  <>
                    <ApprenticeAgeNotice
                      assessment={(e.details as unknown as MatchDetails)?.aprendizagem}
                    />
                    {canAdmin && (
                      <ApprenticeCaseReview
                        companyId={run.company_id}
                        runId={run.id}
                        candidateId={e.candidate_id}
                        outdated={outdated}
                      />
                    )}
                  </>
                )}
                <ScoreExplanation
                  details={e.details as unknown as MatchDetails}
                  jobVersion={(run.job_snapshot as unknown as Tables<"jobs">).version}
                />
                <details className="text-sm">
                  <summary className="cursor-pointer">
                    Dados e revisão usados nesta avaliação
                  </summary>
                  <div className="space-y-2 pt-3">
                    <p>
                      Currículo versão {c.data_version} · Revisão {c.review_version} · Revisado em{" "}
                      {date(c.reviewed_at)}.
                    </p>
                    <p>
                      Responsável pela revisão: {c.reviewed_by || "Não registrado"}. Responsável
                      pelo cálculo: {run.actor_id || "Conta removida"}.
                    </p>
                    <p>
                      Os documentos e as informações abaixo correspondem à data do cálculo, mesmo
                      que o cadastro tenha sido corrigido depois.
                    </p>
                    <Snapshot label="Documentos originais identificados" value={e.documents} />
                    <Snapshot label="Informações usadas no cálculo" value={c.dados_efetivos} />
                    <Snapshot label="Extração da IA" value={c.dados_extraidos} />
                    <Snapshot label="Correções humanas" value={c.correcoes_rh} />
                  </div>
                </details>
              </CardContent>
            </Card>
          );
        })}
      {entries.some((e) => e.reason) && (
        <details className="rounded border p-4">
          <summary className="cursor-pointer">
            Sem avaliação final neste cálculo ({entries.filter((e) => e.reason).length})
          </summary>
          <div className="space-y-3 pt-3">
            {entries
              .filter((e) => e.reason)
              .map((e) => (
                <div key={e.candidate_id} className="space-y-2">
                  <Link to="/candidatos/$id" params={{ id: e.candidate_id }} className="underline">
                    {(e.snapshot as unknown as Candidate).nome || "Currículo sem nome"}
                  </Link>{" "}
                  — {e.reason}
                  {canAdmin &&
                    (run.job_snapshot as unknown as Tables<"jobs">).categoria ===
                      "jovem_aprendiz" && (
                      <ApprenticeCaseReview
                        companyId={run.company_id}
                        runId={run.id}
                        candidateId={e.candidate_id}
                        outdated={outdated}
                      />
                    )}
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
function Snapshot({ label, value }: { label: string; value: unknown }) {
  return (
    <details>
      <summary className="cursor-pointer">{label}</summary>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export function RankingHistory({
  companyId,
  job,
  canAdmin = false,
}: {
  companyId: string;
  job: Tables<"jobs">;
  canAdmin?: boolean;
}) {
  const [historyPage, setHistoryPage] = useState(0);
  const [selected, setSelected] = useState<Run | null>(null);
  const [pendingPage, setPendingPage] = useState(0);
  const runs = useQuery({
    queryKey: ["ranking-runs", companyId, job.id, historyPage],
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase
        .from("ranking_runs")
        .select("*")
        .eq("company_id", companyId)
        .eq("job_id", job.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(historyPage * 20, historyPage * 20 + 19);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const latest = useQuery({
    queryKey: ["ranking-current", companyId, job.id, selected?.id],
    refetchInterval: 5000,
    queryFn: async () => {
      let q = supabase
        .from("ranking_runs")
        .select("*")
        .eq("company_id", companyId)
        .eq("job_id", job.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1);
      if (selected) q = q.eq("id", selected.id);
      const r = await q.maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const run = latest.data;
  const entries = useQuery({
    queryKey: ["ranking-entries", companyId, run?.id],
    enabled: !!run,
    refetchInterval: 5000,
    queryFn: async () => {
      const result: Entry[] = [];
      let cursor = "";
      // Immutable run identity on every page prevents mixing generations.
      for (;;) {
        let q = supabase
          .from("ranking_entries")
          .select("*")
          .eq("company_id", companyId)
          .eq("run_id", run!.id)
          .order("candidate_id")
          .limit(200);
        if (cursor) q = q.gt("candidate_id", cursor);
        const r = await q;
        if (r.error) throw r.error;
        if (!r.data.length) break;
        result.push(...r.data);
        cursor = r.data[r.data.length - 1]!.candidate_id;
      }
      return result;
    },
  });
  const pending = useQuery({
    queryKey: ["ranking-pending", companyId, pendingPage],
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase
        .from("candidates")
        .select("id,nome,processing_status,review_status", { count: "exact" })
        .eq("company_id", companyId)
        .eq("excluido", false)
        .or("review_status.neq.completed,processing_status.not.in.(concluido,revisao_manual)")
        .order("id")
        .range(pendingPage * 20, pendingPage * 20 + 19);
      if (r.error) throw r.error;
      return r;
    },
  });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pendências atuais ({pending.data?.count ?? "…"})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Estes candidatos não recebem classificação final até concluir o processamento e a
            revisão humana.
          </p>
          {pending.isError ? (
            <p role="alert">Não foi possível consultar as pendências. Tente atualizar a página.</p>
          ) : (
            pending.data?.data.map((c) => (
              <p key={c.id} className="text-sm">
                <Link to="/candidatos/$id" params={{ id: c.id }} className="underline">
                  {c.nome || "Currículo sem nome"}
                </Link>{" "}
                — {pendingReason(c)}
              </p>
            ))
          )}
          {pending.data?.count === 0 && (
            <p className="text-sm">Nenhuma pendência de processamento ou revisão.</p>
          )}
          <Pager
            page={pendingPage}
            setPage={setPendingPage}
            hasNext={(pendingPage + 1) * 20 < (pending.data?.count ?? 0)}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Histórico de avaliações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            O resultado publicado permanece disponível enquanto um novo cálculo está em andamento.
            Cada avaliação guarda seus critérios, currículo e revisão humana.
          </p>
          <Button variant={selected ? "outline" : "secondary"} onClick={() => setSelected(null)}>
            Resultado publicado mais recente
          </Button>
          {runs.isError && <p role="alert">Não foi possível carregar o histórico.</p>}
          {runs.data?.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {date(r.created_at)} ·{" "}
                {r.status === "completed"
                  ? `${r.eligible} avaliados / ${r.total - r.eligible} pendentes`
                  : r.status === "failed"
                    ? "Cálculo não publicado; resultado anterior preservado"
                    : new Date(r.expires_at).getTime() < Date.now()
                      ? "Tentativa expirada; inicie novo cálculo"
                      : "Cálculo em andamento"}
              </span>
              {r.status === "completed" && (
                <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                  Consultar avaliação
                </Button>
              )}
            </div>
          ))}
          <Pager page={historyPage} setPage={setHistoryPage} hasNext={runs.data?.length === 20} />
        </CardContent>
      </Card>
      {latest.isError || entries.isError ? (
        <p role="alert">Não foi possível carregar a avaliação. O resultado salvo foi preservado.</p>
      ) : !run ? (
        <p className="text-sm">
          {latest.isLoading
            ? "Carregando avaliação…"
            : "Nenhuma avaliação publicada. Calcule a aderência após revisar os currículos."}
        </p>
      ) : (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            {selected ? "Avaliação histórica" : "Ranking publicado"}
          </h2>
          <Snapshot label="Descrição e critérios aprovados usados" value={run.job_snapshot} />
          {entries.data ? (
            <RankingResult
              key={run.id}
              run={run}
              canAdmin={canAdmin}
              entries={entries.data}
              outdated={
                run.stale ||
                (run.job_snapshot as unknown as Tables<"jobs">).version !== job.version ||
                run.formula !== "evidence-v3"
              }
            />
          ) : (
            <p>Carregando candidatos avaliados…</p>
          )}
        </section>
      )}
    </div>
  );
}
function Pager({
  page,
  setPage,
  hasNext,
}: {
  page: number;
  setPage: (value: number) => void;
  hasNext: boolean;
}) {
  if (page === 0 && !hasNext) return null;
  return (
    <div className="flex items-center gap-3">
      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
        Anterior
      </Button>
      <span className="text-sm">Página {page + 1}</span>
      <Button size="sm" variant="outline" disabled={!hasNext} onClick={() => setPage(page + 1)}>
        Próxima
      </Button>
    </div>
  );
}
